import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

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
}

const BLOG_SYSTEM_PROMPT = `당신은 병원 마케팅을 위한 전문 블로그 글 작성 AI입니다. 다음 가이드라인을 준수하세요:

1. **SEO 최적화**: 타겟 키워드를 자연스럽게 본문에 포함시키세요. 제목, 소제목, 본문에 키워드가 적절히 분포되어야 합니다.

2. **전문성과 친근함의 균형**: 의학적으로 정확한 정보를 제공하되, 일반인도 이해하기 쉬운 언어로 작성하세요.

3. **환자 공감**: 환자의 고민과 걱정을 이해하고, 그들의 관점에서 글을 작성하세요.

4. **신뢰성**: 과장된 표현을 피하고, 실제 의료 정보에 기반한 내용을 작성하세요.

5. **Call to Action**: 글의 마무리에서 자연스럽게 병원 상담을 유도하는 문구를 포함하세요.

6. **글 구조별 특성**:
   - Q&A형: 환자들이 자주 묻는 질문과 전문적인 답변 형식
   - 정보제공형: 치료/시술에 대한 일반적인 의학 정보 전달
   - 치료과정 안내형: 치료 과정을 단계별로 일반적인 관점에서 설명
   - 비교분석형: 여러 치료법의 일반적으로 알려진 장단점을 비교
   - 팩트체크형: 흔한 오해나 잘못된 정보를 의학적 사실로 바로잡는 형식
   - 칼럼형: 전문의 관점에서 작성하는 전문 칼럼

7. **분량**: 2000-3000자 내외로 작성하세요.

8. **마크다운 형식**: 제목(##), 소제목(###), 굵은 글씨(**), 리스트(-, 1.) 등을 활용해 가독성을 높이세요.

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
4. 이 비교/우위 주장의 근거가 있는가? → 근거 없으면 삭제`;

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
    } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const systemPrompt = `${BLOG_SYSTEM_PROMPT}

## 병원 정보
- **병원명**: ${hospitalName}
${hospitalSystemPrompt ? `- **병원별 가이드**: ${hospitalSystemPrompt}` : ''}

## 현재 요청 정보
- **타겟 키워드**: ${targetKeyword}
- **주제**: ${topicKeyword}
- **목적**: ${purpose}
- **글 구조**: ${formatType}${formatCustom ? `\n- **추가 요청**: ${formatCustom}` : ''}`;

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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
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
