# 🍽️ Food Cleaner - AI 기반 레시피 추천 앱

냉장고 식재료 사진을 찍으면 **AI가 추천해주는 요리 레시피** 앱입니다. 버려지는 식재료를 줄이고, 창의로운 요리 아이디어를 얻을 수 있습니다.

**배포 사이트:** 👉 [https://foodcleaner-33759.azurewebsites.net/](https://foodcleaner-33759.azurewebsites.net/)

**GitHub 저장소:** 👉 [https://github.com/skykwon131024/FoodCleaner](https://github.com/skykwon131024/FoodCleaner)

---

## 🎯 프로젝트 개요

### 문제 정의
냉장고에 사둔 식재료를 어떻게 활용할지 모르거나, 유통기한이 다가오면 그냥 버리게 되는 상황이 발생합니다. 특히 요리에 관심이 있어도 창의적인 요리 아이디어를 떠올리기 어려워 인터넷 검색을 해야 하는 번거로움이 있습니다.

### 핵심 기능
1. **사진 인식** - 냉장고 식재료 사진을 촬영/업로드하면 AI가 식재료를 자동 인식
2. **AI 요리 추천** - 인식된 식재료 기반으로 만들 수 있는 요리 추천 (원하는 개수 선택 가능)
3. **조리 방법 제공** - 각 요리의 상세한 재료 목록과 단계별 조리 방법 표시
4. **수동 입력** - 식재료를 직접 입력해서 요리 추천 받기도 가능

### 기대 효과
- 버려지는 식재료 감소
- 요리 아이디어 부족 해결
- 빠른 식사 준비 (단계별 조리 방법 제공)

---

## 💻 기술 스택

### 프론트엔드
- **HTML5** - 시맨틱 마크업
- **CSS3** - 반응형 디자인 (모바일/태블릿 지원)
- **Vanilla JavaScript** - 프레임워크 없이 순수 JavaScript
  - `getUserMedia` API - 카메라 촬영 기능
  - `Canvas API` - 이미지 캡처
  - `Fetch API` - 백엔드 통신

### 백엔드
- **Node.js** (v22 LTS, 최소 v18) - 런타임
- **Built-in HTTP 모듈** - 경량 웹 서버
  - 정적 파일 서빙 (HTML, CSS, JS)
  - REST API 엔드포인트 제공
- **Express-like 구조** - 간단한 라우팅 구현

### 클라우드 & AI
- **Azure App Service** (F1 Free Tier) - 호스팅
- **Azure OpenAI** - 요리 추천 AI
  - 배포명: gpt-4.1 (실제 모델은 배포 설정에 따라 결정)
  - API 버전: 2024-10-21

### DevOps
- **Azure CLI** - 배포 관리
- **Zip 배포** - 소스 코드 배포
- **Git** - 버전 관리

---

## 📁 폴더 구조

```
vibe_coding 1/
├── index.html              # 메인 페이지 (사진 촬영/재료 입력)
├── recipes.html            # 결과 페이지 (추천 요리 표시)
├── app.js                  # 프론트엔드 로직 (촬영/입력 처리)
├── recipes.js              # 결과 페이지 로직 (레시피 렌더링)
├── server.js               # 백엔드 서버 (API 엔드포인트)
├── style.css               # 전체 스타일시트
├── package.json            # Node.js 프로젝트 설정
├── .env                    # Azure 자격증명 (Git에 제외)
├── .env.example            # .env 템플릿
├── .gitignore              # Git 제외 파일 정의
├── plan.md                 # 개발 계획
├── 개발기획서.md            # 초기 프로젝트 기획
└── deploy.zip              # Azure 배포용 파일

```

---

## 🚀 시작하기

### 사전 요구 사항
- **Node.js** v18 이상 (권장: v22 LTS)
- **Azure 구독** (Azure OpenAI 리소스)
- **Git** (선택사항)

### 로컬 설치 및 실행

#### 1. 저장소 클론
```bash
git clone https://github.com/skykwon131024/FoodCleaner.git
cd FoodCleaner
```

#### 2. 환경 변수 설정
`.env.example`을 `.env`로 복사하고 Azure OpenAI 자격증명을 입력:
```bash
cp .env.example .env
```

`.env` 파일 내용:
```
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_API_VERSION=2024-10-21
PORT=3000
```

#### 3. 서버 실행
```bash
node server.js
```

#### 4. 브라우저 접속
```
http://localhost:3000
```

---

## 📡 API 엔드포인트

### POST `/upload`
**설명:** 업로드된 이미지에서 식재료 인식

**요청:**
```javascript
{
  "image": FormData with image file
}
```

**응답:**
```json
{
  "success": true,
  "ingredients": ["계란", "양파", "우유"],
  "message": "인식 완료"
}
```

### POST `/recommend`
**설명:** 식재료 기반 요리 추천

**요청:**
```json
{
  "ingredients": ["계란", "양파", "우유"],
  "desiredCount": 5
}
```

**응답:**
```json
{
  "success": true,
  "recipes": [
    {
      "name": "계란 스크램블",
      "description": "부드러운 우유와 양파가 들어간 기본 스크램블 에그",
      "time": "15분",
      "difficulty": "쉬움",
      "ingredients": ["계란 2개", "양파 1/4개", ...],
      "steps": ["양파를 잘게 다진다.", "계란을 풀어 섞는다.", ...]
    },
    ...
  ]
}
```

---

## 🎨 주요 기능 상세

### 1. 이미지 업로드 & 식재료 인식
- **사진 촬영:** `getUserMedia` API로 카메라에서 직접 촬영
- **갤러리 선택:** 파일 입력으로 앨범에서 선택
- **AI 인식:** Azure OpenAI가 이미지에서 식재료 자동 추출

### 2. 식재료 관리
- 인식 결과에 자동 추가
- 수동으로 재료 추가/삭제 가능
- 추천 개수 선택 (3~10개)

### 3. AI 요리 추천
- 각 요리마다 **상세 재료 목록** 제공
- **단계별 조리 방법** 표시
- 조리 시간과 난이도 정보

### 4. UI/UX
- **반응형 디자인** - 모바일/태블릿/데스크톱
- **클릭 확장:** 레시피 카드를 클릭하면 조리 방법 표시/숨김
- **실시간 피드백** - 상태 메시지로 진행 상황 표시

---

## 🔧 개발 정보

### 주요 기술 구현

#### 1. 카메라 기능 (app.js)
```javascript
async function openCameraFlow() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } }
  });
  cameraVideo.srcObject = stream;
}
```

#### 2. 이미지 업로드 (app.js)
```javascript
async function uploadSelectedFile() {
  const formData = new FormData();
  formData.append("image", selectedFile);
  const response = await fetch("/upload", { method: "POST", body: formData });
}
```

#### 3. 요리 추천 요청 (app.js)
```javascript
async function requestRecipeRecommendation() {
  const body = { ingredients: recognizedIngredients, desiredCount: count };
  const response = await fetch("/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
```

#### 4. Azure OpenAI 호출 (server.js)
```javascript
const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "api-key": process.env.AZURE_OPENAI_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 2000
  })
});
```

---

## 📊 배포 정보

### Azure 배포 구성
| 항목 | 정보 |
|------|------|
| **호스팅** | Azure App Service |
| **가격 계층** | F1 (무료) |
| **런타임** | Node.js 22 LTS (최소 v18) |
| **지역** | 한국 중부 (Korea Central) |
| **URL** | https://foodcleaner-33759.azurewebsites.net/ |

### 배포 방법
```bash
# 1. 배포 파일 생성
Compress-Archive -Path index.html,recipes.html,app.js,recipes.js,style.css,server.js,package.json -DestinationPath deploy.zip

# 2. Azure에 배포
az webapp deployment source config-zip --resource-group rg-foodcleaner --name foodcleaner-33759 --src deploy.zip
```

---

## 🔐 보안

### 환경 변수 관리
- `.env` 파일은 `.gitignore`에 포함 (Git에 업로드 안됨)
- Azure App Service의 **Application Settings**에서 별도 관리
- API 키는 클라이언트에 노출 안됨 (서버에서만 처리)

### 정적 파일 서빙
```javascript
// 경로 정규화 및 확장자 검증으로 보안 강화
const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
if (!normalizedPath.startsWith('./' ) && !allowedExtensions.includes(ext)) {
  return res.status(403).end();
}
```

---

## 📚 사용 방법

### 기본 사용 흐름
1. **페이지 접속** → https://foodcleaner-33759.azurewebsites.net/
2. **식재료 입력**
   - 방법 1: "사진 찍기" → 카메라로 촬영 (HTTPS 필요)
   - 방법 2: "앨범에서 선택" → 파일 업로드
   - 방법 3: 직접 입력 → "재료 추가" 클릭
3. **요리 추천 받기** → "요리 추천 받기" 클릭
4. **결과 확인** → 추천된 요리 목록 표시
5. **조리 방법 확인** → 레시피 카드 클릭 → 재료 & 조리 방법 확인

---

## 🐛 알려진 이슈

### 1. 로컬 카메라 권한
- **증상:** localhost에서 "사진 찍기" 버튼이 작동 안 함
- **원인:** 카메라는 HTTPS 보안 연결에서만 작동
- **해결:** Azure 배포 버전 사용 (HTTPS)

### 2. API 응답 시간
- **증상:** 요리 추천이 느림
- **원인:** Azure OpenAI API 처리 시간
- **해결:** 보통 3~5초 소요 (정상)

---

## 📝 라이선스

이 프로젝트는 개인 학습/포트폴리오 프로젝트입니다.

---

## 👨‍💻 개발자 정보

- **이름:** Ethan
- **프로젝트 기간:** 2026년 6월~7월
- **GitHub:** [skykwon131024](https://github.com/skykwon131024)

---

## 🙏 감사의 말

- **Azure OpenAI** - AI 기반 요리 추천
- **Microsoft Azure** - 클라우드 호스팅

---

## 📞 문의

프로젝트에 대한 질문이나 제안이 있으시면 **GitHub Issues**에 등록해 주세요.

👉 [GitHub Issues](https://github.com/skykwon131024/FoodCleaner/issues)
