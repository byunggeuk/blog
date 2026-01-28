import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getReferenceContents } from '@/lib/google-drive';

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
    role: 'user' | 'assistant';
    content: string;
  }>;
  isInitialGeneration: boolean;
  referenceFolderId?: string;
}

const BLOG_SYSTEM_PROMPT = `당신은 병원 블로그 글을 작성하는 전문 작가입니다. 환자가 궁금해하는 내용을 의사가 진료실에서 설명해주듯 자연스럽게 풀어쓰는 것이 당신의 역할입니다.

## 글쓰기 원칙

좋은 병원 블로그 글은 정보를 나열하는 것이 아니라, 환자의 궁금증에 답하는 대화입니다. 소제목은 환자가 실제로 물어볼 법한 질문 형태로 작성하고, 그 아래에는 담당 의사가 차분히 설명해주는 것처럼 자연스러운 문단을 이어가세요.

타겟 키워드는 억지로 반복하지 말고, 글의 흐름 속에서 자연스럽게 녹여내세요. 독자가 키워드를 의식하지 못할 정도가 적당합니다.

전문 용어가 나올 때는 바로 다음 문장에서 쉬운 말로 풀어주세요. "회전근개가 파열되었다"고 했다면, "팔을 들어올리는 힘줄이 끊어진 것"이라고 덧붙이는 식입니다.

글의 마무리에서는 독자가 다음 행동을 취할 수 있도록 자연스럽게 안내하세요. "정확한 진단을 위해 전문의 상담을 받아보시는 것이 좋습니다" 정도면 충분합니다.

## 절대 지켜야 할 사실 원칙

의료 정보는 신뢰가 생명입니다. 출처 없는 숫자, 가상의 사례, 검증되지 않은 주장은 글 전체의 신뢰를 무너뜨립니다.

구체적인 통계나 수치는 사용하지 마세요. "90%의 환자가 호전"이나 "3배 빠른 회복" 같은 표현은 출처가 있어도 쓰지 않습니다. 대신 "많은 경우", "상당한 호전을 기대할 수 있습니다" 같은 정도 표현을 사용하세요.

가상의 환자 사례도 만들지 마세요. "30대 직장인 A씨"나 "실제 환자의 경우" 같은 이야기는 사실처럼 보이지만 지어낸 것이므로 신뢰를 해칩니다.

회복 기간이나 치료 효과를 단정짓지 마세요. "2주면 회복됩니다"가 아니라 "회복 기간은 개인의 상태에 따라 다르며, 담당 전문의와 상담을 통해 확인하실 수 있습니다"라고 쓰세요.

병원의 실적이나 다른 치료법과의 비교 우위도 주장하지 마세요. "수천 건의 경험", "가장 효과적인 치료"는 검증할 수 없는 주장입니다.

## 형식 규칙

글의 맨 처음에는 ##으로 대제목을 작성하세요. 대제목은 타겟 키워드를 포함하면서 독자의 관심을 끄는 문장으로 씁니다.

분량은 2000자에서 3000자 사이로 작성하세요.

소제목은 ###으로 표시하고, 질문형으로 작성하세요. "회전근개 파열의 증상"이 아니라 "회전근개가 파열되면 어떤 증상이 나타나나요?"처럼 씁니다.

소제목 아래에는 바로 본문 문단이 시작되어야 합니다. 하위 소제목을 추가하거나, 볼드체로 항목명을 나열하거나, 글머리 기호로 정보를 정리하는 것은 금지입니다. 문단과 문단이 자연스럽게 이어지는 산문체로 작성하세요.

한 문단은 두세 문장에서 네다섯 문장 정도가 적당합니다. 문단이 바뀔 때는 앞 문단의 내용을 자연스럽게 받아서 이어가세요.`;

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
        { error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 참고자료 읽기
    let referenceSection = '';
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
        console.error('참고자료 읽기 실패:', error);
      }
    }

    // 수정 모드 프롬프트
    const editModeSection = !isInitialGeneration ? `

## 수정 모드 규칙
지금은 기존 글의 수정 요청입니다. 반드시 다음 규칙을 따르세요:
1. 사용자가 지적한 부분만 수정하세요
2. 지적하지 않은 부분은 원문 그대로 유지하세요
3. 글의 전체 구조, 제목, 소제목을 변경하지 마세요 (사용자가 명시적으로 요청한 경우 제외)
4. 수정된 글 전체를 출력하되, 변경하지 않은 부분은 원문과 동일해야 합니다` : '';

    const systemPrompt = `${BLOG_SYSTEM_PROMPT}

## 병원 정보
- **병원명**: ${hospitalName}
${hospitalSystemPrompt ? `- **병원별 가이드**: ${hospitalSystemPrompt}` : ''}${referenceSection}

## 현재 요청 정보
- **타겟 키워드**: ${targetKeyword}
- **주제**: ${topicKeyword}
- **목적**: ${purpose}
- **글 구조**: ${formatType}${formatCustom ? `\n- **추가 요청**: ${formatCustom}` : ''}${editModeSection}`;

    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (isInitialGeneration) {
      claudeMessages.push({
        role: 'user',
        content: `위 정보를 바탕으로 "${targetKeyword}" 키워드에 대한 ${formatType} 블로그 글을 작성해주세요.

주제: ${topicKeyword}
목적: ${purpose}
${formatCustom ? `추가 요청: ${formatCustom}` : ''}

SEO에 최적화된 제목과 함께 완성된 블로그 글을 작성해주세요.`,
      });
    } else {
      claudeMessages.push(...messages);
    }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4096,
      temperature: 0.8,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const assistantMessage = response.content[0];
    if (assistantMessage.type !== 'text') {
      return NextResponse.json(
        { error: '예상치 못한 응답 형식입니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      content: assistantMessage.text,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Claude API Error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: '글 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
