import { NextResponse } from "next/server";
import { google } from "googleapis";

function getAuthClient() {
  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}",
  );
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// POST: 사용자 시트 데이터 수정
export async function POST() {
  try {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      !process.env.GOOGLE_USERS_SPREADSHEET_ID
    ) {
      return NextResponse.json(
        { error: "Google Sheets 환경변수가 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_USERS_SPREADSHEET_ID;

    // 현재 사용자 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "사용자!A:I",
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({
        message: "수정할 데이터가 없습니다.",
        fixed: 0,
      });
    }

    // 올바른 헤더
    const correctHeader = [
      "id",
      "email",
      "name",
      "role",
      "status",
      "slack_member_id",
      "created_at",
      "approved_at",
      "blocked_at",
    ];

    // 데이터 수정
    let fixedCount = 0;
    const fixedRows = rows.map((row, index) => {
      if (index === 0) {
        return correctHeader;
      }

      // created_at 필드(인덱스 6)가 비어있고 slack_member_id(인덱스 5)에 날짜가 있는 경우 수정
      const slackIdValue = row[5] || "";
      const createdAtValue = row[6] || "";

      // slack_member_id에 날짜 형식이 들어가 있으면 데이터가 밀린 것
      if (
        slackIdValue &&
        slackIdValue.includes("T") &&
        slackIdValue.includes("Z") &&
        !createdAtValue
      ) {
        // 데이터 재배치: slack_member_id 위치의 값을 created_at으로 이동
        fixedCount++;
        return [
          row[0] || "", // id
          row[1] || "", // email
          row[2] || "", // name
          row[3] || "", // role
          row[4] || "", // status
          "", // slack_member_id (비움)
          slackIdValue, // created_at ← slack_member_id 위치에 있던 날짜값
          row[7] || "", // approved_at
          row[8] || "", // blocked_at
        ];
      }

      // 정상 데이터는 그대로
      const newRow = [...row];
      while (newRow.length < 9) newRow.push("");
      return newRow;
    });

    // 시트 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `사용자!A1:I${fixedRows.length}`,
      valueInputOption: "RAW",
      requestBody: { values: fixedRows },
    });

    return NextResponse.json({
      success: true,
      message: "사용자 시트 데이터 수정 완료",
      fixed: fixedCount,
    });
  } catch (error) {
    console.error("Fix Users Sheet Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "수정 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
