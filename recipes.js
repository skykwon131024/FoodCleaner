const backButton = document.getElementById("backButton");
const ingredientSummary = document.getElementById("ingredientSummary");
const recipeList = document.getElementById("recipeList");
const utilizationFilter = document.getElementById("utilizationFilter");
const recipeSortSelect = document.getElementById("recipeSortSelect");
let allRecipes = [];

utilizationFilter.addEventListener("change", renderRecipeCards);
recipeSortSelect.addEventListener("change", renderRecipeCards);

backButton.addEventListener("click", () => {
  window.location.href = "index.html";
});

function loadData() {
  const raw = sessionStorage.getItem("foodCleanerRecommendations");
  if (!raw) {
    recipeList.innerHTML = "<p class=\"ingredients-empty\">추천 데이터가 없습니다. 이전 화면에서 다시 시도해 주세요.</p>";
    return;
  }

  const data = JSON.parse(raw);
  renderIngredientSummary(data.ingredients || []);
  renderRecipes(data.recipes || [], data.preferences || {});
}

function renderIngredientSummary(ingredients) {
  ingredientSummary.innerHTML = "";
  if (!ingredients.length) {
    ingredientSummary.innerHTML = "<p class=\"ingredients-empty\">재료 정보가 없습니다.</p>";
    return;
  }

  ingredients.forEach((item) => {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.textContent = item;
    ingredientSummary.appendChild(tag);
  });
}

function renderRecipes(recipes, preferences) {
  allRecipes = Array.isArray(recipes) ? recipes : [];
  recipeSortSelect.value = preferences.timeLimitMinutes !== null && preferences.timeLimitMinutes <= 20
    ? "time"
    : "utilization";
  renderRecipeCards();
}

function renderRecipeCards() {
  const minimumUtilization = Number.parseInt(utilizationFilter.value, 10) || 0;
  const recipes = allRecipes
    .filter((recipe) => Number(recipe.utilizationRate) >= minimumUtilization)
    .sort((first, second) => {
      if (recipeSortSelect.value === "time") {
        return getRecipeTimeMinutes(first.time) - getRecipeTimeMinutes(second.time);
      }

      return Number(second.utilizationRate) - Number(first.utilizationRate);
    });

  recipeList.innerHTML = "";
  if (!recipes.length) {
    recipeList.innerHTML = "<p class=\"ingredients-empty\">선택한 활용률 기준에 맞는 요리가 없습니다.</p>";
    return;
  }

  recipes.forEach((recipe) => {
    const card = document.createElement("article");
    card.className = "recipe-card";

    const title = document.createElement("h3");
    title.textContent = recipe.name || "이름 없는 요리";

    const utilization = document.createElement("span");
    utilization.className = "recipe-utilization";
    utilization.textContent = `${Number(recipe.utilizationRate) || 0}% 활용`;

    const desc = document.createElement("p");
    desc.className = "recipe-meta";
    desc.textContent = recipe.description || "설명 없음";

    const info = document.createElement("p");
    info.className = "recipe-meta";
    info.textContent = `총 소요 시간(손질 포함): ${recipe.time || "미정"} / 난이도: ${recipe.difficulty || "미정"}`;

    const ingredientStatus = document.createElement("div");
    ingredientStatus.className = "recipe-ingredient-status";

    const availableLine = document.createElement("p");
    availableLine.className = "recipe-meta";
    availableLine.textContent = `보유 재료: ${(recipe.availableIngredients || []).join(", ") || "없음"}`;

    const missingIngredients = Array.isArray(recipe.missingIngredients) ? recipe.missingIngredients : [];
    const missingLine = document.createElement("p");
    missingLine.className = "recipe-meta";
    missingLine.textContent = missingIngredients.length
      ? `부족 재료: ${missingIngredients.join(", ")}`
      : "부족 재료 없음";

    ingredientStatus.appendChild(availableLine);
    ingredientStatus.appendChild(missingLine);

    const substitutions = Array.isArray(recipe.substitutions) ? recipe.substitutions : [];
    substitutions.forEach((substitution) => {
      const substituteLine = document.createElement("p");
      substituteLine.className = "recipe-meta";
      const alternatives = Array.isArray(substitution.alternatives) ? substitution.alternatives : [];
      const availableAlternatives = Array.isArray(substitution.availableAlternatives)
        ? substitution.availableAlternatives
        : [];
      const suggestion = alternatives.length ? alternatives.join(", ") : "추천 대체 재료 없음";
      const availableSuggestion = availableAlternatives.length
        ? ` / 보유 중: ${availableAlternatives.join(", ")}`
        : "";
      substituteLine.textContent = `${substitution.missingIngredient} 대체: ${suggestion}${availableSuggestion}`;
      ingredientStatus.appendChild(substituteLine);
    });

    const hint = document.createElement("p");
    hint.className = "recipe-hint";
    hint.textContent = "레시피를 클릭하면 조리방법을 볼 수 있습니다.";

    const detail = document.createElement("section");
    detail.className = "recipe-detail";

    const ingredientTitle = document.createElement("h4");
    ingredientTitle.textContent = "재료";

    const ingredientList = document.createElement("ul");
    ingredientList.className = "recipe-detail-list";
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    ingredients.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      ingredientList.appendChild(li);
    });

    const stepTitle = document.createElement("h4");
    stepTitle.textContent = "조리방법";

    const stepList = document.createElement("ol");
    stepList.className = "recipe-detail-list";
    const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
    steps.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      stepList.appendChild(li);
    });

    detail.appendChild(ingredientTitle);
    detail.appendChild(ingredientList);
    detail.appendChild(stepTitle);
    detail.appendChild(stepList);

    card.addEventListener("click", () => {
      card.classList.toggle("open");
    });

    card.appendChild(utilization);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(info);
    card.appendChild(ingredientStatus);
    card.appendChild(hint);
    card.appendChild(detail);
    recipeList.appendChild(card);
  });
}

function getRecipeTimeMinutes(value) {
  const time = String(value || "");
  const hours = Number(time.match(/(\d+)\s*시간/)?.[1] || 0);
  const minutes = Number(time.match(/(\d+)\s*분/)?.[1] || 0);
  return hours * 60 + minutes || Number.POSITIVE_INFINITY;
}

loadData();
