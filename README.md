# LoomQuery - Local RAG Document Search

로컬 Ollama 기반 RAG(Retrieval Augmented Generation) 애플리케이션으로, PDF/TXT 문서를 업로드하고 의미론적 검색을 수행할 수 있습니다.

**특징:**
- 🔒 로컬 전용: 클라우드 없이 개인 데이터 보호
- 🤖 Ollama 통합: 로컬 LLM 기반 임베딩
- 🔍 의미론적 검색: 벡터 기반 문서 검색
- 📚 문서 관리: 업로드, 공유, 삭제

---

## 📋 사전 요구사항

### 필수 서비스
- **Ollama** (로컬 LLM & 임베딩 서버)
- **ChromaDB** (벡터 저장소)
- **Redis** (작업 큐)
- **Node.js 18+** (Next.js 앱)

### 선택 사항
- **pnpm** (권장) 또는 npm

---

## 🚀 빠른 시작

### 1단계: Ollama 설치 및 실행

#### macOS / Linux:
```bash
# Ollama 다운로드 및 설치
curl -fsSL https://ollama.ai/install.sh | sh

# Ollama 서버 시작 (별도 터미널)
ollama serve
```

#### Windows:
[ollama.ai](https://ollama.ai) 에서 설치 관리자 다운로드

### 2단계: 임베딩 모델 다운로드

```bash
# nomic-embed-text 모델 다운로드 (권장: 한글/영문 지원, 빠름)
ollama pull nomic-embed-text

# 또는 multilingual-e5-large (더 정확하지만 느림)
# ollama pull multilingual-e5-large
```

모델 다운로드 확인:
```bash
curl -X POST http://localhost:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "안녕하세요"
  }' | jq
```

응답이 벡터 배열이면 성공입니다.

### 3단계: ChromaDB 시작

```bash
# Docker로 실행 (권장)
docker run -d -p 8000:8000 ghcr.io/chroma-core/chroma:latest

# 또는 로컬 설치:
pip install chromadb
chroma run --host localhost --port 8000
```

확인:
```bash
curl http://localhost:8000/api/v1/version
```

### 4단계: Redis 시작

```bash
# Docker로 실행 (권장)
docker run -d -p 6379:6379 redis:latest

# 또는 로컬 설치:
redis-server
```

### 5단계: LoomQuery 실행

```bash
# 저장소 클론 또는 진입
cd /path/to/loom-query

# 의존성 설치
pnpm install

# 환경 변수 설정 (.env 파일 생성)
cp .env.example .env

# 개발 서버 시작
pnpm dev
```

브라우저에서 http://localhost:3000 열기

---

## 📖 사용 방법

### 문서 업로드
1. **대시보드** 페이지 상단의 "파일 선택" 클릭
2. PDF 또는 TXT 파일 선택
3. "업로드" 버튼 클릭
4. 임베딩 생성 진행 상황 확인

### 문서 검색
1. 검색 입력창에 쿼리 입력 (예: "머신러닝이란?")
2. 검색 모드 선택:
   - **FTS**: 전문 검색 (빠름, 정확한 매칭)
   - **Semantic**: 의미론적 검색 (느림, 의미 기반)
   - **Hybrid**: 둘 다 사용 (권장)
3. Enter 또는 "검색" 버튼 클릭
4. 관련 문서가 relevance score와 함께 표시

---

## 🔧 환경 설정

`.env` 파일을 수정하여 서비스 URL 변경:

```bash
# Ollama 설정
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text    # 또는 multilingual-e5-large

# ChromaDB 설정
CHROMA_URL=http://localhost:8000

# Redis 설정
REDIS_URL=redis://localhost:6379

# 포트
PORT=3000
```

---

## 📊 모델 비교

| 모델 | 언어 | 속도 | 정확도 | 권장 |
|------|------|------|--------|------|
| `nomic-embed-text` | 한글/영문 | ⚡⚡⚡ | ⭐⭐⭐ | ✅ |
| `multilingual-e5-large` | 100+ 언어 | ⚡ | ⭐⭐⭐⭐ | 고정확도 필요시 |

---

## 🧪 테스트

```bash
# 단위 테스트 실행
pnpm test

# E2E 테스트 실행
pnpm test:e2e

# 타입 체크
pnpm typecheck

# 빌드 검증
pnpm build
```

---

## 📁 프로젝트 구조

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # 메인 대시보드
│   ├── analytics/               # 분석 페이지
│   └── api/
│       ├── documents/
│       │   ├── upload/route.ts  # 문서 업로드 API
│       │   ├── search/route.ts  # 검색 API
│       │   └── ...
│       └── analytics/           # 분석 API
├── features/documents/
│   ├── components/
│   │   ├── DocumentUploadForm.tsx  # 업로드 UI
│   │   └── DocumentSearchForm.tsx  # 검색 UI
│   ├── actions/                    # Server actions
│   ├── api/                        # Route handlers
│   └── schema.ts                   # Zod schemas
├── lib/
│   ├── db/                         # 데이터베이스
│   ├── mastra.ts                   # Ollama 통합
│   ├── chroma.ts                   # ChromaDB 클라이언트
│   ├── logger.ts                   # 로깅
│   └── cache/                      # 캐시
└── components/
    ├── ui/                         # shadcn/ui components
    └── ...
```

---

## 🐛 문제 해결

### Ollama 연결 실패
```bash
# Ollama 서버 실행 중인지 확인
curl http://localhost:11434/api/version

# Ollama 로그 확인
# macOS: 메뉴바 > Ollama > Show in Finder > 로그 폴더
```

### ChromaDB 연결 실패
```bash
# ChromaDB 실행 중인지 확인
curl http://localhost:8000/api/v1/version

# Docker 로그 확인
docker logs <container-id>
```

### 임베딩 생성 실패
- Ollama 모델 다운로드 확인: `ollama list`
- 디스크 공간 확인 (모델은 수 GB 필요)
- 메모리 충분한지 확인 (최소 4GB 권장)

---

## 📝 개발

### 로컬 개발 서버
```bash
pnpm dev
```

### TypeScript 엄격 모드
모든 코드는 TypeScript strict mode에서 컴파일됩니다:
```bash
pnpm typecheck
```

### 코드 포맷팅
```bash
pnpm lint
```

---

## 📄 라이선스

MIT

---

## 🤝 기여

버그 리포트, 기능 요청, PR 환영합니다.

---

## ✨ 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js App Router, SQLite, Zod validation
- **AI/ML**: Ollama, Mastra RAG, ChromaDB
- **Job Queue**: BullMQ + Redis
- **Testing**: Vitest, React Testing Library, Playwright
- **Tools**: pnpm, ESLint, prettier

---

**마지막 업데이트**: 2026-03-06
