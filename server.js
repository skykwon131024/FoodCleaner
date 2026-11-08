const fs = require("fs");
const http = require("http");
const path = require("path");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
const USE_MOCK_WHEN_NO_KEY = true;
const SUPPORTED_CUISINES = ["한식", "중식", "일식", "양식", "분식", "디저트"];
const SUPPORTED_STYLES = [
  "간단하고 빠른 요리",
  "건강한 요리",
  "든든한 요리",
  "저칼로리 요리",
  "매콤한 요리",
  "색다르고 특별한 요리",
];
const INGREDIENT_SUBSTITUTIONS = {
  "간장": ["소금"],
  "감자": ["고구마"],
  "계란": ["두부"],
  "고추장": ["고춧가루", "된장"],
  "당근": ["애호박", "파프리카"],
  "떡": ["떡국떡"],
  "마요네즈": ["플레인 요거트"],
  "밀가루": ["부침가루", "튀김가루"],
  "밥": ["즉석밥", "현미밥"],
  "버터": ["식용유", "올리브유"],
  "빵": ["식빵", "또띠아"],
  "설탕": ["올리고당", "꿀"],
  "식용유": ["올리브유", "버터"],
  "양파": ["대파", "쪽파"],
  "우유": ["두유", "아몬드 우유"],
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(text);
}

function getPathnameFromRequest(url) {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "application/javascript; charset=utf-8";
  if (extension === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function isStaticFileAllowed(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return [".html", ".css", ".js", ".ico"].includes(extension);
}

function serveStaticFile(req, res) {
  const pathname = decodeURIComponent(getPathnameFromRequest(req.url));
  const safePathname = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(__dirname, safePathname));
  const insideProject = filePath.startsWith(path.normalize(__dirname + path.sep));

  if (!insideProject || !isStaticFileAllowed(filePath)) {
    sendText(res, 404, "File not found");
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "File not found");
    return true;
  }

  res.writeHead(200, {
    "Content-Type": getContentType(filePath),
  });

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" || req.method === "HEAD") {
    if (serveStaticFile(req, res)) {
      return;
    }
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/upload") {
    readJsonBody(req)
      .then(async (payload) => {
        if (!isAzureConfigured()) {
          if (USE_MOCK_WHEN_NO_KEY) {
            sendJson(res, 200, {
              success: true,
              ingredients: ["계란", "양파", "우유"],
              message: "Azure OpenAI 환경 변수 미설정: 임시 인식 결과를 사용했습니다.",
            });
            return;
          }

          sendJson(res, 500, {
            success: false,
            ingredients: [],
            message: "AZURE_OPENAI_ENDPOINT/API_KEY/DEPLOYMENT 설정이 필요합니다.",
          });
          return;
        }

        const imageDataUrl = payload?.imageDataUrl;
        if (!imageDataUrl || typeof imageDataUrl !== "string") {
          sendJson(res, 400, {
            success: false,
            ingredients: [],
            message: "imageDataUrl이 필요합니다.",
          });
          return;
        }

        const ingredients = await recognizeIngredientsWithAi(imageDataUrl);
        sendJson(res, 200, {
          success: true,
          ingredients,
          message: "AI 식재료 인식 완료",
        });
      })
      .catch((error) => {
        sendJson(res, 500, {
          success: false,
          ingredients: [],
          message: `인식 처리 중 오류: ${error.message}`,
        });
      });

    return;
  }

  if (req.method === "POST" && req.url === "/recommend") {
    readJsonBody(req)
      .then(async (payload) => {
        const desiredCount = normalizeDesiredCount(payload?.desiredCount);
        const preferences = normalizePreferences(payload?.preferences);

        if (!isAzureConfigured()) {
          if (USE_MOCK_WHEN_NO_KEY) {
            const fallbackIngredients = Array.isArray(payload?.ingredients)
              ? payload.ingredients.filter((item) => typeof item === "string" && item.trim())
              : [];

            const mockRecipePool = [
              {
                name: "양파 계란 볶음",
                description: "양파와 계란으로 빠르게 만들 수 있는 간단 볶음 요리",
                time: "10분",
                difficulty: "쉬움",
                cuisine: "한식",
                styles: ["간단하고 빠른 요리", "든든한 요리"],
                spiciness: "mild",
                ingredients: ["양파 1/2개", "계란 2개", "식용유 1큰술"],
              },
              {
                name: "우유 계란찜",
                description: "우유를 넣어 더 부드럽게 만드는 전자레인지 계란찜",
                time: "8분",
                difficulty: "쉬움",
                cuisine: "한식",
                styles: ["간단하고 빠른 요리", "건강한 요리", "저칼로리 요리"],
                spiciness: "mild",
                ingredients: ["계란 2개", "우유 100ml", "소금 약간"],
              },
              {
                name: "양파 오믈렛",
                description: "양파를 먼저 볶아 단맛을 살린 오믈렛",
                time: "15분",
                difficulty: "보통",
                cuisine: "양식",
                styles: ["든든한 요리", "색다르고 특별한 요리"],
                spiciness: "mild",
                ingredients: ["양파 1/2개", "계란 2개", "버터 1큰술"],
              },
              {
                name: "계란 샐러드",
                description: "삶은 계란과 양파를 곁들인 가벼운 샐러드",
                time: "12분",
                difficulty: "쉬움",
                cuisine: "양식",
                styles: ["건강한 요리", "저칼로리 요리", "간단하고 빠른 요리"],
                spiciness: "mild",
                ingredients: ["계란 2개", "양파 1/4개", "마요네즈 1큰술"],
              },
              {
                name: "우유 프렌치토스트",
                description: "우유와 계란물을 입혀 구워내는 토스트",
                time: "14분",
                difficulty: "보통",
                cuisine: "디저트",
                styles: ["간단하고 빠른 요리", "색다르고 특별한 요리"],
                spiciness: "mild",
                ingredients: ["식빵 2장", "계란 1개", "우유 50ml", "설탕 1작은술"],
              },
              {
                name: "양파 수프",
                description: "양파의 단맛을 살린 따뜻한 수프",
                time: "20분",
                difficulty: "보통",
                cuisine: "양식",
                styles: ["건강한 요리", "든든한 요리"],
                spiciness: "mild",
                ingredients: ["양파 1개", "우유 200ml", "버터 1큰술"],
              },
              {
                name: "에그드롭 샌드위치",
                description: "부드러운 스크램블 에그를 넣은 샌드위치",
                time: "10분",
                difficulty: "쉬움",
                cuisine: "양식",
                styles: ["간단하고 빠른 요리", "든든한 요리"],
                spiciness: "mild",
                ingredients: ["식빵 2장", "계란 2개", "우유 30ml", "버터 1큰술"],
              },
              {
                name: "양파 감자전",
                description: "양파를 넣어 감칠맛을 더한 전",
                time: "18분",
                difficulty: "보통",
                cuisine: "한식",
                styles: ["든든한 요리", "색다르고 특별한 요리"],
                spiciness: "mild",
                ingredients: ["감자 2개", "양파 1/2개", "밀가루 2큰술", "식용유 2큰술"],
              },
              {
                name: "우유 스크램블",
                description: "우유를 넣어 촉촉하게 만든 스크램블",
                time: "7분",
                difficulty: "쉬움",
                cuisine: "한식",
                styles: ["간단하고 빠른 요리", "저칼로리 요리"],
                spiciness: "mild",
                ingredients: ["계란 2개", "우유 30ml", "버터 1작은술"],
              },
              {
                name: "계란 볶음밥",
                description: "계란과 양파를 활용한 기본 볶음밥",
                time: "13분",
                difficulty: "쉬움",
                cuisine: "중식",
                styles: ["간단하고 빠른 요리", "든든한 요리"],
                spiciness: "medium",
                ingredients: ["계란 2개", "양파 1/4개", "밥 1공기", "식용유 1큰술"],
              },
              {
                name: "양파 계란 덮밥",
                description: "간장 양념에 양파와 계란을 익혀 밥 위에 올린 덮밥",
                time: "15분",
                difficulty: "쉬움",
                cuisine: "일식",
                styles: ["간단하고 빠른 요리", "든든한 요리"],
                spiciness: "mild",
                ingredients: ["계란 2개", "양파 1/2개", "밥 1공기", "간장 1큰술"],
              },
              {
                name: "매콤 계란 떡볶이",
                description: "계란과 양파를 넣어 매콤하게 끓인 간식 요리",
                time: "18분",
                difficulty: "보통",
                cuisine: "분식",
                styles: ["간단하고 빠른 요리", "매콤한 요리", "색다르고 특별한 요리"],
                spiciness: "hot",
                ingredients: ["떡 200g", "계란 1개", "양파 1/2개", "고추장 2큰술"],
              },
              {
                name: "우유 계란 푸딩",
                description: "우유와 계란으로 만드는 부드러운 디저트",
                time: "20분",
                difficulty: "보통",
                cuisine: "디저트",
                styles: ["색다르고 특별한 요리", "저칼로리 요리"],
                spiciness: "mild",
                ingredients: ["계란 2개", "우유 200ml", "설탕 2큰술"],
              },
            ];
            const matchingRecipes = mockRecipePool.filter((recipe) => matchesPreferences(recipe, preferences));
            const textRankedRecipes = rankRecipesByTextPreferences(matchingRecipes, preferences);
            const timeFilteredRecipes = filterRecipesByTime(textRankedRecipes, preferences.timeLimitMinutes);
            const orderedRecipes = shouldPrioritizeQuickly(preferences)
              ? sortRecipesByTime(timeFilteredRecipes)
              : timeFilteredRecipes;

            sendJson(res, 200, {
              success: true,
              ingredients: fallbackIngredients,
              preferences,
              recipes: orderedRecipes.slice(0, desiredCount).map((recipe) => normalizeRecipe(recipe, fallbackIngredients)),
              message: "Azure OpenAI 환경 변수 미설정: 임시 추천 결과를 사용했습니다.",
            });
            return;
          }

          sendJson(res, 500, {
            success: false,
            recipes: [],
            message: "AZURE_OPENAI_ENDPOINT/API_KEY/DEPLOYMENT 설정이 필요합니다.",
          });
          return;
        }

        const ingredients = Array.isArray(payload?.ingredients)
          ? payload.ingredients.filter((item) => typeof item === "string" && item.trim())
          : [];

        if (!ingredients.length) {
          sendJson(res, 400, {
            success: false,
            recipes: [],
            message: "ingredients 배열이 필요합니다.",
          });
          return;
        }

        const recipes = await recommendRecipesWithAi(ingredients, desiredCount, preferences);
        sendJson(res, 200, {
          success: true,
          ingredients,
          preferences,
          recipes,
          message: "요리 추천 생성 완료",
        });
      })
      .catch((error) => {
        sendJson(res, 500, {
          success: false,
          recipes: [],
          message: `추천 처리 중 오류: ${error.message}`,
        });
      });

    return;
  }

  sendJson(res, 404, {
    success: false,
    ingredients: [],
    message: "요청 경로를 찾을 수 없습니다.",
  });
});

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk.toString();
      if (raw.length > 10 * 1024 * 1024) {
        reject(new Error("요청 크기가 너무 큽니다."));
      }
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("JSON 형식이 올바르지 않습니다."));
      }
    });

    req.on("error", () => {
      reject(new Error("요청을 읽는 중 오류가 발생했습니다."));
    });
  });
}

async function recognizeIngredientsWithAi(imageDataUrl) {
  const prompt = [
    "다음 이미지는 냉장고 또는 식재료 사진이다.",
    "사진에서 보이는 식재료 이름만 추출하라.",
    "반드시 JSON만 반환하라.",
    "형식: {\"ingredients\":[\"계란\",\"양파\"]}",
    "중복 제거, 한국어 명사, 최대 15개",
  ].join(" ");

  const content = await callOpenAi([
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: imageDataUrl } },
  ]);

  const parsed = parseJsonFromText(content);
  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.filter((item) => typeof item === "string" && item.trim())
    : [];

  return ingredients.slice(0, 15);
}

async function recommendRecipesWithAi(ingredients, desiredCount, preferences) {
  const cuisinePreference = preferences.cuisine ? JSON.stringify(preferences.cuisine) : "제한 없음";
  const stylePreference = preferences.style ? JSON.stringify(preferences.style) : "제한 없음";
  const spicinessPreference = preferences.spiciness ? JSON.stringify(preferences.spiciness) : "제한 없음";
  const cookingTimePreference = preferences.cookingTime ? JSON.stringify(preferences.cookingTime) : "시간 제한 없음";
  const prompt = [
    `입력 재료로 만들 수 있는 요리 ${desiredCount}개를 추천하라.`,
    `입력 재료: ${ingredients.join(", ")}`,
    `선호 음식 종류: ${cuisinePreference}`,
    `선호 요리 스타일: ${stylePreference}`,
    `선호 맵기: ${spicinessPreference}`,
    `조리 가능 시간: ${cookingTimePreference}`,
    "사용자가 입력한 음식 종류, 스타일, 맵기와 시간은 메뉴 선택 조건으로만 해석하라.",
    "각 레시피에는 현재 보유한 재료뿐 아니라 요리에 필요한 전체 재료를 빠짐없이 포함하라. 보유하지 않은 필수 재료도 절대 생략하지 마라.",
    "필수 재료는 requiredIngredients 배열에 전부 작성하고, 선택 재료나 선택 양념만 optionalIngredients 배열로 분리하라.",
    "time은 재료 손질 시간과 실제 조리 시간을 합산한 총 예상 시간이며 분 단위로 표시하라.",
    ...(preferences.timeLimitMinutes === null
      ? []
      : [`총 예상 시간이 ${preferences.timeLimitMinutes}분을 넘는 요리는 추천하지 마라.`]),
    ...(shouldPrioritizeQuickly(preferences)
      ? ["시간이 부족한 사용자를 위해 총 예상 시간이 짧은 요리부터 빠른 순서대로 추천하라."]
      : []),
    "선택된 취향을 가능한 한 우선 반영하고, 선택하지 않은 항목은 제한으로 적용하지 마라.",
    "반드시 JSON만 반환하라.",
    "각 레시피에 재료 목록(ingredients)과 조리 순서(steps)를 반드시 포함하라.",
    `형식: {\"recipes\":[{\"name\":\"\",\"description\":\"\",\"time\":\"15분\",\"difficulty\":\"쉬움\",\"ingredients\":[\"계란 2개\",\"밀가루 1컵\"],\"requiredIngredients\":[\"계란 2개\",\"밀가루 1컵\"],\"optionalIngredients\":[\"파슬리 약간\"],\"steps\":[\"재료를 손질한다\",\"팬에 볶는다\"]}]} (recipes 길이 정확히 ${desiredCount})`,
  ].join(" ");

  const content = await callOpenAi([{ type: "text", text: prompt }]);
  const parsed = parseJsonFromText(content);
  const recipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];
  const timeFilteredRecipes = filterRecipesByTime(
    recipes.map((recipe) => normalizeRecipe(recipe, ingredients)),
    preferences.timeLimitMinutes,
  );
  const orderedRecipes = shouldPrioritizeQuickly(preferences)
    ? sortRecipesByTime(timeFilteredRecipes)
    : timeFilteredRecipes;

  return orderedRecipes.slice(0, desiredCount);
}

function normalizePreferences(value) {
  const cuisine = normalizePreferenceText(value?.cuisine);
  const style = normalizePreferenceText(value?.style);
  const spiciness = normalizePreferenceText(value?.spiciness);
  const cookingTime = normalizePreferenceText(value?.cookingTime);

  return {
    cuisine,
    style,
    spiciness,
    cookingTime,
    timeLimitMinutes: parseCookingTimeLimit(cookingTime),
  };
}

function normalizePreferenceText(value) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}

function parseCookingTimeLimit(value) {
  const time = String(value || "").toLowerCase();
  if (!time || /제한\s*없|상관\s*없|무제한|시간\s*없/.test(time)) {
    return null;
  }

  const hourMatch = time.match(/(\d+(?:\.\d+)?|한|두|세)\s*시간/);
  const hourValue = hourMatch ? ({ 한: 1, 두: 2, 세: 3 }[hourMatch[1]] || Number(hourMatch[1])) : 0;
  const minutes = Number(time.match(/(\d+(?:\.\d+)?)\s*분/)?.[1] || 0);
  const plainMinutes = Number(time.match(/^\s*(\d{1,3})\s*$/)?.[1] || 0);
  const totalMinutes = hourValue * 60 + minutes || plainMinutes;

  return totalMinutes > 0 && totalMinutes <= 240 ? totalMinutes : null;
}

function matchesPreferences(recipe, preferences) {
  const cuisineQuery = preferences.cuisine.replace(/일본/g, "일식").replace(/중국/g, "중식").replace(/한국/g, "한식");
  const requestedCuisines = SUPPORTED_CUISINES.filter((cuisine) => cuisineQuery.includes(cuisine));
  const styleKeywords = {
    "간단하고 빠른 요리": ["간단", "빠른"],
    "건강한 요리": ["건강", "영양"],
    "든든한 요리": ["든든", "포만"],
    "저칼로리 요리": ["저칼로리", "가벼운"],
    "매콤한 요리": ["매콤", "매운"],
    "색다르고 특별한 요리": ["색다", "특별", "새로운"],
  };
  const requestedStyles = SUPPORTED_STYLES.filter((supportedStyle) =>
    styleKeywords[supportedStyle].some((keyword) => preferences.style.includes(keyword))
  );
  const matchesCuisine = !requestedCuisines.length || requestedCuisines.includes(recipe.cuisine);
  const matchesStyle = !requestedStyles.length || requestedStyles.some((style) => recipe.styles.includes(style));
  const matchesSpiciness = matchesSpicinessPreference(recipe, preferences.spiciness);

  return matchesCuisine && matchesStyle && matchesSpiciness;
}

function matchesSpicinessPreference(recipe, preference) {
  const text = preference.toLowerCase();
  if (!text || /상관없|제한없|무관/.test(text)) {
    return true;
  }
  if (/순한|덜\s*매운|안\s*맵|맵지\s*않/.test(text)) {
    return recipe.spiciness === "mild";
  }
  if (/보통|중간/.test(text)) {
    return recipe.spiciness === "medium";
  }
  if (/매운|매콤|얼큰|화끈/.test(text)) {
    return recipe.spiciness === "hot";
  }

  return true;
}

function rankRecipesByTextPreferences(recipes, preferences) {
  const aliases = { "일본": "일식", "중국": "중식", "한국": "한식" };
  const ignoredTerms = new Set(["요리", "음식", "추천", "원해", "원하는", "만들어", "주세요"]);
  const terms = [preferences.cuisine, preferences.style, preferences.spiciness]
    .join(" ")
    .toLowerCase()
    .split(/[\s,，、.]+/)
    .map((term) => term.replace(/[이가은는을를의에로와과]$/, ""))
    .filter((term) => term.length > 1 && !ignoredTerms.has(term))
    .map((term) => aliases[term] || term);

  if (!terms.length) {
    return recipes;
  }

  const score = (recipe) => {
    const spiceLabels = { mild: "순한 맛", medium: "보통 맛", hot: "매운맛" };
    const searchableText = [
      recipe.name,
      recipe.description,
      recipe.cuisine,
      spiceLabels[recipe.spiciness],
      recipe.time,
      ...recipe.styles,
      ...recipe.ingredients,
    ]
      .join(" ")
      .toLowerCase();
    return terms.reduce((total, term) => total + Number(searchableText.includes(term)), 0);
  };

  return [...recipes].sort((first, second) => score(second) - score(first));
}

function normalizeIngredientName(value) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^(다진|채 썬|썬|으깬|삶은|구운)\s*/, "")
    .replace(/\s*(?:\d+(?:[./]\d+)?\s*)?(?:kg|g|ml|l|개|알|장|쪽|줄기|컵|큰술|작은술|스푼|줌|토막|꼬집|공기|봉|팩).*$/i, "")
    .replace(/\s*(?:약간|적당량|조금)$/, "")
    .replace(/\s+/g, "");
  const aliases = {
    "달걀": "계란",
    "대파": "파",
    "쪽파": "파",
    "실파": "파",
    "쌀밥": "밥",
    "흰쌀밥": "밥",
    "올리브오일": "올리브유",
  };

  return aliases[cleaned] || cleaned;
}

function calculateIngredientUtilization(recipeIngredients, availableIngredients) {
  const inventory = new Set(availableIngredients.map(normalizeIngredientName));
  const uniqueRequiredIngredients = new Map();

  recipeIngredients.forEach((ingredient) => {
    const normalized = normalizeIngredientName(ingredient);
    if (normalized && !uniqueRequiredIngredients.has(normalized)) {
      uniqueRequiredIngredients.set(normalized, ingredient);
    }
  });

  const requiredIngredients = [...uniqueRequiredIngredients.entries()];
  const availableRecipeIngredients = requiredIngredients
    .filter(([normalized]) => inventory.has(normalized))
    .map(([, ingredient]) => ingredient);
  const missingIngredients = requiredIngredients
    .filter(([normalized]) => !inventory.has(normalized))
    .map(([, ingredient]) => ingredient);
  const substitutions = missingIngredients.map((missingIngredient) => {
    const normalized = normalizeIngredientName(missingIngredient);
    const alternatives = INGREDIENT_SUBSTITUTIONS[normalized] || [];

    return {
      missingIngredient,
      alternatives,
      availableAlternatives: alternatives.filter((alternative) => inventory.has(normalizeIngredientName(alternative))),
    };
  });

  return {
    utilizationRate: requiredIngredients.length
      ? Math.round((availableRecipeIngredients.length / requiredIngredients.length) * 100)
      : 0,
    availableIngredients: availableRecipeIngredients,
    missingIngredients,
    substitutions,
  };
}

function parseRecipeTimeMinutes(value) {
  const time = String(value || "");
  const hours = Number(time.match(/(\d+)\s*시간/)?.[1] || 0);
  const minutes = Number(time.match(/(\d+)\s*분/)?.[1] || 0);

  if (hours === 0 && minutes === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return hours * 60 + minutes;
}

function filterRecipesByTime(recipes, timeLimitMinutes) {
  if (timeLimitMinutes === null) {
    return recipes;
  }

  return recipes.filter((recipe) => parseRecipeTimeMinutes(recipe.time) <= timeLimitMinutes);
}

function shouldPrioritizeQuickly(preferences) {
  return preferences.timeLimitMinutes !== null && preferences.timeLimitMinutes <= 20;
}

function sortRecipesByTime(recipes) {
  return [...recipes].sort((first, second) => parseRecipeTimeMinutes(first.time) - parseRecipeTimeMinutes(second.time));
}

function normalizeDesiredCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 5;
  }

  return Math.min(10, Math.max(3, parsed));
}

function normalizeRecipe(recipe, availableIngredients = []) {
  const baseIngredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.filter((item) => typeof item === "string" && item.trim())
    : [];
  const providedRequiredIngredients = Array.isArray(recipe.requiredIngredients)
    ? recipe.requiredIngredients.filter((item) => typeof item === "string" && item.trim())
    : [];
  const requiredIngredients = providedRequiredIngredients.length ? providedRequiredIngredients : baseIngredients;

  const baseSteps = Array.isArray(recipe.steps)
    ? recipe.steps.filter((item) => typeof item === "string" && item.trim())
    : [];

  const description = String(recipe.description || "설명 없음");
  const ingredientUtilization = calculateIngredientUtilization(requiredIngredients, availableIngredients);

  return {
    name: String(recipe.name || "이름 없는 요리"),
    description,
    time: String(recipe.time || "미정"),
    difficulty: String(recipe.difficulty || "미정"),
    ...ingredientUtilization,
    requiredIngredients,
    ingredients: baseIngredients.length
      ? baseIngredients
      : requiredIngredients.length
        ? requiredIngredients
        : ["기본 재료", "소금 약간"],
    steps: baseSteps.length
      ? baseSteps
      : [
          "재료를 손질합니다.",
          "팬이나 냄비에 넣고 중불에서 익힙니다.",
          "간을 맞춰 완성합니다.",
        ],
  };
}

async function callOpenAi(content) {
  const endpoint = AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const url = `${endpoint}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify({
      temperature: 0.2,
      messages: [{ role: "user", content }],
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    const reason = body?.error?.message || `OpenAI 요청 실패 (${response.status})`;
    throw new Error(reason);
  }

  const text = body?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("AI 응답 텍스트가 비어 있습니다.");
  }

  return text;
}

function isAzureConfigured() {
  return Boolean(
    AZURE_OPENAI_ENDPOINT &&
      AZURE_OPENAI_API_KEY &&
      AZURE_OPENAI_DEPLOYMENT
  );
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
    }
    return JSON.parse(match[0]);
  }
}

server.listen(PORT, () => {
  console.log(`food cleaner api started: http://localhost:${PORT}`);
});
