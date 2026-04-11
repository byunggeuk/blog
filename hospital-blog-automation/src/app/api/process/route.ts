import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getReferenceContents } from "@/lib/google-drive";
import { generateBlog, generateHtmlBlog, NEWSTYLE_LINKS } from "@/lib/blog-generator";
import { LinkInfo } from "@/lib/prompts";

// Google Sheets 인증
function getAuthClient() {
  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}",
  );
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

function getSpreadsheetId() {
  return process.env.GOOGLE_SPREADSHEET_ID || "";
}

// 구글 시트 친화적인 날짜 형식 (YYYY-MM-DD HH:mm:ss)
function formatDateForSheets(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 병원 정보 가져오기
async function getHospitalById(
  sheets: any,
  spreadsheetId: string,
  hospitalId: string,
) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "병원설정!A2:J100",
  });

  const rows = response.data.values || [];
  for (const row of rows) {
    if (row[0] === hospitalId) {
      return {
        hospital_id: row[0] || "",
        hospital_name: row[1] || "",
        blog_url: row[2] || "",
        reference_folder_id: row[3] || "",
        output_folder_id: row[4] || "",
        prompt_name: row[5] || "",
        system_prompt: row[6] || "",
        output_format: (row[7] || "html").toLowerCase() as "markdown" | "html",
      };
    }
  }
  return null;
}

// 병원별 링크 정보 가져오기
function getHospitalLinks(hospitalId: string): LinkInfo | undefined {
  const linksByHospital: Record<string, LinkInfo> = {
    "newstyle": NEWSTYLE_LINKS,
    "뉴스타일": NEWSTYLE_LINKS,
    "뉴스타일성형외과": NEWSTYLE_LINKS,
  };
  return linksByHospital[hospitalId];
}

// 요청 상태 업데이트
async function updateRequestStatus(
  sheets: any,
  spreadsheetId: string,
  rowIndex: number,
  status: string,
  resultDocId?: string,
  resultDocUrl?: string,
  completedAt?: string,
  chatHistory?: string,
) {
  const updates: any[] = [];

  updates.push({
    range: `요청목록!J${rowIndex}`,
    values: [[status]],
  });

  if (resultDocId) {
    updates.push({ range: `요청목록!K${rowIndex}`, values: [[resultDocId]] });
  }
  if (resultDocUrl) {
    updates.push({ range: `요청목록!L${rowIndex}`, values: [[resultDocUrl]] });
  }
  if (completedAt) {
    updates.push({ range: `요청목록!N${rowIndex}`, values: [[completedAt]] });
  }
  if (chatHistory) {
    updates.push({ range: `요청목록!O${rowIndex}`, values: [[chatHistory]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates,
    },
  });
}

// Google Drive에 파일 생성 (마크다운 또는 HTML)
async function createOutputFile(
  drive: any,
  fileName: string,
  content: string,
  folderId: string | undefined,
  format: "markdown" | "html" = "html",
) {
  if (!folderId) {
    throw new Error(
      "output_folder_id가 설정되지 않았습니다. 병원설정에서 출력 폴더 ID를 확인해주세요.",
    );
  }

  const extension = format === "html" ? "html" : "md";
  const mimeType = format === "html" ? "text/html" : "text/markdown";

  const fileMetadata: any = {
    name: `${fileName}.${extension}`,
    mimeType: mimeType,
    parents: [folderId],
  };

  const createResponse = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: mimeType,
      body: content,
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const fileId = createResponse.data.id;
  if (!fileId) {
    throw new Error("파일 생성에 실패했습니다.");
  }

  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true,
  });

  return {
    fileId,
    fileUrl:
      createResponse.data.webViewLink ||
      `https://drive.google.com/file/d/${fileId}/view`,
  };
}

// Claude API로 블로그 글 생성 (2단계 생성 또는 단일 패스)
async function generateBlogContent(
  hospitalName: string,
  hospitalId: string,
  hospitalSystemPrompt: string,
  targetKeyword: string,
  topicKeyword: string,
  purpose: string,
  formatType: string,
  formatCustom?: string,
  referenceText?: string,
  outputFormat: "markdown" | "html" = "html",
) {
  if (outputFormat === "html") {
    const links = getHospitalLinks(hospitalId);
    const result = await generateHtmlBlog({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      hospitalName,
      hospitalSystemPrompt,
      targetKeyword,
      topicKeyword,
      purpose,
      formatType,
      formatCustom,
      referenceText: referenceText || undefined,
      links,
    });
    return result.content;
  } else {
    const result = await generateBlog({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      hospitalName,
      hospitalSystemPrompt,
      targetKeyword,
      topicKeyword,
      purpose,
      formatType,
      formatCustom,
      referenceText: referenceText || undefined,
    });
    return result.content;
  }
}

// POST: 대기 중인 요청 처리
export async function POST() {
  let currentProcessingRowIndex: number | null = null;
  let currentRequestId: string | null = null;

  try {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      !process.env.GOOGLE_SPREADSHEET_ID
    ) {
      return NextResponse.json(
        { error: "Google Sheets 환경변수가 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Anthropic API 키가 설정되지 않았습니다." },
        { status: 400 },
      );
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });
    const spreadsheetId = getSpreadsheetId();

    // 요청 목록 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "요청목록!A2:P1000",
    });

    const rows = response.data.values || [];
    const results: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const status = row[9] || "";

      // 이미 처리된 상태는 건너뜀 (완료, 생성중, 에러, 수정요청, 수정완료, 업로드완료)
      if (status && status !== "대기") continue;

      const rowIndex = i + 2;
      const requestId = row[0] || "";
      const hospitalId = row[2] || "";
      const targetKeyword = row[4] || "";
      const topicKeyword = row[5] || "";
      const purpose = row[6] || "";
      const formatType = row[7] || "";
      const formatCustom = row[8] || "";

      // 필수 필드 검증: 모든 필수 정보가 입력되었는지 확인
      // (format_custom은 선택사항이므로 검증하지 않음)
      if (
        !requestId ||
        !hospitalId ||
        !targetKeyword ||
        !topicKeyword ||
        !purpose ||
        !formatType
      ) {
        // 필수 필드가 비어있으면 건너뜀 (아직 입력 중인 상태)
        continue;
      }

      // created_at이 비어있으면 현재 시간으로 설정
      const createdAt = row[1] || formatDateForSheets();
      if (!row[1]) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `요청목록!B${rowIndex}`,
          valueInputOption: "RAW",
          requestBody: { values: [[createdAt]] },
        });
      }

      try {
        currentProcessingRowIndex = rowIndex;
        currentRequestId = requestId;
        await updateRequestStatus(sheets, spreadsheetId, rowIndex, "생성중");

        const hospital = await getHospitalById(
          sheets,
          spreadsheetId,
          hospitalId,
        );
        if (!hospital) {
          await updateRequestStatus(sheets, spreadsheetId, rowIndex, "에러");
          results.push({
            requestId,
            status: "error",
            message: "병원 정보를 찾을 수 없습니다.",
          });
          continue;
        }

        // 참고자료 읽기
        let referenceText = "";
        if (hospital.reference_folder_id) {
          try {
            referenceText = await getReferenceContents(
              hospital.reference_folder_id,
            );
          } catch (refError) {
            console.error(
              `참고자료 읽기 실패 (${hospital.hospital_name}):`,
              refError,
            );
          }
        }

        const content = await generateBlogContent(
          hospital.hospital_name,
          hospital.hospital_id,
          hospital.system_prompt,
          targetKeyword,
          topicKeyword,
          purpose,
          formatType,
          formatCustom,
          referenceText,
          hospital.output_format,
        );

        const fileName = `${targetKeyword}_${requestId}`;
        const { fileId, fileUrl } = await createOutputFile(
          drive,
          fileName,
          content,
          hospital.output_folder_id,
          hospital.output_format,
        );

        const now = formatDateForSheets();
        const chatHistory = JSON.stringify([
          {
            id: `msg_${Date.now()}_1`,
            role: "system",
            content: `블로그 글 생성을 시작합니다.\n\n**타겟 키워드:** ${targetKeyword}\n**주제:** ${topicKeyword}\n**전개 방식:** ${formatType}`,
            created_at: now,
          },
          {
            id: `msg_${Date.now()}_2`,
            role: "assistant",
            content: content,
            created_at: now,
            doc_id: fileId,
            doc_url: fileUrl,
          },
        ]);

        await updateRequestStatus(
          sheets,
          spreadsheetId,
          rowIndex,
          "완료",
          fileId,
          fileUrl,
          now,
          chatHistory,
        );

        currentProcessingRowIndex = null;
        currentRequestId = null;

        results.push({
          requestId,
          status: "completed",
          fileId,
          fileUrl,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "알 수 없는 오류";
        console.error(`요청 ${requestId} 처리 실패:`, error);
        const errorChatHistory = JSON.stringify([
          {
            id: `error_${Date.now()}`,
            role: "system",
            content: `에러 발생: ${errorMessage}`,
            created_at: formatDateForSheets(),
          },
        ]);

        // 상태 업데이트 시도 - 실패해도 계속 진행
        try {
          await updateRequestStatus(
            sheets,
            spreadsheetId,
            rowIndex,
            "에러",
            undefined,
            undefined,
            undefined,
            errorChatHistory,
          );
        } catch (updateError) {
          console.error(`요청 ${requestId} 상태 업데이트 실패:`, updateError);
        }

        currentProcessingRowIndex = null;
        currentRequestId = null;

        results.push({
          requestId,
          status: "error",
          message: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Process API Error:", error);

    // 처리 중이던 요청이 있으면 상태를 '대기'로 복구 시도
    if (currentProcessingRowIndex !== null) {
      try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = getSpreadsheetId();
        const errorChatHistory = JSON.stringify([
          {
            id: `error_${Date.now()}`,
            role: "system",
            content: `에러 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
            created_at: formatDateForSheets(),
          },
        ]);
        await updateRequestStatus(
          sheets,
          spreadsheetId,
          currentProcessingRowIndex,
          "에러",
          undefined,
          undefined,
          undefined,
          errorChatHistory,
        );
        console.log(`요청 ${currentRequestId} 상태를 '에러'로 복구했습니다.`);
      } catch (recoveryError) {
        console.error(
          `요청 ${currentRequestId} 상태 복구 실패:`,
          recoveryError,
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "처리 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return POST();
}
