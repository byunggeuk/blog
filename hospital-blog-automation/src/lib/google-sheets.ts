import { google } from "googleapis";
import {
  Hospital,
  BlogRequest,
  ChatMessage,
  FormatType,
  RequestStatus,
} from "@/types";

// Service Account 인증 설정
function getAuthClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.",
    );
  }

  const serviceAccount = JSON.parse(credentials);

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth;
}

// 시트 ID는 환경변수에서 가져옴
function getSpreadsheetId() {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) {
    throw new Error("GOOGLE_SPREADSHEET_ID 환경변수가 설정되지 않았습니다.");
  }
  return id;
}

// ============ 병원 데이터 ============
// 시트 컬럼 순서: hospital_id, hospital_name, blog_url, reference_folder_id, output_folder_id, prompt_name, system_prompt, created_at, is_active

export async function getHospitals(): Promise<Hospital[]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "병원설정!A2:I100", // 헤더 제외
  });

  const rows = response.data.values || [];

  return rows
    .filter((row) => row[0] && row[0].trim() !== "") // 빈 hospital_id 필터링
    .map((row) => ({
      hospital_id: row[0] || "",
      hospital_name: row[1] || "",
      blog_url: row[2] || "",
      reference_folder_id: row[3] || "",
      output_folder_id: row[4] || "",
      prompt_name: row[5] || "",
      system_prompt: row[6] || "",
      created_at: row[7] || new Date().toISOString(),
      // is_active: 명시적으로 FALSE가 아니면 true (빈 값이나 없는 경우도 true)
      is_active: row[8] !== "FALSE" && row[8] !== "false" && row[8] !== "0",
    }));
}

// 병원 추가
export async function addHospital(hospital: Hospital): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  const row = [
    hospital.hospital_id,
    hospital.hospital_name,
    hospital.blog_url || "",
    hospital.reference_folder_id || "",
    hospital.output_folder_id || "",
    hospital.prompt_name || "",
    hospital.system_prompt,
    hospital.created_at,
    hospital.is_active ? "TRUE" : "FALSE",
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "병원설정!A:I",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
}

// 병원 업데이트
export async function updateHospital(hospital: Hospital): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  // 해당 hospital_id의 행 번호 찾기
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "병원설정!A:A",
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === hospital.hospital_id);

  if (rowIndex === -1) {
    throw new Error(`병원을 찾을 수 없습니다: ${hospital.hospital_id}`);
  }

  const rowNumber = rowIndex + 1;

  const row = [
    hospital.hospital_id,
    hospital.hospital_name,
    hospital.blog_url || "",
    hospital.reference_folder_id || "",
    hospital.output_folder_id || "",
    hospital.prompt_name || "",
    hospital.system_prompt,
    hospital.created_at,
    hospital.is_active ? "TRUE" : "FALSE",
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `병원설정!A${rowNumber}:I${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
}

// 병원 삭제 (실제로는 is_active를 FALSE로)
export async function deleteHospital(hospitalId: string): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "병원설정!A:I",
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === hospitalId);

  if (rowIndex === -1) {
    throw new Error(`병원을 찾을 수 없습니다: ${hospitalId}`);
  }

  const rowNumber = rowIndex + 1;

  // is_active를 FALSE로 설정
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `병원설정!I${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["FALSE"]],
    },
  });
}

// ============ 요청 데이터 ============

// 유효한 ISO 날짜 문자열인지 확인
function isValidDateString(dateStr: string): boolean {
  if (!dateStr || dateStr.trim() === "") return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export async function getRequests(): Promise<BlogRequest[]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  // 요청 데이터 가져오기
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "요청목록!A2:P500", // 헤더 제외
  });

  const rows = response.data.values || [];

  return rows.map((row) => {
    // 채팅 히스토리는 JSON으로 저장됨 (인덱스 14)
    let chatHistory: ChatMessage[] = [];
    try {
      if (row[14]) {
        chatHistory = JSON.parse(row[14]);
      }
    } catch {
      chatHistory = [];
    }

    // 컬럼 순서: request_id(0), created_at(1), hospital_id(2), hospital_name(3),
    // target_keyword(4), topic_keyword(5), purpose(6), format_type(7), format_custom(8),
    // status(9), result_doc_id(10), result_doc_url(11), revision_count(12),
    // completed_at(13), chat_history(14), created_by(15)

    // 날짜 값 검증 및 기본값 설정
    const createdAt = isValidDateString(row[1])
      ? row[1]
      : new Date().toISOString();
    const completedAt = isValidDateString(row[13]) ? row[13] : undefined;

    return {
      request_id: row[0] || "",
      created_at: createdAt,
      hospital_id: row[2] || "",
      hospital_name: row[3] || "",
      target_keyword: row[4] || "",
      topic_keyword: row[5] || "",
      purpose: row[6] || "",
      format_type: (row[7] || "Q&A형") as FormatType,
      format_custom: row[8] || undefined,
      status: (row[9] || "대기") as RequestStatus,
      result_doc_id: row[10] || undefined,
      result_doc_url: row[11] || undefined,
      revision_count: parseInt(row[12] || "0", 10),
      completed_at: completedAt,
      chat_history: chatHistory,
      created_by: row[15] || "",
    };
  });
}

// 새 요청 추가
export async function addRequest(request: BlogRequest): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  // 컬럼 순서: request_id, created_at, hospital_id, hospital_name, target_keyword, topic_keyword,
  // purpose, format_type, format_custom, status, result_doc_id, result_doc_url,
  // revision_count, completed_at, chat_history, created_by
  const row = [
    request.request_id,
    request.created_at,
    request.hospital_id,
    request.hospital_name,
    request.target_keyword,
    request.topic_keyword,
    request.purpose,
    request.format_type,
    request.format_custom || "",
    request.status,
    request.result_doc_id || "",
    request.result_doc_url || "",
    request.revision_count.toString(),
    request.completed_at || "",
    JSON.stringify(request.chat_history),
    request.created_by,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "요청목록!A:P",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
}

// 요청 업데이트
export async function updateRequest(request: BlogRequest): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  // 먼저 해당 request_id의 행 번호 찾기
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "요청목록!A:A",
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === request.request_id);

  if (rowIndex === -1) {
    throw new Error(`요청을 찾을 수 없습니다: ${request.request_id}`);
  }

  const rowNumber = rowIndex + 1; // 1-based index

  // 컬럼 순서: request_id, created_at, hospital_id, hospital_name, target_keyword, topic_keyword,
  // purpose, format_type, format_custom, status, result_doc_id, result_doc_url,
  // revision_count, completed_at, chat_history, created_by
  const row = [
    request.request_id,
    request.created_at,
    request.hospital_id,
    request.hospital_name,
    request.target_keyword,
    request.topic_keyword,
    request.purpose,
    request.format_type,
    request.format_custom || "",
    request.status,
    request.result_doc_id || "",
    request.result_doc_url || "",
    request.revision_count.toString(),
    request.completed_at || "",
    JSON.stringify(request.chat_history),
    request.created_by,
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `요청목록!A${rowNumber}:P${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
}

// 요청 상태만 업데이트
export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  additionalData?: {
    result_doc_id?: string;
    result_doc_url?: string;
    completed_at?: string;
    chat_history?: ChatMessage[];
  },
): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  // 해당 request_id의 행 번호 찾기
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "요청목록!A:P",
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === requestId);

  if (rowIndex === -1) {
    throw new Error(`요청을 찾을 수 없습니다: ${requestId}`);
  }

  const rowNumber = rowIndex + 1;
  const currentRow = rows[rowIndex];

  // 업데이트할 값들
  // 컬럼 인덱스: status(9), result_doc_id(10), result_doc_url(11),
  // revision_count(12), completed_at(13), chat_history(14), created_by(15)
  const updatedRow = [...currentRow];
  updatedRow[9] = status; // status

  if (additionalData?.result_doc_id) {
    updatedRow[10] = additionalData.result_doc_id;
  }
  if (additionalData?.result_doc_url) {
    updatedRow[11] = additionalData.result_doc_url;
  }
  if (additionalData?.completed_at) {
    updatedRow[13] = additionalData.completed_at;
  }
  if (additionalData?.chat_history) {
    updatedRow[14] = JSON.stringify(additionalData.chat_history);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `요청목록!A${rowNumber}:P${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [updatedRow],
    },
  });
}
