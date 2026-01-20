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
   - 사례/스토리텔링형: 실제 또는 가상의 환자 사례를 바탕으로 한 이야기
   - 실패분석형: 잘못된 치료나 관리로 인한 실패 사례와 교훈
   - 치료과정 시뮬레이션형: 치료 과정을 단계별로 상세히 설명
   - 비교분석형: 여러 치료법의 장단점을 객관적으로 비교
   - 팩트체크형: 흔한 오해나 잘못된 정보를 바로잡는 형식
   - 칼럼형: 전문의 관점에서 작성하는 전문 칼럼

7. **분량**: 2000-3000자 내외로 작성하세요.

8. **마크다운 형식**: 제목(##), 소제목(###), 굵은 글씨(**), 리스트(-, 1.) 등을 활용해 가독성을 높이세요.

9. **중요: 정보 정확성 원칙 (할루시네이션 방지)**:
   - 확인되지 않은 구체적 수치(%, 통계, 연구 결과)를 만들어내지 마세요.
   - 구체적인 환자 사례는 "예시" 또는 "가상 사례"임을 반드시 명시하세요.
   - 모르는 정보는 일반적인 설명으로 대체하고, 절대 지어내지 마세요.
   - 의학적 정보는 일반적으로 알려진 내용만 작성하세요.
   - 특정 연구나 논문을 인용할 때는 "연구에 따르면" 대신 "일반적으로 알려진 바에 따르면"으로 표현하세요.`;

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
      temperature: 0.3,
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
