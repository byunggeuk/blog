import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getReferenceContents } from "@/lib/google-drive";
import { buildSystemPrompt } from "@/lib/prompts";
import { generateBlog } from "@/lib/blog-generator";

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
    let referenceContents = "";
    if (referenceFolderId) {
      try {
        referenceContents = await getReferenceContents(referenceFolderId);
      } catch (error) {
        console.error("참고자료 읽기 실패:", error);
      }
    }

    if (isInitialGeneration) {
      // 초기 생성: 2단계 생성 (Plan → Write) 또는 단일 패스
      const result = await generateBlog({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        hospitalName,
        hospitalSystemPrompt,
        targetKeyword,
        topicKeyword,
        purpose,
        formatType,
        formatCustom,
        referenceText: referenceContents || undefined,
      });

      return NextResponse.json({
        content: result.content,
        validation: result.validation,
      });
    }

    // 수정 모드: 대화 히스토리 기반
    const systemPrompt = buildSystemPrompt({
      hospitalName,
      hospitalSystemPrompt,
      isEditMode: true,
    });

    const claudeMessages: Array<{
      role: "user" | "assistant";
      content: string;
    }> = [];

    // 참고자료가 있으면 대화 히스토리 앞에 리마인더 삽입
    if (referenceContents && messages.length > 0) {
      claudeMessages.push({
        role: "user",
        content: `참고: 이 글은 아래 참고자료에 근거하여 작성되었습니다. 수정 시에도 참고자료의 내용을 유지해주세요.

<reference_materials>
${referenceContents}
</reference_materials>`,
      });
      claudeMessages.push({
        role: "assistant",
        content: "네, 참고자료를 확인했습니다. 수정 요청을 말씀해주세요.",
      });
    }
    claudeMessages.push(...messages);

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 8096,
      temperature: 0.8,
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
