import { NextRequest, NextResponse } from "next/server";
import { getRequests, addRequest, updateRequest } from "@/lib/google-sheets";
import { mockRequests } from "@/lib/mock-data";
import { BlogRequest } from "@/types";
import {
  notifyNewRequest,
  notifyRequestCompleted,
  notifyRevisionRequested,
  notifyRevisionCompleted,
  notifyError,
} from "@/lib/slack";
import { google } from "googleapis";

// 사용자의 slack_member_id 조회
async function getUserSlackMemberId(
  userEmail: string,
): Promise<string | undefined> {
  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    !process.env.GOOGLE_USERS_SPREADSHEET_ID
  ) {
    return undefined;
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_USERS_SPREADSHEET_ID,
      range: "사용자!A2:F100", // id, email, name, role, status, slack_member_id
    });

    const rows = response.data.values || [];
    const user = rows.find((row) => row[1] === userEmail);
    return user?.[5] || undefined; // slack_member_id는 6번째 컬럼 (인덱스 5)
  } catch (error) {
    console.error("Failed to get user slack_member_id:", error);
    return undefined;
  }
}

// GET: 요청 가져오기 (본인 요청만 또는 관리자는 전체)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("userEmail");
    const isAdmin = searchParams.get("isAdmin") === "true";

    // Google Sheets 연동이 설정되어 있으면 시트에서 가져옴
    if (
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
      process.env.GOOGLE_SPREADSHEET_ID
    ) {
      let requests = await getRequests();

      // 관리자가 아니면 본인 요청만 필터링
      if (!isAdmin && userEmail) {
        requests = requests.filter((req) => req.created_by === userEmail);
      }

      return NextResponse.json({ requests, source: "sheets" });
    }

    // mock 데이터 반환 (필터링 적용)
    let requests = mockRequests;
    if (!isAdmin && userEmail) {
      requests = requests.filter((req) => req.created_by === userEmail);
    }
    return NextResponse.json({ requests, source: "mock" });
  } catch (error) {
    console.error("Requests API Error:", error);

    // 에러 시 mock 데이터로 폴백
    return NextResponse.json({
      requests: mockRequests,
      source: "mock",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// POST: 새 요청 추가
export async function POST(request: NextRequest) {
  try {
    const body: BlogRequest = await request.json();

    // Google Sheets 연동이 설정되어 있으면 시트에 추가
    if (
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
      process.env.GOOGLE_SPREADSHEET_ID
    ) {
      await addRequest(body);

      // Slack 알림 발송 (비동기, 실패해도 무시)
      notifyNewRequest({
        requestId: body.request_id,
        hospitalName: body.hospital_name,
        targetKeyword: body.target_keyword,
        topicKeyword: body.topic_keyword,
        formatType: body.format_type,
        createdBy: body.created_by,
      }).catch(console.error);

      return NextResponse.json({ success: true, source: "sheets" });
    }

    // mock 모드에서는 성공만 반환 (실제 저장 안 됨)
    return NextResponse.json({ success: true, source: "mock" });
  } catch (error) {
    console.error("Add Request API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// PUT: 요청 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body: BlogRequest = await request.json();

    // Google Sheets 연동이 설정되어 있으면 시트 업데이트
    if (
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
      process.env.GOOGLE_SPREADSHEET_ID
    ) {
      await updateRequest(body);

      // 요청자의 slack_member_id 조회 (개인 DM 알림용)
      const slackMemberId = await getUserSlackMemberId(body.created_by);

      // 상태에 따른 Slack 알림 발송 (비동기, 실패해도 무시)
      switch (body.status) {
        case "완료":
          notifyRequestCompleted({
            requestId: body.request_id,
            hospitalName: body.hospital_name,
            targetKeyword: body.target_keyword,
            docUrl: body.result_doc_url,
            slackMemberId,
          }).catch(console.error);
          break;

        case "수정요청":
          notifyRevisionRequested({
            requestId: body.request_id,
            hospitalName: body.hospital_name,
            targetKeyword: body.target_keyword,
            revisionRequest: body.revision_request || "",
            revisionCount: body.revision_count,
            slackMemberId,
          }).catch(console.error);
          break;

        case "수정완료":
          notifyRevisionCompleted({
            requestId: body.request_id,
            hospitalName: body.hospital_name,
            targetKeyword: body.target_keyword,
            revisionCount: body.revision_count,
            docUrl: body.result_doc_url,
            slackMemberId,
          }).catch(console.error);
          break;

        case "에러":
          const lastMessage = body.chat_history[body.chat_history.length - 1];
          notifyError({
            requestId: body.request_id,
            hospitalName: body.hospital_name,
            errorMessage: lastMessage?.content || "알 수 없는 오류",
            slackMemberId,
          }).catch(console.error);
          break;
      }

      return NextResponse.json({ success: true, source: "sheets" });
    }

    // mock 모드에서는 성공만 반환
    return NextResponse.json({ success: true, source: "mock" });
  } catch (error) {
    console.error("Update Request API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
