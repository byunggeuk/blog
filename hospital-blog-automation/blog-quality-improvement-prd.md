# 병원 블로그 자동화 시스템 품질 개선 PRD

## Product Requirements Document

**버전:** 2.1
**작성일:** 2026-03-25
**프로젝트명:** Hospital Blog Automation System — Quality Improvement
**대상 코드베이스:** `C:\Users\User\blog\hospital-blog-automation`

---

## 0. 불변 규칙 (Immutable Rules)

> **이 섹션의 규칙은 어떤 Phase의 개선 작업에서도 절대 변경, 삭제, 완화할 수 없다.**
> 모든 프롬프트 변경, 구조 재설계, 모델 교체 시 이 규칙의 준수 여부를 반드시 검증해야 한다.

### 0.1 글 구조 규칙 (Structure Rules)

**대제목 (## 레벨)**

대제목은 반드시 `타겟 키워드` + `,` + `나머지 부분` 형태로 작성한다. 쉼표 앞에 타겟 키워드를 그대로 넣고, 쉼표 뒤에 독자의 관심을 끄는 문장을 붙인다.

```
## 회전근개파열, 어깨 통증의 원인과 치료법
## 유방암수술후림프부종, 왜 조기 치료가 중요한가
```

**소제목 (### 레벨) + 문단**

소제목은 정확히 6개여야 하며, 각 소제목 아래에 대응하는 본문 문단이 1개씩 온다. 소제목은 독자의 궁금증을 담은 질문 형태로 작성한다.

```
### 회전근개가 파열되면 어떤 증상이 나타날까요?

(여기에 산문 문단이 온다. 평균 6문장.)
```

**마무리 문단**

글의 끝에 소제목 없는 마무리 문단을 1개 배치한다. 3문장 전후로, 전문의 상담 안내로 자연스럽게 마무리한다.

**최종 구조 요약:**

```
## [타겟 키워드], [부제]        ← 대제목 1개
### [질문형 소제목 1]           ← 소제목 + 문단 × 6
(본문 문단)
### [질문형 소제목 2]
(본문 문단)
### [질문형 소제목 3]
(본문 문단)
### [질문형 소제목 4]
(본문 문단)
### [질문형 소제목 5]
(본문 문단)
### [질문형 소제목 6]
(본문 문단)
(소제목 없는 마무리 문단)       ← 마무리 1개
```

### 0.2 산문체 규칙 (Prose Rules)

소제목 아래에는 바로 본문 산문 문단이 시작되어야 한다. 아래 형식은 어떤 상황에서도 사용을 금지한다.

| 금지 형식          | 예시                                |
| ------------------ | ----------------------------------- |
| 하위 소제목 (####) | `#### 치료 방법의 종류`             |
| 볼드체 항목명      | `**1단계 진단**` 으로 시작하는 나열 |
| 글머리 기호        | `- 첫 번째 증상은...`               |
| 번호 매기기        | `1. 관절경 수술`                    |
| 인용문             | `> 전문가에 따르면...`              |

본문은 문단과 문단이 자연스럽게 이어지는 산문체로 작성한다. 한 문단은 평균 6문장이며, 문단이 바뀔 때는 앞 문단의 내용을 자연스럽게 받아서 이어간다.

### 0.3 분량 규칙

전체 글의 분량은 2,000자에서 3,000자 사이이다.

### 0.4 코드 수준 보호 방법

이 규칙이 개발 과정에서 깨지지 않도록, 코드에서 다음과 같이 보호한다.

**별도 상수로 분리:** 불변 규칙은 `src/lib/prompts.ts`에 독립 상수로 선언하고, 다른 프롬프트 상수와 물리적으로 분리한다.

```typescript
// src/lib/prompts.ts

/**
 * ⚠️ IMMUTABLE — 이 상수는 절대 수정하지 마세요.
 * 수정이 필요하면 반드시 PRD 0절(불변 규칙)을 먼저 확인하세요.
 * 관련 PRD: blog-quality-improvement-prd.md §0
 */
export const IMMUTABLE_STRUCTURE_RULES = `## 글 구조 (절대 규칙 — 위반 시 글 전체가 무효)

대제목(##)은 반드시 "타겟 키워드, 나머지 부분" 형태로 작성하세요.
예: ## 회전근개파열, 어깨 통증의 원인과 치료법

대제목 바로 다음에 인트로나 도입 문단 없이 곧바로 첫 번째 소제목(###)이 시작됩니다.

소제목(###)은 정확히 6개를 작성하고, 각 소제목은 독자의 궁금증을 담은 질문 형태로 쓰세요.

각 소제목 아래에는 바로 산문 문단이 시작됩니다. 다음은 절대 사용 금지입니다:
하위 소제목(####), 볼드체 항목명, 글머리 기호(-, *, 1.), 인용문(>), 표, 코드 블록.
요점 정리나 나열이 아닌, 문단과 문단이 자연스럽게 이어지는 산문체로 작성하세요.

한 문단은 평균 여섯 문장입니다. 문단이 바뀔 때는 앞 문단의 내용을 자연스럽게 받아서 이어가세요.

글의 마지막에 소제목 없는 마무리 문단을 세 문장 내외로 작성합니다.

분량은 2,000자에서 3,000자 사이입니다.`;
```

**system 프롬프트 조립 시 항상 포함:** 어떤 프롬프트 변경이 이루어지더라도, `IMMUTABLE_STRUCTURE_RULES`는 system 프롬프트의 최상단에 항상 포함되어야 한다.

```typescript
// src/lib/prompts.ts

export function buildSystemPrompt(options: {
  hospitalName: string;
  hospitalSystemPrompt?: string;
  isEditMode?: boolean;
}): string {
  // 불변 규칙이 항상 맨 위에 온다
  let prompt = IMMUTABLE_STRUCTURE_RULES;

  prompt += "\n\n" + QUALITY_RULES; // 개선 가능한 품질 규칙
  prompt += "\n\n" + buildHospitalSection(options);

  if (options.isEditMode) {
    prompt += "\n\n" + EDIT_MODE_RULES;
  }

  return prompt;
}
```

**출력 검증 함수:** 생성된 글이 구조 규칙을 준수하는지 코드 레벨에서 검증하는 유틸리티를 추가한다.

```typescript
// src/lib/validators.ts

export interface StructureValidation {
  isValid: boolean;
  errors: string[];
}

export function validateBlogStructure(content: string): StructureValidation {
  const errors: string[] = [];

  // 대제목 검증: ## 으로 시작, 쉼표 포함
  const h2Matches = content.match(/^## .+$/gm) || [];
  if (h2Matches.length !== 1) {
    errors.push(`대제목(##)이 ${h2Matches.length}개입니다 (1개여야 함)`);
  } else if (!h2Matches[0].includes(",")) {
    errors.push("대제목에 쉼표(,)가 없습니다 (타겟키워드, 부제 형태여야 함)");
  }

  // 소제목 검증: ### 정확히 6개
  const h3Matches = content.match(/^### .+$/gm) || [];
  if (h3Matches.length !== 6) {
    errors.push(`소제목(###)이 ${h3Matches.length}개입니다 (6개여야 함)`);
  }

  // 하위 소제목 금지: #### 이상 없어야 함
  const h4Matches = content.match(/^#{4,} .+$/gm) || [];
  if (h4Matches.length > 0) {
    errors.push(`하위 소제목(####)이 ${h4Matches.length}개 발견됨 (금지)`);
  }

  // 리스트 형식 금지: -, *, 번호 리스트
  const listMatches = content.match(/^[\s]*[-*]\s+.+$/gm) || [];
  const numListMatches = content.match(/^[\s]*\d+[.)]\s+.+$/gm) || [];
  if (listMatches.length > 0) {
    errors.push(`글머리 기호(-, *)가 ${listMatches.length}개 발견됨 (금지)`);
  }
  if (numListMatches.length > 0) {
    errors.push(`번호 리스트가 ${numListMatches.length}개 발견됨 (금지)`);
  }

  // 볼드 항목명 패턴 감지: **단어** 로 시작하는 줄
  const boldItemMatches = content.match(/^\*\*.+?\*\*/gm) || [];
  if (boldItemMatches.length > 0) {
    errors.push(`볼드 항목명 패턴이 ${boldItemMatches.length}개 발견됨 (금지)`);
  }

  // 분량 검증
  const textOnly = content.replace(/^#+ .+$/gm, "").trim();
  if (textOnly.length < 2000) {
    errors.push(`분량이 ${textOnly.length}자로 부족합니다 (최소 2,000자)`);
  }
  if (textOnly.length > 3000) {
    errors.push(`분량이 ${textOnly.length}자로 초과합니다 (최대 3,000자)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

이 검증 함수의 활용 방법은 Phase별로 다음과 같다.

- **Phase 1~3:** 생성 결과를 저장하기 전에 `validateBlogStructure`를 호출하여, 위반 사항이 있으면 로그에 기록한다 (경고 수준).
- **Phase 4 이후:** 검증 실패 시 자동으로 1회 재생성을 시도하거나, 사용자에게 "구조 규칙 위반" 경고를 표시하는 것을 고려한다.

### 0.5 테스트 시 필수 검증

모든 Phase의 테스트에서, 아래 항목은 pass/fail 판정의 필수 기준이다. 하나라도 fail이면 해당 Phase의 배포를 중단한다.

| 검증 항목                | 판정 기준                                     |
| ------------------------ | --------------------------------------------- |
| 대제목 형식              | `## 타겟키워드, ...` 형태인가                 |
| 소제목 개수              | 정확히 6개인가                                |
| 소제목 형태              | 질문형인가                                    |
| 각 소제목 아래 산문 문단 | 리스트/볼드항목/하위소제목 없이 순수 산문인가 |
| 마무리 문단              | 소제목 없이 3문장 전후인가                    |
| 분량                     | 2,000~3,000자인가                             |

---

## 1. 개요

### 1.1 배경

병원 블로그 자동화 시스템(HBAS) v1.0이 배포되어 운영 중이다. 웹앱의 UI와 워크플로우는 안정적이나, AI가 생성하는 블로그 글의 품질에 심각한 문제가 있다.

주요 증상은 다음과 같다.

- 참고자료를 제공해도 모델이 내용을 제대로 반영하지 않는다
- 참고자료에 없는 의학 정보를 모델이 임의로 생성한다 (할루시네이션)
- 글의 문체가 "요점정리 노트" 스타일로, 자연스러운 산문이 아니다
- claude.ai Projects에서 같은 지침과 참고파일로 생성한 결과와 품질 차이가 크다

### 1.2 목표

이 문서의 목표는 현재 코드베이스의 구조적 문제를 식별하고, 단계적 개선을 통해 AI 생성 글의 품질을 claude.ai Projects 수준으로 끌어올리는 것이다. 단, §0(불변 규칙)에 정의된 구조 규칙은 어떤 개선에서도 유지되어야 한다.

### 1.3 성공 지표

- **구조 준수율: 100% (불변 규칙 위반 0건)** ← 최우선 지표
- 참고자료 반영률: 참고자료의 핵심 정보 중 80% 이상이 생성된 글에 포함
- 할루시네이션 발생률: 참고자료에 근거 없는 의학적 주장이 0건
- 수정 요청 횟수: 평균 2회 이하 (현재 대비 50% 감소 목표)
- 문체 만족도: 담당자가 "자연스럽다"고 평가하는 비율 80% 이상

---

## 2. 현재 시스템 분석

### 2.1 아키텍처 현황

```
[웹 프론트엔드 (Next.js)]
       ↓ POST /api/chat
[chat/route.ts — Claude API 호출]
       ↓ 참고자료 필요 시
[google-drive.ts — getReferenceContents()]
       ↓ 결과 반환
[store.tsx — 상태 관리 + Drive 저장]
```

핵심 파일 목록은 아래와 같다.

| 파일                           | 역할                                  |
| ------------------------------ | ------------------------------------- |
| `src/app/api/chat/route.ts`    | Claude API 호출 (채팅 기반 생성/수정) |
| `src/app/api/process/route.ts` | 배치 처리 (대기 → 자동 생성)          |
| `src/lib/google-drive.ts`      | Google Drive 파일 읽기/쓰기           |
| `src/lib/store.tsx`            | 클라이언트 상태 관리 + API 호출 조율  |

### 2.2 식별된 문제점

#### 문제 1: 참고자료가 System 프롬프트에 파묻힘 (Instruction Dilution)

**위치:** `chat/route.ts` 60-80행 부근, `process/route.ts` generateBlogContent 함수

현재 system 프롬프트의 구조는 다음과 같다.

```
system = BLOG_SYSTEM_PROMPT (~4,000자: 글쓰기 원칙 + 할루시네이션 금지 규칙 + 형식 규칙)
       + 병원 정보 섹션
       + 참고자료 섹션 (최대 50,000자)
       + 수정 모드 규칙 (조건부)
```

참고자료가 수만 자의 규칙 텍스트 사이에 삽입되므로, 모델이 참고자료를 "또 하나의 규칙 블록"으로 취급하여 실제 내용을 깊이 읽지 않는다. claude.ai Projects는 참고파일을 별도 인덱싱하여 처리하므로 이 문제가 발생하지 않는다.

**영향도:** 상 — 참고자료 미반영의 근본 원인

#### 문제 2: 부정형 규칙이 할루시네이션을 오히려 유발 (Negative Priming)

**위치:** `chat/route.ts` BLOG_SYSTEM_PROMPT 상수, `process/route.ts` baseSystemPrompt

"❌ 구체적인 숫자/통계 사용 금지: 90%의 환자, 3배 빠른..." 형태의 부정형 예시가 약 1,800자에 걸쳐 나열되어 있다. LLM에게 "하지 말 것"의 구체적 예시를 제공하면, 해당 패턴이 활성화(prime)되어 변형된 형태로 출력될 확률이 높아진다.

또한 이 규칙 블록의 길이가 참고자료 활용에 쓸 수 있는 모델의 인지 자원(context utilization)을 소모한다.

**영향도:** 중상 — 할루시네이션 직접 원인 + 지침 희석 가중

#### 문제 3: Temperature = 0 (기계적 문체의 원인)

**위치:** `chat/route.ts` 마지막 API 호출부, `process/route.ts` generateBlogContent 함수

두 파일 모두 `temperature: 0`으로 설정되어 있다. Temperature는 다음 토큰 선택의 확률 분포를 조절하는 파라미터로, 사실 정확도와는 무관하다. Temperature 0은 가장 확률이 높은 토큰만 선택하므로 다음과 같은 문제가 발생한다.

- 문체가 교과서적이고 단조롭다
- 소제목 아래에 하위 항목을 나열하는 "요점정리" 패턴에 갇힌다
- "~입니다", "~됩니다" 종결어미가 반복된다

**영향도:** 중 — 문체 품질 저하의 직접 원인

#### 문제 4: 참고자료 파이프라인의 구조적 결함

**위치:** `google-drive.ts` getReferenceContents 함수 (마지막 ~40행)

```typescript
if (totalContent.length + section.length > MAX_REFERENCE_SIZE) {
  totalContent += `### ${file.name}\n(용량 제한으로 생략됨)\n\n`;
  break; // ← 이후 파일은 아예 처리하지 않음
}
```

두 가지 문제가 있다.

1. `break` 사용으로 용량 초과 시 나머지 파일 전체가 무시된다. 중요한 참고자료가 뒤에 있으면 모델에 전달되지 않는다.
2. 파일 순서가 Google Drive API 반환 순서에 의존하므로 예측 불가능하다. 가장 중요한 참고자료가 먼저 읽힌다는 보장이 없다.

**영향도:** 중 — 참고자료 누락 가능성

#### 문제 5: 단일 패스 생성 — 검증 단계 부재

**위치:** `chat/route.ts` POST 함수, `store.tsx` createRequest/sendMessage

현재 흐름은 API를 한 번 호출하여 결과를 그대로 저장한다. 모델이 참고자료를 실제로 읽었는지, 핵심 정보가 반영되었는지 검증하는 단계가 없다.

```
요청 → API 1회 호출 → 결과 저장 → 끝
```

이로 인해 "그럴듯하지만 참고자료와 무관한" 글이 생성되어도 사용자가 직접 확인하기 전까지 발견되지 않는다.

**영향도:** 상 — 품질 보증 체계 부재

---

## 3. 개선 설계

> **모든 Phase에서 §0(불변 규칙)의 준수를 전제한다.** 어떤 코드 변경이든 §0의 규칙을 약화시키거나 생략하는 방향으로 이루어져서는 안 된다.

### 3.0 Phase 0: 불변 규칙의 코드 수준 보호 (모든 Phase에 선행)

**목표:** 불변 규칙을 코드에서 물리적으로 보호하여 이후 어떤 개선에서도 깨지지 않도록 한다
**예상 소요:** 0.5일
**대상 파일:** `src/lib/prompts.ts` (신규 생성), `src/lib/validators.ts` (신규 생성)

#### 3.0.1 프롬프트 상수 분리

`src/lib/prompts.ts` 파일을 신규 생성하여, 불변 규칙과 개선 가능한 규칙을 물리적으로 분리한다.

```typescript
// src/lib/prompts.ts

/**
 * ⚠️ IMMUTABLE — 이 상수는 절대 수정하지 마세요.
 * 수정이 필요하면 반드시 PRD §0(불변 규칙)을 먼저 확인하세요.
 * 관련 PRD: blog-quality-improvement-prd.md §0
 */
export const IMMUTABLE_STRUCTURE_RULES = `## 글 구조 (절대 규칙 — 위반 시 글 전체가 무효)

대제목(##)은 반드시 "타겟 키워드, 나머지 부분" 형태로 작성하세요.
예: ## 회전근개파열, 어깨 통증의 원인과 치료법

대제목 바로 다음에 인트로나 도입 문단 없이 곧바로 첫 번째 소제목(###)이 시작됩니다.

소제목(###)은 정확히 6개를 작성하고, 각 소제목은 독자의 궁금증을 담은 질문 형태로 쓰세요.

각 소제목 아래에는 바로 산문 문단이 시작됩니다. 다음은 절대 사용 금지입니다:
하위 소제목(####), 볼드체 항목명(**텍스트**로 시작하는 나열), 글머리 기호(-, *, 1.), 인용문(>), 표, 코드 블록.
요점 정리나 나열이 아닌, 문단과 문단이 자연스럽게 이어지는 산문체로 작성하세요.

한 문단은 평균 여섯 문장입니다. 문단이 바뀔 때는 앞 문단의 내용을 자연스럽게 받아서 이어가세요.

글의 마지막에 소제목 없는 마무리 문단을 세 문장 내외로 작성합니다.

분량은 2,000자에서 3,000자 사이입니다.`;

/**
 * 개선 가능한 품질 규칙 — Phase 2 이후 자유롭게 수정 가능
 */
export const QUALITY_RULES = `## 품질 규칙

당신은 병원 블로그 전문 작가입니다. 환자가 궁금해하는 내용을 의사가 진료실에서 설명해주듯 자연스럽게 풀어쓰세요.

1. 의학적 주장은 반드시 참고자료에 근거해야 합니다. 참고자료에 없는 수치, 통계, 연구 결과, 환자 사례는 사용하지 마세요.
2. 확신할 수 없는 내용에는 "~할 수 있습니다", "개인차가 있습니다" 표현을 쓰세요.
3. 문장은 "~입니다"만 반복하지 말고 "~인데요", "~거든요", "~있지요" 등 대화체를 섞으세요.`;

/**
 * system 프롬프트 조립 함수
 * IMMUTABLE_STRUCTURE_RULES는 항상 최상단에 포함된다.
 */
export function buildSystemPrompt(options: {
  hospitalName: string;
  hospitalSystemPrompt?: string;
  isEditMode?: boolean;
}): string {
  // 불변 규칙이 항상 맨 위 — 절대 제거하지 마세요
  let prompt = IMMUTABLE_STRUCTURE_RULES;

  prompt += "\n\n" + QUALITY_RULES;

  prompt += `\n\n## 병원 정보\n- 병원명: ${options.hospitalName}`;
  if (options.hospitalSystemPrompt) {
    prompt += `\n- 병원별 가이드: ${options.hospitalSystemPrompt}`;
  }

  if (options.isEditMode) {
    prompt += `\n\n## 수정 모드 규칙
지금은 기존 글의 수정 요청입니다.
1. 사용자가 지적한 부분만 수정하세요
2. 지적하지 않은 부분은 원문 그대로 유지하세요
3. 글의 전체 구조(대제목 1, 소제목 6, 마무리 1)를 변경하지 마세요`;
  }

  return prompt;
}
```

#### 3.0.2 출력 구조 검증 함수

`src/lib/validators.ts` 파일을 신규 생성한다.

```typescript
// src/lib/validators.ts

export interface StructureValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 생성된 블로그 글이 불변 구조 규칙(PRD §0)을 준수하는지 검증한다.
 */
export function validateBlogStructure(content: string): StructureValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 대제목 검증: ## 으로 시작하는 줄이 정확히 1개, 쉼표 포함
  const h2Matches = content.match(/^## .+$/gm) || [];
  if (h2Matches.length !== 1) {
    errors.push(`대제목(##)이 ${h2Matches.length}개입니다 (1개여야 함)`);
  } else if (!h2Matches[0].includes(",")) {
    errors.push('대제목에 쉼표(,)가 없습니다 ("타겟키워드, 부제" 형태여야 함)');
  }

  // 2. 소제목 검증: ### 정확히 6개
  const h3Matches = content.match(/^### .+$/gm) || [];
  if (h3Matches.length !== 6) {
    errors.push(
      `소제목(###)이 ${h3Matches.length}개입니다 (정확히 6개여야 함)`,
    );
  }

  // 3. 소제목 질문형 검증
  for (const h3 of h3Matches) {
    const title = h3.replace(/^### /, "");
    if (
      !title.endsWith("?") &&
      !title.endsWith("요?") &&
      !title.endsWith("까?") &&
      !title.endsWith("까요?") &&
      !title.includes("?")
    ) {
      warnings.push(`소제목이 질문형이 아닐 수 있습니다: "${title}"`);
    }
  }

  // 4. 하위 소제목 금지: #### 이상 없어야 함
  const h4Matches = content.match(/^#{4,} .+$/gm) || [];
  if (h4Matches.length > 0) {
    errors.push(`하위 소제목(####)이 ${h4Matches.length}개 발견됨 (금지)`);
  }

  // 5. 리스트 형식 금지
  const bulletMatches = content.match(/^[\s]*[-*]\s+.+$/gm) || [];
  const numListMatches = content.match(/^[\s]*\d+[.)]\s+.+$/gm) || [];
  if (bulletMatches.length > 0) {
    errors.push(`글머리 기호(-, *)가 ${bulletMatches.length}줄 발견됨 (금지)`);
  }
  if (numListMatches.length > 0) {
    errors.push(`번호 리스트가 ${numListMatches.length}줄 발견됨 (금지)`);
  }

  // 6. 볼드 항목명 패턴 감지: 줄 시작이 **텍스트** 인 경우
  const boldItemMatches = content.match(/^\*\*.+?\*\*/gm) || [];
  if (boldItemMatches.length > 0) {
    errors.push(`볼드 항목명 패턴이 ${boldItemMatches.length}줄 발견됨 (금지)`);
  }

  // 7. 인용문 금지
  const quoteMatches = content.match(/^>\s+.+$/gm) || [];
  if (quoteMatches.length > 0) {
    errors.push(`인용문(>)이 ${quoteMatches.length}줄 발견됨 (금지)`);
  }

  // 8. 분량 검증 (제목/소제목 제외한 본문만)
  const bodyText = content.replace(/^#{1,6} .+$/gm, "").trim();
  if (bodyText.length < 2000) {
    warnings.push(
      `본문 분량이 ${bodyText.length}자로 부족합니다 (최소 2,000자)`,
    );
  }
  if (bodyText.length > 3000) {
    warnings.push(
      `본문 분량이 ${bodyText.length}자로 초과합니다 (최대 3,000자)`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
```

#### 3.0.3 검증 함수의 적용 위치

생성 결과를 Drive에 저장하기 직전에 검증을 호출한다.

```typescript
// chat/route.ts 또는 process/route.ts에서, 결과 저장 전에:
import { validateBlogStructure } from '@/lib/validators';

const content = /* AI 생성 결과 */;
const validation = validateBlogStructure(content);

if (!validation.isValid) {
    console.warn('[구조 규칙 위반]', validation.errors);
    // Phase 1~3: 경고 로그만 남기고 저장은 진행
    // Phase 4 이후: 자동 재생성 또는 사용자 경고 표시 가능
}
if (validation.warnings.length > 0) {
    console.info('[구조 경고]', validation.warnings);
}
```

---

### 3.1 Phase 1: 즉시 적용 (코드 변경 최소)

**목표:** 코드 변경 10줄 이내로 체감 가능한 품질 향상
**예상 소요:** 0.5일
**대상 파일:** `chat/route.ts`, `process/route.ts`
**불변 규칙 영향:** 없음 — 이 Phase에서는 프롬프트 텍스트를 변경하지 않는다

#### 3.1.1 Temperature 변경

**변경 대상:**

- `src/app/api/chat/route.ts` → `anthropic.messages.create()` 호출부
- `src/app/api/process/route.ts` → `generateBlogContent()` 함수 내 API 호출부

**변경 내용:**

```typescript
// AS-IS
temperature: 0,

// TO-BE
temperature: 0.8,
```

글쓰기 태스크에서 권장되는 범위는 0.7~1.0이다. 0.8은 자연스러운 문체를 유지하면서도 지나치게 산만하지 않은 균형점이다.

#### 3.1.2 모델 버전 통일

**변경 대상:** `process/route.ts` → generateBlogContent 함수

현재 `chat/route.ts`는 `claude-opus-4-5-20251101`을, `process/route.ts`는 `claude-sonnet-4-5-20250929`을 사용하고 있다. 두 경로의 결과물 품질이 달라지는 원인이 된다.

```typescript
// AS-IS (process/route.ts)
model: "claude-sonnet-4-5-20250929",

// TO-BE — chat/route.ts와 동일하게 통일
model: "claude-opus-4-5-20251101",
```

비용이 우려될 경우, 양쪽 모두 `claude-sonnet-4-5-20250929`으로 통일하는 것도 가능하다. 핵심은 두 경로의 모델이 같아야 한다는 것이다.

---

### 3.2 Phase 2: 프롬프트 구조 재설계

**목표:** 참고자료 반영률 대폭 향상 + 할루시네이션 감소
**예상 소요:** 1~2일
**대상 파일:** `chat/route.ts`, `process/route.ts`, `src/lib/prompts.ts`
**불변 규칙 영향:** `IMMUTABLE_STRUCTURE_RULES` 상수는 변경하지 않는다. 변경 대상은 그 외의 프롬프트 부분이다.

#### 3.2.1 System 프롬프트 압축

현재 `chat/route.ts`와 `process/route.ts`에 각각 인라인으로 존재하는 ~4,000자 프롬프트를, Phase 0에서 만든 `prompts.ts`의 `buildSystemPrompt()` 함수로 교체한다.

**AS-IS:** 각 파일에 프롬프트가 인라인으로 존재 (중복, 불일치 위험)

**TO-BE:** 두 파일 모두 `buildSystemPrompt()` 함수를 호출

```typescript
// chat/route.ts, process/route.ts 모두
import { buildSystemPrompt } from "@/lib/prompts";

const systemPrompt = buildSystemPrompt({
  hospitalName,
  hospitalSystemPrompt: hospital?.system_prompt,
  isEditMode: !isInitialGeneration,
});
```

이전 규칙에서 삭제하는 항목들과 그 이유는 아래와 같다.

| 삭제 항목                              | 이유                                                      |
| -------------------------------------- | --------------------------------------------------------- |
| ❌ 예시 나열 (90%의 환자, 3배 빠른 등) | 부정형 예시가 해당 패턴을 활성화함                        |
| 자가 점검 체크리스트 4개 항목          | 모델이 실제로 자가 점검을 수행하지 않음. 인지 자원만 소모 |
| ✅ 반드시 사용해야 하는 표현 목록      | `QUALITY_RULES`의 규칙 1-2번에 이미 포함됨                |
| 기간/효과 언급 시 필수 표현 3개        | `QUALITY_RULES`의 규칙 2번으로 충분                       |
| 세부 SEO 규칙                          | "자연스럽게 녹여내세요" 한 줄로 충분                      |

**삭제하지 않는 항목 (IMMUTABLE_STRUCTURE_RULES에 보존):**

| 보존 항목                      | 위치                        |
| ------------------------------ | --------------------------- |
| 대제목 형식 (타겟키워드, 부제) | `IMMUTABLE_STRUCTURE_RULES` |
| 소제목 6개, 질문 형태          | `IMMUTABLE_STRUCTURE_RULES` |
| 산문체 강제, 리스트 금지       | `IMMUTABLE_STRUCTURE_RULES` |
| 마무리 문단 규칙               | `IMMUTABLE_STRUCTURE_RULES` |
| 분량 2,000~3,000자             | `IMMUTABLE_STRUCTURE_RULES` |

#### 3.2.2 참고자료를 User 메시지로 이동

참고자료를 system에서 분리하여 user 메시지의 첫 번째 블록으로 전달한다.

**AS-IS:**

```typescript
// chat/route.ts
const systemPrompt = `${BLOG_SYSTEM_PROMPT}
${referenceSection}        // ← system에 참고자료 포함
${hospitalInfo}
${editModeSection}`;

messages: [
  { role: "user", content: "위 정보를 바탕으로 블로그 글을 작성해주세요." },
];
```

**TO-BE:**

```typescript
const systemPrompt = buildSystemPrompt({ ... });  // 참고자료 미포함

const userContent = referenceContents
  ? `아래는 ${hospitalName}의 참고자료입니다. 글의 의학적 내용은 반드시 이 자료에 근거해야 합니다.

<reference_materials>
${referenceContents}
</reference_materials>

위 참고자료를 바탕으로 블로그 글을 작성해주세요.

**타겟 키워드:** ${targetKeyword}
**주제:** ${topicKeyword}
**목적:** ${purpose}
**전개 방식:** ${formatType}${formatCustom ? `\n**추가 요청:** ${formatCustom}` : ''}`
  : `"${targetKeyword}" 키워드에 대한 ${formatType} 블로그 글을 작성해주세요.
**주제:** ${topicKeyword}
**목적:** ${purpose}
${formatCustom ? `**추가 요청:** ${formatCustom}` : ''}`;

messages: [{ role: 'user', content: userContent }]
```

이 변경은 `process/route.ts`의 `generateBlogContent` 함수에도 동일하게 적용한다.

#### 3.2.3 수정 모드 프롬프트 개선

현재 수정 모드에서는 이전 대화 히스토리 전체 + 새 수정 요청을 보내는데, 참고자료가 최초 생성 시에만 전달되고 수정 시에는 빠질 수 있다.

**TO-BE:** `chat/route.ts`에서 수정 모드(`!isInitialGeneration`)일 때도 참고자료를 user 메시지 히스토리의 앞부분에 삽입하거나, 최소한 "참고자료에 근거하여 수정하세요"라는 리마인더를 포함해야 한다.

---

### 3.3 Phase 3: 참고자료 파이프라인 개선

**목표:** 참고자료 누락 방지 + 처리 안정성 향상
**예상 소요:** 0.5~1일
**대상 파일:** `google-drive.ts`
**불변 규칙 영향:** 없음 — 이 Phase는 프롬프트를 변경하지 않는다

#### 3.3.1 파일 순회 로직 개선

**AS-IS:**

```typescript
if (totalContent.length + section.length > MAX_REFERENCE_SIZE) {
  totalContent += `### ${file.name}\n(용량 제한으로 생략됨)\n\n`;
  break; // 이후 파일 전체 무시
}
```

**TO-BE:**

```typescript
const MAX_REFERENCE_SIZE = 40000; // 50,000 → 40,000 (system 압축으로 여유 확보)
const MAX_PER_FILE = 12000; // 파일당 최대 12,000자

for (const file of textFiles) {
  try {
    let content = await getFileContentAsText(file.id, file.mimeType);

    // 파일당 크기 제한
    if (content.length > MAX_PER_FILE) {
      content =
        content.slice(0, MAX_PER_FILE) +
        "\n\n...(이 파일의 나머지 내용은 용량 제한으로 생략됨)";
    }

    const section = `### ${file.name}\n${content}\n\n`;

    if (totalContent.length + section.length > MAX_REFERENCE_SIZE) {
      totalContent += `### ${file.name}\n(전체 용량 제한으로 생략됨)\n\n`;
      continue; // break → continue: 다음 파일도 시도
    }

    totalContent += section;
  } catch (error) {
    console.error(`참고자료 읽기 실패 (${file.name}):`, error);
    continue; // 개별 파일 실패 시 계속 진행
  }
}
```

#### 3.3.2 파일 정렬 기준 추가 (선택사항)

참고자료 파일명에 우선순위 접두사를 붙이는 컨벤션을 도입한다.

```typescript
const textFiles = files
    .filter(f => supportedMimeTypes.includes(f.mimeType) || ...)
    .sort((a, b) => a.name.localeCompare(b.name));  // 파일명 순 정렬
```

---

### 3.4 Phase 4: 2단계 생성 (Plan → Write)

**목표:** 참고자료 반영률 극대화 + 할루시네이션 근본 방지
**예상 소요:** 2~3일
**대상 파일:** `chat/route.ts`, `process/route.ts`, `store.tsx`
**불변 규칙 영향:** 2단계 모두에서 `IMMUTABLE_STRUCTURE_RULES`가 system에 포함된다. Plan 단계에서도 소제목 6개 구조를 전제로 계획을 수립한다.

#### 3.4.1 설계 개요

현재의 단일 패스(1회 API 호출)를 2단계로 분리한다.

```
[1단계: Plan] 참고자료 분석 → 핵심 정보 추출 → 소제목 6개에 배치 계획
                ↓
[2단계: Write] 계획 + 불변 구조 규칙을 바탕으로 실제 글 작성
```

#### 3.4.2 1단계: Plan (참고자료 분석)

Plan 단계에서도 소제목 6개 구조를 명시하여, 계획 자체가 불변 규칙에 부합하도록 한다.

```typescript
async function planBlogContent(
  referenceText: string,
  targetKeyword: string,
  topicKeyword: string,
  formatType: string,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    temperature: 0.3,
    system:
      "당신은 병원 블로그 글의 구조를 기획하는 편집자입니다. 참고자료를 분석하고 글의 뼈대를 만드세요.",
    messages: [
      {
        role: "user",
        content: `다음 참고자료를 꼼꼼히 읽고, "${targetKeyword}" 주제의 블로그 글에 반영할 내용을 정리하세요.

<reference_materials>
${referenceText}
</reference_materials>

아래 형식으로 출력하세요:

## 참고자료 핵심 정보
- (참고자료에서 추출한 의학적 핵심 정보를 5~8개 나열)

## 소제목 구성 (정확히 6개, 질문 형태)
1. [소제목] — 반영할 참고자료 정보: [해당 정보]
2. [소제목] — 반영할 참고자료 정보: [해당 정보]
3. [소제목] — 반영할 참고자료 정보: [해당 정보]
4. [소제목] — 반영할 참고자료 정보: [해당 정보]
5. [소제목] — 반영할 참고자료 정보: [해당 정보]
6. [소제목] — 반영할 참고자료 정보: [해당 정보]

## 주의사항
- 참고자료에 없어서 절대 쓰면 안 되는 내용 유형
- 참고자료의 핵심 메시지/강조점`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "";
}
```

#### 3.4.3 2단계: Write (계획 기반 글 작성)

Write 단계에서는 `buildSystemPrompt()`를 사용하므로 `IMMUTABLE_STRUCTURE_RULES`가 자동으로 포함된다.

```typescript
async function writeBlogContent(
  plan: string,
  referenceText: string,
  systemPrompt: string, // ← buildSystemPrompt()의 결과 (불변 규칙 포함)
  targetKeyword: string,
  topicKeyword: string,
  purpose: string,
  formatType: string,
  formatCustom?: string,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 8096,
    temperature: 0.8,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `다음 참고자료를 바탕으로 블로그 글을 작성해야 합니다.

<reference_materials>
${referenceText}
</reference_materials>

이 참고자료를 분석한 결과는 아래와 같습니다.`,
      },
      {
        role: "assistant",
        content: plan,
      },
      {
        role: "user",
        content: `위 분석을 바탕으로 블로그 글을 작성해주세요. 분석에서 나열한 핵심 정보가 모두 글에 반영되어야 합니다.

**타겟 키워드:** ${targetKeyword}
**주제:** ${topicKeyword}
**목적:** ${purpose}
**전개 방식:** ${formatType}
${formatCustom ? `**추가 요청:** ${formatCustom}` : ""}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "";
}
```

#### 3.4.4 통합 + 구조 검증

```typescript
import { validateBlogStructure } from "@/lib/validators";

// 초기 생성 시
if (isInitialGeneration && referenceContents) {
  const plan = await planBlogContent(
    referenceContents,
    targetKeyword,
    topicKeyword,
    formatType,
  );

  const content = await writeBlogContent(
    plan,
    referenceContents,
    systemPrompt,
    targetKeyword,
    topicKeyword,
    purpose,
    formatType,
    formatCustom,
  );

  // 구조 검증
  const validation = validateBlogStructure(content);
  if (!validation.isValid) {
    console.warn("[구조 규칙 위반]", validation.errors);
    // 향후: 자동 재생성 또는 사용자 경고
  }

  return content;
}
```

#### 3.4.5 비용 영향

| 항목          | 단일 패스               | 2단계 생성              | 증가율 |
| ------------- | ----------------------- | ----------------------- | ------ |
| 1단계 (Plan)  | —                       | ~2K input + ~1K output  | 신규   |
| 2단계 (Write) | ~50K input + ~4K output | ~52K input + ~4K output | 미미   |
| 합계          | 1회 호출                | 2회 호출                | ~1.3배 |

수정 요청 횟수 감소를 고려하면 전체 비용은 비슷하거나 오히려 감소할 것으로 예상한다.

#### 3.4.6 UX 고려사항

2단계 생성으로 인해 초기 생성 시간이 약 10~15초 증가한다. `store.tsx`에서 상태 표시를 세분화한다.

```
"참고자료를 분석하고 있습니다..." → "글을 작성하고 있습니다..."
```

---

### 3.5 Phase 5: 프롬프트 캐싱 적용 (선택사항)

**목표:** 반복 호출 시 비용 절감 + 응답 속도 향상
**예상 소요:** 0.5일
**대상 파일:** `chat/route.ts`, `process/route.ts`
**불변 규칙 영향:** 없음 — 프롬프트 내용 변경 없이 전달 방식만 변경

```typescript
const response = await anthropic.messages.create({
  model: "claude-opus-4-5-20251101",
  max_tokens: 8096,
  temperature: 0.8,
  system: [
    {
      type: "text",
      text: IMMUTABLE_STRUCTURE_RULES, // 불변 규칙도 캐싱
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: QUALITY_RULES + "\n\n" + hospitalSection,
    },
  ],
  messages: claudeMessages,
});
```

---

## 4. 구현 로드맵

| Phase | 내용                         | 변경 파일                                  | 소요  | 불변규칙 영향          |
| ----- | ---------------------------- | ------------------------------------------ | ----- | ---------------------- |
| 0     | 불변 규칙 코드 보호          | prompts.ts(신규), validators.ts(신규)      | 0.5일 | 보호 장치 설치         |
| 1     | Temperature 변경 + 모델 통일 | chat/route.ts, process/route.ts            | 0.5일 | 없음                   |
| 2     | 프롬프트 구조 재설계         | chat/route.ts, process/route.ts            | 1~2일 | QUALITY_RULES만 변경   |
| 3     | 참고자료 파이프라인 개선     | google-drive.ts                            | 0.5일 | 없음                   |
| 4     | 2단계 생성 (Plan → Write)    | chat/route.ts, process/route.ts, store.tsx | 2~3일 | Plan에도 6개 구조 반영 |
| 5     | 프롬프트 캐싱                | chat/route.ts, process/route.ts            | 0.5일 | 없음                   |

**권장 순서:** Phase 0을 가장 먼저 실행한 후, Phase 1 → 2 → 3 → 4 → 5 순서로 진행한다. Phase 0이 완료되면 이후 어떤 Phase에서 프롬프트를 수정하더라도 불변 규칙이 물리적으로 보호된다.

---

## 5. 테스트 계획

### 5.1 불변 규칙 준수 테스트 (모든 Phase 필수)

모든 Phase 적용 후, 최소 3건의 테스트 생성을 실행하여 아래 항목을 전수 검사한다. **하나라도 fail이면 해당 Phase의 배포를 중단한다.**

| 검증 항목   | 판정 기준                                | 자동화                           |
| ----------- | ---------------------------------------- | -------------------------------- |
| 대제목 형식 | `## 타겟키워드, ...` 형태인가            | `validateBlogStructure()`        |
| 소제목 개수 | 정확히 6개인가                           | `validateBlogStructure()`        |
| 소제목 형태 | 질문형인가                               | `validateBlogStructure()` (경고) |
| 산문체 준수 | 리스트/볼드항목/하위소제목/인용문 없는가 | `validateBlogStructure()`        |
| 마무리 문단 | 소제목 없이 존재하는가                   | 수동 확인                        |
| 분량        | 2,000~3,000자인가                        | `validateBlogStructure()`        |

### 5.2 품질 개선 테스트 (A/B 비교)

각 Phase 적용 전후로 동일한 입력에 대해 생성 결과를 비교한다.

| 항목              | 평가 방법                                                 |
| ----------------- | --------------------------------------------------------- |
| 참고자료 반영률   | 참고자료의 핵심 정보 목록 대비 글에 포함된 비율 수동 체크 |
| 할루시네이션 여부 | 참고자료에 없는 의학적 주장이 글에 포함되었는지 수동 체크 |
| 문체 자연스러움   | 담당자 주관 평가 (1~5점)                                  |

### 5.3 회귀 테스트

기존에 잘 작동하던 케이스(특정 병원, 특정 키워드)가 변경 후에도 동일하거나 더 나은 결과를 내는지 확인한다.

---

## 6. 리스크 및 대응

| 리스크                                              | 확률                   | 대응                                                                                 |
| --------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| **불변 규칙이 개발 중 깨짐**                        | 낮음 (Phase 0 적용 후) | `IMMUTABLE_STRUCTURE_RULES` 상수 분리 + `validateBlogStructure()` 검증 + 테스트 필수 |
| Temperature 상승으로 구조 규칙 간헐적 위반          | 낮음                   | `validateBlogStructure()`로 감지. 문제 시 temperature 0.7로 하향                     |
| Temperature 상승으로 간헐적 할루시네이션 증가       | 낮음                   | Phase 2의 프롬프트 압축이 동시에 적용되므로 상쇄됨                                   |
| 2단계 생성의 응답 시간 증가                         | 확실                   | 프론트엔드 단계별 로딩 표시로 UX 보완 (10~15초)                                      |
| process/route.ts와 chat/route.ts 간 프롬프트 불일치 | 해소됨                 | Phase 0에서 `buildSystemPrompt()` 단일 함수로 통합                                   |

---

## 7. 향후 확장 가능성

- **v2.1 구조 위반 시 자동 재생성:** `validateBlogStructure()` 결과가 fail이면 최대 1회 자동 재생성 시도
- **v2.2 자동 품질 검수:** 생성 후 별도 API 호출로 참고자료 반영률을 자동 채점하여, 기준 미달 시 자동 재생성
- **v2.3 참고자료 청킹:** 긴 참고자료를 의미 단위로 분할하여 관련성 높은 청크만 전달 (RAG 방식)

---

**문서 끝**
