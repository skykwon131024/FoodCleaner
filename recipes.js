const backButton = document.getElementById("backButton");
const ingredientSummary = document.getElementById("ingredientSummary");
const recipeList = document.getElementById("recipeList");

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
  renderRecipes(data.recipes || []);
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

function renderRecipes(recipes) {
  recipeList.innerHTML = "";
  if (!recipes.length) {
    recipeList.innerHTML = "<p class=\"ingredients-empty\">추천된 요리가 없습니다.</p>";
    return;
  }

  recipes.forEach((recipe) => {
    const card = document.createElement("article");
    card.className = "recipe-card";

    const title = document.createElement("h3");
    title.textContent = recipe.name || "이름 없는 요리";

    const desc = document.createElement("p");
    desc.className = "recipe-meta";
    desc.textContent = recipe.description || "설명 없음";

    const info = document.createElement("p");
    info.className = "recipe-meta";
    info.textContent = `예상 시간: ${recipe.time || "미정"} / 난이도: ${recipe.difficulty || "미정"}`;

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

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(info);
    card.appendChild(hint);
    card.appendChild(detail);
    recipeList.appendChild(card);
  });
}

loadData();
