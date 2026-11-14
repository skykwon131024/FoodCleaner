const backButton = document.getElementById("backButton");
const ingredientSummary = document.getElementById("ingredientSummary");
const recipeList = document.getElementById("recipeList");
const utilizationFilter = document.getElementById("utilizationFilter");
const recipeSortSelect = document.getElementById("recipeSortSelect");
const shoppingListItems = document.getElementById("shoppingListItems");
const shoppingListCount = document.getElementById("shoppingListCount");
const clearCompletedShoppingButton = document.getElementById("clearCompletedShoppingButton");
const shoppingListStorageKey = "foodCleanerShoppingList";
let shoppingItems = loadShoppingItems();
let allRecipes = [];

utilizationFilter.addEventListener("change", renderRecipeCards);
recipeSortSelect.addEventListener("change", renderRecipeCards);
clearCompletedShoppingButton.addEventListener("click", clearCompletedShoppingItems);

backButton.addEventListener("click", () => {
  window.location.href = "index.html";
});

function loadData() {
  renderShoppingList();
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

    if (missingIngredients.length) {
      const addMissingIngredientsButton = document.createElement("button");
      addMissingIngredientsButton.type = "button";
      addMissingIngredientsButton.className = "btn shopping-list-action";
      addMissingIngredientsButton.textContent = "부족 재료 장보기 목록에 담기";
      addMissingIngredientsButton.addEventListener("click", (event) => {
        event.stopPropagation();
        addMissingIngredientsToShoppingList(recipe);
      });
      ingredientStatus.appendChild(addMissingIngredientsButton);
    }

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

function loadShoppingItems() {
  try {
    const storedItems = JSON.parse(localStorage.getItem(shoppingListStorageKey) || "[]");
    if (!Array.isArray(storedItems)) {
      return [];
    }

    return storedItems.filter((item) => item && typeof item.key === "string" && typeof item.name === "string");
  } catch {
    return [];
  }
}

function saveShoppingItems() {
  localStorage.setItem(shoppingListStorageKey, JSON.stringify(shoppingItems));
  renderShoppingList();
}

function splitShoppingIngredient(value) {
  const ingredient = String(value || "").trim();
  const match = ingredient.match(/^(.+?)\s+((?:\d+(?:[./]\d+)?\s*)?(?:kg|g|ml|l|개|알|장|쪽|줄기|컵|큰술|작은술|스푼|줌|토막|꼬집|공기|봉|팩|약간|적당량|조금).*)$/i);

  return match
    ? { name: match[1].trim(), amount: match[2].trim() }
    : { name: ingredient, amount: "" };
}

function addMissingIngredientsToShoppingList(recipe) {
  const missingIngredients = Array.isArray(recipe.missingIngredients) ? recipe.missingIngredients : [];

  missingIngredients.forEach((ingredient) => {
    const { name, amount } = splitShoppingIngredient(ingredient);
    if (!name) {
      return;
    }

    const key = name.toLocaleLowerCase().replace(/\s+/g, "");
    let shoppingItem = shoppingItems.find((item) => item.key === key);
    if (!shoppingItem) {
      shoppingItem = { key, name, amounts: [], sources: [], checked: false };
      shoppingItems.push(shoppingItem);
    }

    if (amount && !shoppingItem.amounts.includes(amount)) {
      shoppingItem.amounts.push(amount);
    }
    if (!shoppingItem.sources.includes(recipe.name)) {
      shoppingItem.sources.push(recipe.name);
    }
  });

  saveShoppingItems();
}

function renderShoppingList() {
  shoppingListItems.innerHTML = "";
  const completedCount = shoppingItems.filter((item) => item.checked).length;
  shoppingListCount.textContent = `${shoppingItems.length}개 · ${completedCount}개 구매 완료`;
  clearCompletedShoppingButton.disabled = completedCount === 0;

  if (!shoppingItems.length) {
    const emptyState = document.createElement("li");
    emptyState.className = "shopping-list-empty";
    emptyState.textContent = "레시피에서 부족한 재료를 담아보세요.";
    shoppingListItems.appendChild(emptyState);
    return;
  }

  shoppingItems.forEach((item) => {
    const row = document.createElement("li");
    row.className = item.checked ? "shopping-item is-checked" : "shopping-item";

    const itemLabel = document.createElement("label");
    itemLabel.className = "shopping-item-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.checked);
    checkbox.setAttribute("aria-label", `${item.name} 구매 완료`);
    checkbox.addEventListener("change", () => {
      shoppingItems = shoppingItems.map((shoppingItem) =>
        shoppingItem.key === item.key ? { ...shoppingItem, checked: checkbox.checked } : shoppingItem
      );
      saveShoppingItems();
    });

    const name = document.createElement("span");
    const amounts = Array.isArray(item.amounts) ? item.amounts : [];
    name.textContent = `${item.name}${amounts.length ? ` (${amounts.join(" + ")})` : ""}`;

    itemLabel.appendChild(checkbox);
    itemLabel.appendChild(name);

    const details = document.createElement("div");
    details.className = "shopping-item-details";
    const sources = document.createElement("small");
    sources.textContent = `필요한 요리: ${(item.sources || []).join(", ") || "직접 추가"}`;
    details.appendChild(sources);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn shopping-remove-button";
    removeButton.textContent = "삭제";
    removeButton.setAttribute("aria-label", `${item.name} 장보기 항목 삭제`);
    removeButton.addEventListener("click", () => {
      shoppingItems = shoppingItems.filter((shoppingItem) => shoppingItem.key !== item.key);
      saveShoppingItems();
    });

    row.appendChild(itemLabel);
    row.appendChild(details);
    row.appendChild(removeButton);
    shoppingListItems.appendChild(row);
  });
}

function clearCompletedShoppingItems() {
  shoppingItems = shoppingItems.filter((item) => !item.checked);
  saveShoppingItems();
}

loadData();
