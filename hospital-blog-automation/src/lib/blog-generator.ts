import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildHtmlSystemPrompt, LinkInfo } from "@/lib/prompts";
import { validateBlogStructure, validateHtmlBlogStructure } from "@/lib/validators";

/**
 * 1단계: Plan — 참고자료 분석 + 소제목 6개 배치 계획
 */
async function planBlogContent(
  anthropic: Anthropic,
  referenceText: string,
  targetKeyword: string,
  topicKeyword: string,
  formatType: string,
): Promise<string> {
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
- 참고자료의 핵심 메시지/강조점

주제: ${topicKeyword}
전개 방식: ${formatType}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "";
}

/**
 * 2단계: Write — 계획 기반 글 작성
 */
async function writeBlogContent(
  anthropic: Anthropic,
  plan: string,
  referenceText: string,
  systemPrompt: string,
  targetKeyword: string,
  topicKeyword: string,
  purpose: string,
  formatType: string,
  formatCustom?: string,
): Promise<string> {
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
**전개 방식:** ${formatType}${formatCustom ? `\n**추가 요청:** ${formatCustom}` : ""}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "";
}

/**
 * 단일 패스 생성 (참고자료 없을 때)
 */
async function singlePassGenerate(
  anthropic: Anthropic,
  systemPrompt: string,
  targetKeyword: string,
  topicKeyword: string,
  purpose: string,
  formatType: string,
  formatCustom?: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 8096,
    temperature: 0.8,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `"${targetKeyword}" 키워드에 대한 ${formatType} 블로그 글을 작성해주세요.
**주제:** ${topicKeyword}
**목적:** ${purpose}${formatCustom ? `\n**추가 요청:** ${formatCustom}` : ""}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "";
}

export interface GenerateResult {
  content: string;
  validation: ReturnType<typeof validateBlogStructure>;
  usedPlanWrite: boolean;
  outputFormat: "markdown" | "html";
}

/**
 * 블로그 글 생성 통합 함수
 * - 참고자료가 있으면 2단계 생성 (Plan → Write)
 * - 참고자료가 없으면 단일 패스 생성
 * - 생성 후 구조 검증 수행
 */
export async function generateBlog(options: {
  apiKey: string;
  hospitalName: string;
  hospitalSystemPrompt?: string;
  targetKeyword: string;
  topicKeyword: string;
  purpose: string;
  formatType: string;
  formatCustom?: string;
  referenceText?: string;
}): Promise<GenerateResult> {
  const anthropic = new Anthropic({ apiKey: options.apiKey });

  const systemPrompt = buildSystemPrompt({
    hospitalName: options.hospitalName,
    hospitalSystemPrompt: options.hospitalSystemPrompt,
  });

  let content: string;
  let usedPlanWrite = false;

  if (options.referenceText) {
    // 2단계 생성: Plan → Write
    const plan = await planBlogContent(
      anthropic,
      options.referenceText,
      options.targetKeyword,
      options.topicKeyword,
      options.formatType,
    );

    content = await writeBlogContent(
      anthropic,
      plan,
      options.referenceText,
      systemPrompt,
      options.targetKeyword,
      options.topicKeyword,
      options.purpose,
      options.formatType,
      options.formatCustom,
    );
    usedPlanWrite = true;
  } else {
    // 단일 패스 생성
    content = await singlePassGenerate(
      anthropic,
      systemPrompt,
      options.targetKeyword,
      options.topicKeyword,
      options.purpose,
      options.formatType,
      options.formatCustom,
    );
  }

  // 구조 검증
  const validation = validateBlogStructure(content);
  if (!validation.isValid) {
    console.warn("[구조 규칙 위반]", validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.info("[구조 경고]", validation.warnings);
  }

  return { content, validation, usedPlanWrite, outputFormat: "markdown" };
}

/**
 * HTML용 Plan 단계
 */
async function planHtmlBlogContent(
  anthropic: Anthropic,
  referenceText: string,
  targetKeyword: string,
  topicKeyword: string,
  formatType: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    temperature: 0.3,
    system:
      "당신은 병원 블로그 글의 구조를 기획하는 편집자입니다. 참고자료를 분석하고 글의 뼈대를 만드세요. 이 글은 HTML 형식으로 작성될 예정입니다.",
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

## 서식 적용 계획
- 빨간 굵기(경고/주의)를 적용할 문구 예시 2~3개
- 형광펜(긍정/핵심)을 적용할 문구 예시 2~3개

## 주의사항
- 참고자료에 없어서 절대 쓰면 안 되는 내용 유형
- 참고자료의 핵심 메시지/강조점

주제: ${topicKeyword}
전개 방식: ${formatType}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "";
}

/**
 * HTML용 Write 단계
 */
async function writeHtmlBlogContent(
  anthropic: Anthropic,
  plan: string,
  referenceText: string,
  systemPrompt: string,
  targetKeyword: string,
  topicKeyword: string,
  purpose: string,
  formatType: string,
  formatCustom?: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 10000,
    temperature: 0.8,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `다음 참고자료를 바탕으로 HTML 형식의 블로그 글을 작성해야 합니다.

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
        content: `위 분석을 바탕으로 HTML 형식의 블로그 글을 작성해주세요.

**중요**: 마크다운이 아닌 순수 HTML 태그로만 작성하세요. 시스템 프롬프트에 명시된 HTML 태그 규칙을 정확히 따르세요.

**타겟 키워드:** ${targetKeyword}
**주제:** ${topicKeyword}
**목적:** ${purpose}
**전개 방식:** ${formatType}${formatCustom ? `\n**추가 요청:** ${formatCustom}` : ""}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "";
}

/**
 * HTML 단일 패스 생성
 */
async function singlePassGenerateHtml(
  anthropic: Anthropic,
  systemPrompt: string,
  targetKeyword: string,
  topicKeyword: string,
  purpose: string,
  formatType: string,
  formatCustom?: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 10000,
    temperature: 0.8,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `"${targetKeyword}" 키워드에 대한 ${formatType} 블로그 글을 HTML 형식으로 작성해주세요.

**중요**: 마크다운이 아닌 순수 HTML 태그로만 작성하세요. 시스템 프롬프트에 명시된 HTML 태그 규칙을 정확히 따르세요.

**주제:** ${topicKeyword}
**목적:** ${purpose}${formatCustom ? `\n**추가 요청:** ${formatCustom}` : ""}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent ? textContent.text : "";
}

/**
 * HTML 형식 블로그 글 생성 함수
 */
export async function generateHtmlBlog(options: {
  apiKey: string;
  hospitalName: string;
  hospitalSystemPrompt?: string;
  targetKeyword: string;
  topicKeyword: string;
  purpose: string;
  formatType: string;
  formatCustom?: string;
  referenceText?: string;
  links?: LinkInfo;
  photoList?: string;
}): Promise<GenerateResult> {
  const anthropic = new Anthropic({ apiKey: options.apiKey });

  const systemPrompt = buildHtmlSystemPrompt({
    hospitalName: options.hospitalName,
    hospitalSystemPrompt: options.hospitalSystemPrompt,
    links: options.links,
    photoList: options.photoList,
  });

  let content: string;
  let usedPlanWrite = false;

  if (options.referenceText) {
    const plan = await planHtmlBlogContent(
      anthropic,
      options.referenceText,
      options.targetKeyword,
      options.topicKeyword,
      options.formatType,
    );

    content = await writeHtmlBlogContent(
      anthropic,
      plan,
      options.referenceText,
      systemPrompt,
      options.targetKeyword,
      options.topicKeyword,
      options.purpose,
      options.formatType,
      options.formatCustom,
    );
    usedPlanWrite = true;
  } else {
    content = await singlePassGenerateHtml(
      anthropic,
      systemPrompt,
      options.targetKeyword,
      options.topicKeyword,
      options.purpose,
      options.formatType,
      options.formatCustom,
    );
  }

  const validation = validateHtmlBlogStructure(content);
  if (!validation.isValid) {
    console.warn("[HTML 구조 규칙 위반]", validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.info("[HTML 구조 경고]", validation.warnings);
  }

  return { content, validation, usedPlanWrite, outputFormat: "html" };
}

/**
 * 뉴스타일성형외과 기본 링크 정보
 */
export const NEWSTYLE_LINKS: LinkInfo = {
  bodyLinks: [
    { name: "카카오톡 상담", url: "https://pf.kakao.com/_xfhhhj" },
    { name: "홈페이지 상담", url: "http://www.newstyleclinic.com/bbs/board.php?bo_table=counsel&pageIndex=720101" },
    { name: "네이버 예약", url: "https://m.booking.naver.com/booking/13/bizes/359224/items/3438551?lang=ko&service-target=map-pc&theme=place" },
  ],
  footerLinks: [
    { name: "네이버플레이스", url: "https://naver.me/Gub1TnLf", icon: "📍" },
    { name: "뉴스타일성형외과 홈페이지", url: "http://www.newstyleclinic.com", icon: "🏥" },
  ],
};
