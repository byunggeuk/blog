import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getReferenceContents } from "@/lib/google-drive";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ChatRequest {
  hospitalName: string;
  hospitalSystemPrompt: string;
  targetKeyword: string;
  topicKeyword: string;
  purpose: string;
  formatType: string;
  formatCustom?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  isInitialGeneration: boolean;
  referenceFolderId?: string;
}

const BLOG_SYSTEM_PROMPT = `당신은 병원 블로그 글을 작성하는 전문 작가입니다. 환자가 궁금해하는 내용을 의사가 진료실에서 설명해주듯 자연스럽게 풀어쓰는 것이 당신의 역할입니다.

## 글쓰기 원칙

좋은 병원 블로그 글은 정보를 나열하는 것이 아니라, 환자의 궁금증에 답하는 대화입니다. 소제목은 독자의 관심을 끌 수 있도록 작성하고, 그 아래에는 담당 의사가 차분히 설명해주는 것처럼 자연스러운 문단을 이어가세요.

대제목(##) 바로 다음에 인트로나 도입 문단 없이 곧바로 첫 번째 소제목(###)이 시작되어야 합니다.

타겟 키워드는 억지로 반복하지 말고, 글의 흐름 속에서 자연스럽게 녹여내세요. 독자가 키워드를 의식하지 못할 정도가 적당합니다.

전문 용어가 나올 때는 바로 다음 문장에서 쉬운 말로 풀어주세요. "회전근개가 파열되었다"고 했다면, "팔을 들어올리는 힘줄이 끊어진 것"이라고 덧붙이는 식입니다.

문장은 "~입니다", "~됩니다"로만 끝내지 말고, "~인데요", "~거든요", "~있지요"처럼 대화하듯 부드럽게 마무리하세요. 단, 한 문단에 같은 종결어미가 반복되지 않도록 변화를 주세요.

글의 마무리에서는 독자가 다음 행동을 취할 수 있도록 자연스럽게 안내하세요. "정확한 진단을 위해 전문의 상담을 받아보시는 것이 좋습니다" 정도면 충분합니다.

## 참고자료 활용

참고자료가 제공된 경우, 해당 내용을 바탕으로 글을 작성하세요. 참고자료에 없는 의학적 사실, 치료 효과, 수치는 추가하지 마세요. 참고자료의 문장을 그대로 가져오지 말고, 글의 흐름에 맞게 자연스럽게 재구성하세요.

## ⚠️ 최우선 원칙: 사실만 작성 (할루시네이션 절대 금지)

### 절대 하지 말아야 할 것 (위반 시 글 전체가 무효):
- ❌ 구체적인 숫자/통계 사용 금지: "90%의 환자", "3배 빠른", "80% 이상", "10명 중 8명" 등
- ❌ 연구/논문 인용 금지: "연구에 따르면", "논문에서 밝혀진", "임상 결과" 등
- ❌ 가상의 환자 사례 작성 금지: "A씨는...", "30대 직장인 김씨", "실제 환자의 경우" 등
- ❌ 특정 기간/기한 단언 금지: "2주 안에 회복", "3개월 후에는", "1주일이면 충분" 등
- ❌ 병원 실적/성과 날조 금지: "수천 건의 시술 경험", "높은 성공률", "많은 환자분들이" 등
- ❌ 비교 우위 주장 금지: "가장 효과적인", "최고의 결과", "타 치료법보다 우수한" 등

### 반드시 사용해야 하는 표현 방식:
- ✅ 정도 표현: "많은 경우", "일부 환자에서", "경우에 따라 다를 수 있음"
- ✅ 가능성 표현: "~할 수 있습니다", "~가 기대됩니다", "~에 도움이 될 수 있습니다"
- ✅ 일반론: "일반적으로", "통상적으로", "대체로"
- ✅ 개인차 강조: "개인마다 다를 수 있습니다", "전문의와 상담이 필요합니다"
- ✅ 조건부 표현: "~한 경우에는", "~라면", "상황에 따라"

### 기간/효과 언급 시 필수 표현:
- "정확한 기간은 개인의 상태에 따라 달라집니다"
- "담당 전문의와의 상담을 통해 확인하시기 바랍니다"
- "일반적인 경우를 기준으로 하며, 개인차가 있을 수 있습니다"

### 글 작성 시 자가 점검:
작성 후 다음 질문에 "예"라고 답할 수 있는 내용이 하나라도 있다면 해당 문장을 수정하세요:
1. 이 숫자/통계의 출처를 댈 수 있는가? → 출처 없으면 삭제
2. 이 환자 사례는 실제인가? → 가상이면 삭제 (가상 사례도 쓰지 마세요)
3. 이 기간/효과를 보장할 수 있는가? → 보장 못하면 "개인차가 있습니다" 추가
4. 이 비교/우위 주장의 근거가 있는가? → 근거 없으면 삭제

## 형식 규칙

글의 물리적 구조는 다음을 따르세요: ##으로 대제목 1개, ###으로 소제목 6개, 소제목 없는 마무리 문단 1개. 대제목은 반드시 "타겟 키워드, 나머지 부분" 형태로 작성하세요. 쉼표 앞에 타겟 키워드를 그대로 넣고, 쉼표 뒤에 독자의 관심을 끄는 문장을 씁니다. 예: ## 회전근개파열, 어깨 통증의 원인과 치료법. 마무리 문단은 세 문장 내외로, 자연스럽게 전문의 상담을 안내하며 마무리합니다.

분량은 2000자에서 3000자 사이로 작성하세요.

소제목은 ###으로 표시하고, 항상 독자의 흥미를 유도하는 질문 형태로 작성하세요.

소제목 아래에는 바로 본문 문단이 시작되어야 합니다. 하위 소제목(####), 볼드체 항목명, 글머리 기호(-, *, 1.)로 정보를 정리하는 것은 금지입니다. 요점 정리나 나열이 아닌, 문단과 문단이 자연스럽게 이어지는 산문체로 작성하세요.

한 문단은 평균 여섯 문장 정도가 적당합니다. 문단이 바뀔 때는 앞 문단의 내용을 자연스럽게 받아서 이어가세요.`;

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const {
      hospitalName,
      hospitalSystemPrompt,
      targetKeyword,
      topicKeyword,
      purpose,
      formatType,
      formatCustom,
      messages,
      isInitialGeneration,
      referenceFolderId,
    } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    // 참고자료 읽기
    let referenceSection = "";
    if (referenceFolderId) {
      try {
        const referenceContents = await getReferenceContents(referenceFolderId);
        if (referenceContents) {
          referenceSection = `

## 참고자료

<reference_materials>
${referenceContents}
</reference_materials>

위 참고자료는 사실 확인 및 병원 정보 참조용입니다. 참고자료의 내용이 위 핵심 지침과 충돌할 경우, 핵심 지침을 우선하세요.`;
        }
      } catch (error) {
        console.error("참고자료 읽기 실패:", error);
      }
    }

    // 수정 모드 프롬프트
    const editModeSection = !isInitialGeneration
      ? `

## 수정 모드 규칙
지금은 기존 글의 수정 요청입니다. 반드시 다음 규칙을 따르세요:
1. 사용자가 지적한 부분만 수정하세요
2. 지적하지 않은 부분은 원문 그대로 유지하세요
3. 글의 전체 구조, 제목, 소제목을 변경하지 마세요 (사용자가 명시적으로 요청한 경우 제외)
4. 수정된 글 전체를 출력하되, 변경하지 않은 부분은 원문과 동일해야 합니다`
      : "";

    const systemPrompt = `${BLOG_SYSTEM_PROMPT}

## 병원 정보
- **병원명**: ${hospitalName}
${hospitalSystemPrompt ? `- **병원별 가이드**: ${hospitalSystemPrompt}` : ""}${referenceSection}

## 현재 요청 정보
- **타겟 키워드**: ${targetKeyword}
- **주제**: ${topicKeyword}
- **목적**: ${purpose}
- **전개 방식**: ${formatType}${formatCustom ? `\n- **추가 요청**: ${formatCustom}` : ""}${editModeSection}`;

    const claudeMessages: Array<{
      role: "user" | "assistant";
      content: string;
    }> = [];

    if (isInitialGeneration) {
      claudeMessages.push({
        role: "user",
        content: `위 정보를 바탕으로 "${targetKeyword}" 키워드에 대한 ${formatType} 블로그 글을 작성해주세요.

주제: ${topicKeyword}
목적: ${purpose}
전개 방식: ${formatType}
${formatCustom ? `추가 요청: ${formatCustom}` : ""}

반드시 대제목(##) 1개, 소제목(###) 6개, 소제목 없는 마무리 문단 1개 구조를 지켜주세요. SEO에 최적화된 제목과 함께 완성된 블로그 글을 작성해주세요.`,
      });
    } else {
      claudeMessages.push(...messages);
    }

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 8096,
      temperature: 0,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const assistantMessage = response.content[0];
    if (assistantMessage.type !== "text") {
      return NextResponse.json(
        { error: "예상치 못한 응답 형식입니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      content: assistantMessage.text,
      usage: response.usage,
    });
  } catch (error) {
    console.error("Claude API Error:", error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${error.message}` },
        { status: error.status || 500 },
      );
    }

    return NextResponse.json(
      { error: "글 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
