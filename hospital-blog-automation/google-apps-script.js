/**
 * Google Apps Script - 블로그 자동화 트리거
 *
 * 주요 기능:
 * 1. 시트 편집 시 created_by(작성자) 자동 입력 (현재 접속한 사용자 이메일)
 * 2. 새 요청 추가 시 자동 블로그 글 생성 처리
 * 3. 수동 처리 메뉴 제공
 *
 * 설치 방법:
 * 1. Google Sheets 열기
 * 2. 확장 프로그램 > Apps Script 클릭
 * 3. 이 코드 전체를 복사하여 붙여넣기
 * 4. VERCEL_URL을 실제 배포된 URL로 변경
 * 5. 저장 (Ctrl+S)
 * 6. 트리거 설정 (메뉴에서 '트리거 설정 안내' 클릭)
 *
 * 컬럼 순서 (현재 시트):
 * P열(16)이 created_by 컬럼입니다.
 */

// ⚠️ 여기에 Vercel 배포 URL 입력
const VERCEL_URL = "https://your-app.vercel.app";

/**
 * 시트 편집 시 자동 실행되는 함수
 * 트리거: 편집 시 (onEdit)
 *
 * 주요 기능:
 * 1. created_by 필드 자동 채우기 (현재 접속한 사용자 이메일)
 * 2. 상태가 '대기'인 경우 처리 API 호출
 *
 * 컬럼 순서:
 * A(1): request_id, B(2): created_at, C(3): hospital_id, D(4): hospital_name,
 * E(5): target_keyword, F(6): topic_keyword, G(7): purpose, H(8): format_type,
 * I(9): format_custom, J(10): status, K(11): result_doc_id, L(12): result_doc_url,
 * M(13): revision_count, N(14): completed_at, O(15): chat_history, P(16): created_by
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  // 요청목록 시트에서만 작동
  if (sheetName !== "요청목록") return;

  const range = e.range;
  const row = range.getRow();

  // 헤더 행은 무시
  if (row === 1) return;

  // created_by 자동 채우기 (P열, 인덱스 16)
  // 새로운 데이터가 입력되고 created_by가 비어있는 경우
  autoFillCreatedBy(sheet, row);

  // 상태 컬럼(J열, 인덱스 10) 확인
  const statusCell = sheet.getRange(row, 10).getValue();

  // 새로 추가된 행이거나 상태가 '대기'인 경우
  if (statusCell === "대기" || statusCell === "") {
    // 상태가 비어있으면 '대기'로 설정
    if (statusCell === "") {
      sheet.getRange(row, 10).setValue("대기");
    }

    // 처리 API 호출 (비동기)
    triggerProcessing();
  }
}

/**
 * created_by 필드 자동 채우기
 * 현재 시트에 접속한 사용자의 이메일을 자동으로 입력
 *
 * @param {Sheet} sheet - 현재 시트
 * @param {number} row - 편집된 행 번호
 */
function autoFillCreatedBy(sheet, row) {
  const createdByCell = sheet.getRange(row, 16); // P열 (created_by)
  const currentValue = createdByCell.getValue();

  // 이미 값이 있으면 건드리지 않음
  if (currentValue && currentValue.toString().trim() !== "") {
    return;
  }

  // 해당 행에 데이터가 있는지 확인 (최소한 hospital_name이 있어야 함)
  const hospitalName = sheet.getRange(row, 4).getValue(); // D열 (hospital_name)

  if (!hospitalName || hospitalName.toString().trim() === "") {
    return; // 데이터가 없는 행은 무시
  }

  // 현재 사용자 이메일 가져오기
  const userEmail = getCurrentUserEmail();

  if (userEmail) {
    createdByCell.setValue(userEmail);
    console.log(`Row ${row}: created_by 자동 설정됨 - ${userEmail}`);
  }
}

/**
 * 현재 접속한 사용자의 이메일 가져오기
 *
 * @returns {string|null} 사용자 이메일 또는 null
 */
function getCurrentUserEmail() {
  try {
    // 방법 1: Session.getActiveUser() - 일반적인 방법
    const activeUser = Session.getActiveUser();
    if (activeUser) {
      const email = activeUser.getEmail();
      if (email) return email;
    }

    // 방법 2: Session.getEffectiveUser() - 스크립트 실행 사용자
    const effectiveUser = Session.getEffectiveUser();
    if (effectiveUser) {
      const email = effectiveUser.getEmail();
      if (email) return email;
    }

    return null;
  } catch (error) {
    console.log("사용자 이메일 가져오기 실패:", error);
    return null;
  }
}

/**
 * 새 행 추가 시 자동 실행 (더 안정적인 트리거)
 * 트리거: 폼 제출 시 또는 변경 시
 */
function onChange(e) {
  if (e.changeType === "INSERT_ROW" || e.changeType === "EDIT") {
    // 잠시 대기 후 처리 (데이터 입력 완료 대기)
    Utilities.sleep(2000);

    // 모든 행의 created_by 채우기
    fillEmptyCreatedBy();

    triggerProcessing();
  }
}

/**
 * 빈 created_by 필드 일괄 채우기 (수동 실행용)
 * 모든 데이터 행에서 created_by가 비어있는 경우 현재 사용자 이메일로 채움
 */
function fillEmptyCreatedBy() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("요청목록");
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return; // 헤더만 있는 경우

  const userEmail = getCurrentUserEmail();
  if (!userEmail) {
    console.log("사용자 이메일을 가져올 수 없습니다.");
    return;
  }

  let filledCount = 0;

  for (let row = 2; row <= lastRow; row++) {
    const createdBy = sheet.getRange(row, 16).getValue(); // P열
    const hospitalName = sheet.getRange(row, 4).getValue(); // D열

    // 데이터가 있고 created_by가 비어있는 경우에만
    if (hospitalName && (!createdBy || createdBy.toString().trim() === "")) {
      sheet.getRange(row, 16).setValue(userEmail);
      filledCount++;
    }
  }

  if (filledCount > 0) {
    console.log(
      `${filledCount}개 행의 created_by를 ${userEmail}로 채웠습니다.`,
    );
  }

  return filledCount;
}

/**
 * 처리 API 호출
 */
function triggerProcessing() {
  try {
    const url = VERCEL_URL + "/api/process";

    const options = {
      method: "POST",
      muteHttpExceptions: true,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    console.log("처리 결과:", result);

    if (result.processed > 0) {
      // 선택사항: 처리 완료 알림
      // sendSlackNotification(result);
    }

    return result;
  } catch (error) {
    console.error("API 호출 실패:", error);
    return null;
  }
}

/**
 * 수동 처리 실행 (테스트용)
 * Apps Script 에디터에서 직접 실행 가능
 */
function manualProcess() {
  const result = triggerProcessing();

  if (result) {
    SpreadsheetApp.getUi().alert(
      "처리 완료",
      `${result.processed}개의 요청이 처리되었습니다.`,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } else {
    SpreadsheetApp.getUi().alert(
      "오류",
      "처리 중 오류가 발생했습니다. 로그를 확인해주세요.",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }
}

/**
 * 메뉴 추가 (시트 열 때 실행)
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🤖 블로그 자동화")
    .addItem("대기 중인 요청 처리", "manualProcess")
    .addItem("빈 작성자(created_by) 채우기", "manualFillCreatedBy")
    .addSeparator()
    .addItem("트리거 설정 안내", "showTriggerSetup")
    .toMenu();
}

/**
 * 빈 created_by 수동 채우기 (UI 버전)
 */
function manualFillCreatedBy() {
  const result = fillEmptyCreatedBy();

  if (result === undefined) {
    SpreadsheetApp.getUi().alert(
      "알림",
      "요청목록 시트를 찾을 수 없거나 사용자 이메일을 가져올 수 없습니다.",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } else if (result === 0) {
    SpreadsheetApp.getUi().alert(
      "완료",
      "채울 빈 작성자 필드가 없습니다.",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } else {
    SpreadsheetApp.getUi().alert(
      "완료",
      `${result}개 행의 작성자(created_by)를 현재 사용자 이메일로 채웠습니다.`,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }
}

/**
 * 트리거 설정 안내
 */
function showTriggerSetup() {
  const message = `
⚙️ 트리거 설정 방법 (2개 설정 필요):

【트리거 1: 편집 시 (작성자 자동 입력)】
1. 왼쪽 메뉴에서 ⏰ (트리거) 클릭
2. "+ 트리거 추가" 클릭
3. 설정:
   - 실행할 함수: onEdit
   - 이벤트 소스: 스프레드시트에서
   - 이벤트 유형: 편집 시
4. 저장

【트리거 2: 변경 시 (자동 처리)】
1. "+ 트리거 추가" 클릭
2. 설정:
   - 실행할 함수: onChange
   - 이벤트 소스: 스프레드시트에서
   - 이벤트 유형: 변경 시
3. 저장

📌 중요: 설치형 트리거(Installable Trigger)로 설정해야
사용자 이메일을 가져올 수 있습니다!

처음 실행 시 권한 승인이 필요합니다.
  `;

  SpreadsheetApp.getUi().alert(
    "트리거 설정 안내",
    message,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

/**
 * Slack 알림 (선택사항)
 * 사용하려면 SLACK_WEBHOOK_URL 설정 필요
 */
const SLACK_WEBHOOK_URL = ""; // Slack Webhook URL (선택사항)

function sendSlackNotification(result) {
  if (!SLACK_WEBHOOK_URL) return;

  const completedCount = result.results.filter(
    (r) => r.status === "completed",
  ).length;
  const errorCount = result.results.filter((r) => r.status === "error").length;

  const message = {
    text: `📝 블로그 자동 생성 완료!\n✅ 성공: ${completedCount}건\n❌ 실패: ${errorCount}건`,
  };

  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(message),
  });
}
