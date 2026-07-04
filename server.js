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
              },
              {
                name: "우유 계란찜",
                description: "우유를 넣어 더 부드럽게 만드는 전자레인지 계란찜",
                time: "8분",
                difficulty: "쉬움",
              },
              {
                name: "양파 오믈렛",
                description: "양파를 먼저 볶아 단맛을 살린 오믈렛",
                time: "15분",
                difficulty: "보통",
              },
              {
                name: "계란 샐러드",
                description: "삶은 계란과 양파를 곁들인 가벼운 샐러드",
                time: "12분",
                difficulty: "쉬움",
              },
              {
                name: "우유 프렌치토스트",
                description: "우유와 계란물을 입혀 구워내는 토스트",
                time: "14분",
                difficulty: "보통",
              },
              {
                name: "양파 수프",
                description: "양파의 단맛을 살린 따뜻한 수프",
                time: "20분",
                difficulty: "보통",
              },
              {
                name: "에그드롭 샌드위치",
                description: "부드러운 스크램블 에그를 넣은 샌드위치",
                time: "10분",
                difficulty: "쉬움",
              },
              {
                name: "양파 감자전",
                description: "양파를 넣어 감칠맛을 더한 전",
                time: "18분",
                difficulty: "보통",
              },
              {
                name: "우유 스크램블",
                description: "우유를 넣어 촉촉하게 만든 스크램블",
                time: "7분",
                difficulty: "쉬움",
              },
              {
                name: "계란 볶음밥",
                description: "계란과 양파를 활용한 기본 볶음밥",
                time: "13분",
                difficulty: "쉬움",
              },
            ];

            sendJson(res, 200, {
              success: true,
              ingredients: fallbackIngredients,
              recipes: mockRecipePool.slice(0, desiredCount).map((recipe) => normalizeRecipe(recipe)),
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

        const recipes = await recommendRecipesWithAi(ingredients, desiredCount);
        sendJson(res, 200, {
          success: true,
          ingredients,
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

async function recommendRecipesWithAi(ingredients, desiredCount) {
  const prompt = [
    `입력 재료로 만들 수 있는 요리 ${desiredCount}개를 추천하라.`,
    `입력 재료: ${ingredients.join(", ")}`,
    "반드시 JSON만 반환하라.",
    "각 레시피에 재료 목록(ingredients)과 조리 순서(steps)를 반드시 포함하라.",
    `형식: {\"recipes\":[{\"name\":\"\",\"description\":\"\",\"time\":\"15분\",\"difficulty\":\"쉬움\",\"ingredients\":[\"계란 2개\"],\"steps\":[\"재료를 손질한다\",\"팬에 볶는다\"]}]} (recipes 길이 정확히 ${desiredCount})`,
  ].join(" ");

  const content = await callOpenAi([{ type: "text", text: prompt }]);
  const parsed = parseJsonFromText(content);
  const recipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];

  return recipes.slice(0, desiredCount).map((recipe) => normalizeRecipe(recipe));
}

function normalizeDesiredCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 5;
  }

  return Math.min(10, Math.max(3, parsed));
}

function normalizeRecipe(recipe) {
  const baseIngredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.filter((item) => typeof item === "string" && item.trim())
    : [];

  const baseSteps = Array.isArray(recipe.steps)
    ? recipe.steps.filter((item) => typeof item === "string" && item.trim())
    : [];

  const description = String(recipe.description || "설명 없음");

  return {
    name: String(recipe.name || "이름 없는 요리"),
    description,
    time: String(recipe.time || "미정"),
    difficulty: String(recipe.difficulty || "미정"),
    ingredients: baseIngredients.length ? baseIngredients : ["기본 재료", "소금 약간"],
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
