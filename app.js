const API_BASE_URL = resolveApiBaseUrl();
const UPLOAD_API_ENDPOINT = `${API_BASE_URL}/upload`;
const RECOMMEND_API_ENDPOINT = `${API_BASE_URL}/recommend`;

function resolveApiBaseUrl() {
  const configuredBaseUrl = typeof window.FOOD_CLEANER_API_BASE_URL === "string"
    ? window.FOOD_CLEANER_API_BASE_URL.trim()
    : "";

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  const { protocol, hostname, port, origin } = window.location;
  const isLocalStaticServer =
    (hostname === "localhost" || hostname === "127.0.0.1") && port === "8000";

  if (isLocalStaticServer) {
    return `${protocol}//${hostname}:3000`;
  }

  return origin.replace(/\/$/, "");
}

const openCameraButton = document.getElementById("openCameraButton");
const openGalleryButton = document.getElementById("openGalleryButton");
const cameraInput = document.getElementById("cameraInput");
const galleryInput = document.getElementById("galleryInput");
const cameraPanel = document.getElementById("cameraPanel");
const cameraVideo = document.getElementById("cameraVideo");
const cameraCanvas = document.getElementById("cameraCanvas");
const capturePhotoButton = document.getElementById("capturePhotoButton");
const closeCameraButton = document.getElementById("closeCameraButton");
const previewArea = document.getElementById("previewArea");
const metaText = document.getElementById("metaText");
const uploadButton = document.getElementById("uploadButton");
const resetButton = document.getElementById("resetButton");
const statusText = document.getElementById("statusText");
const ingredientsText = document.getElementById("ingredientsText");
const ingredientInput = document.getElementById("ingredientInput");
const addIngredientButton = document.getElementById("addIngredientButton");
const recommendButton = document.getElementById("recommendButton");
const recipeCountSelect = document.getElementById("recipeCountSelect");

let selectedFile = null;
let previewUrl = null;
let recognizedIngredients = [];
let activeCameraStream = null;

openCameraButton.addEventListener("click", openCameraFlow);
openGalleryButton.addEventListener("click", () => galleryInput.click());
capturePhotoButton.addEventListener("click", capturePhotoFromCamera);
closeCameraButton.addEventListener("click", closeCameraFlow);

cameraInput.addEventListener("change", (event) => onFileSelected(event.target.files));
galleryInput.addEventListener("change", (event) => onFileSelected(event.target.files));

uploadButton.addEventListener("click", uploadSelectedFile);
resetButton.addEventListener("click", resetSelection);
addIngredientButton.addEventListener("click", addIngredientFromInput);
ingredientInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addIngredientFromInput();
  }
});
recommendButton.addEventListener("click", requestRecipeRecommendation);

function onFileSelected(files) {
  if (!files || files.length === 0) {
    return;
  }

  const file = files[0];
  if (!file.type.startsWith("image/")) {
    setStatus("이미지 파일만 선택할 수 있습니다.", true);
    return;
  }

  selectedFile = file;
  renderPreview(file);
  renderMeta(file);
  uploadButton.disabled = false;
  resetButton.disabled = false;
  setStatus("이미지 선택 완료. 업로드 버튼을 눌러 전송하세요.", false);
}

function renderPreview(file) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = URL.createObjectURL(file);
  const img = document.createElement("img");
  img.src = previewUrl;
  img.alt = "선택한 냉장고 사진";

  previewArea.classList.remove("empty");
  previewArea.innerHTML = "";
  previewArea.appendChild(img);
}

function renderMeta(file) {
  const kb = Math.round(file.size / 1024);
  metaText.textContent = `파일명: ${file.name} | 형식: ${file.type} | 크기: ${kb}KB`;
}

function resetSelection() {
  selectedFile = null;
  closeCameraFlow();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  previewArea.classList.add("empty");
  previewArea.innerHTML = "<p>아직 선택된 이미지가 없습니다.</p>";
  metaText.textContent = "파일 정보 없음";
  uploadButton.disabled = true;
  resetButton.disabled = true;
  cameraInput.value = "";
  galleryInput.value = "";
  renderIngredients([]);
  recommendButton.disabled = true;
  setStatus("초기화 완료", false);
}

async function openCameraFlow() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("이 브라우저는 카메라 촬영을 지원하지 않습니다. 앨범에서 선택을 사용해 주세요.", true);
    return;
  }

  try {
    closeCameraFlow();
    activeCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });

    cameraVideo.srcObject = activeCameraStream;
    cameraPanel.hidden = false;
    setStatus("카메라가 켜졌습니다. 촬영 버튼을 눌러주세요.", false);
  } catch (error) {
    setStatus("카메라 접근이 거부되었습니다. 브라우저 주소창의 카메라 권한을 허용해 주세요.", true);
  }
}

function closeCameraFlow() {
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach((track) => track.stop());
    activeCameraStream = null;
  }

  cameraVideo.srcObject = null;
  cameraPanel.hidden = true;
}

function capturePhotoFromCamera() {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    setStatus("카메라 화면이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.", true);
    return;
  }

  const width = cameraVideo.videoWidth;
  const height = cameraVideo.videoHeight;
  cameraCanvas.width = width;
  cameraCanvas.height = height;

  const context = cameraCanvas.getContext("2d");
  context.drawImage(cameraVideo, 0, 0, width, height);

  const dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.92);
  selectedFile = dataUrlToFile(dataUrl, `captured-${Date.now()}.jpg`);
  renderPreview(selectedFile);
  renderMeta(selectedFile);
  uploadButton.disabled = false;
  resetButton.disabled = false;
  closeCameraFlow();
  setStatus("촬영 완료. 업로드 버튼을 눌러 전송하세요.", false);
}

async function uploadSelectedFile() {
  if (!selectedFile) {
    setStatus("먼저 이미지를 선택해 주세요.", true);
    return;
  }

  setStatus("업로드 중...", false);
  uploadButton.disabled = true;

  try {
    const imageDataUrl = await fileToDataUrl(selectedFile);

    const response = await fetch(UPLOAD_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageDataUrl }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const errorMessage = errorPayload.message || `서버 오류: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    renderIngredients(data.ingredients || []);
    setStatus("업로드 및 인식 완료. 필요하면 재료를 수정해 주세요.", false);
  } catch (error) {
    setStatus(`업로드 실패 (${error.message})`, true);
  } finally {
    uploadButton.disabled = false;
  }
}

function setStatus(message, isError) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#b42318" : "#175cd3";
}

function renderIngredients(ingredients) {
  recognizedIngredients = Array.isArray(ingredients) ? [...ingredients] : [];

  if (!ingredients || ingredients.length === 0) {
    ingredientsText.className = "ingredients-empty";
    ingredientsText.textContent = "아직 인식 결과가 없습니다.";
    recommendButton.disabled = true;
    return;
  }

  const list = document.createElement("div");
  list.className = "tag-list";

  ingredients.forEach((item, index) => {
    const tag = document.createElement("div");
    tag.className = "tag";

    const label = document.createElement("span");
    label.textContent = item;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "x";
    removeButton.addEventListener("click", () => removeIngredient(index));

    tag.appendChild(label);
    tag.appendChild(removeButton);
    list.appendChild(tag);
  });

  ingredientsText.className = "";
  ingredientsText.textContent = "";
  ingredientsText.appendChild(list);
  recommendButton.disabled = false;
}

function removeIngredient(index) {
  recognizedIngredients = recognizedIngredients.filter((_, idx) => idx !== index);
  renderIngredients(recognizedIngredients);
}

function addIngredientFromInput() {
  const value = ingredientInput.value.trim();
  if (!value) {
    return;
  }

  recognizedIngredients.push(value);
  ingredientInput.value = "";
  renderIngredients(recognizedIngredients);
}

async function requestRecipeRecommendation() {
  if (!recognizedIngredients.length) {
    setStatus("추천 전에 재료를 1개 이상 준비해 주세요.", true);
    return;
  }

  recommendButton.disabled = true;
  setStatus("요리 추천 생성 중...", false);

  try {
    const desiredCount = Number.parseInt(recipeCountSelect.value, 10) || 5;

    const response = await fetch(RECOMMEND_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ingredients: recognizedIngredients,
        desiredCount,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const errorMessage = errorPayload.message || `서버 오류: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    sessionStorage.setItem("foodCleanerRecommendations", JSON.stringify(data));
    window.location.href = "recipes.html";
  } catch (error) {
    setStatus(`추천 실패 (${error.message})`, true);
    recommendButton.disabled = false;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("이미지 읽기에 실패했습니다."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl, filename) {
  const [header, body] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(body);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}
