/**
 * Google Apps Script - 블로그 자동화 트리거
 *
 * 설치 방법:
 * 1. Google Sheets 열기
 * 2. 확장 프로그램 > Apps Script 클릭
 * 3. 이 코드 전체를 복사하여 붙여넣기
 * 4. VERCEL_URL을 실제 배포된 URL로 변경
 * 5. 저장 (Ctrl+S)
 * 6. 트리거 설정 (아래 설명 참조)
 */

// ⚠️ 여기에 Vercel 배포 URL 입력
const VERCEL_URL = 'https://your-app.vercel.app';

/**
 * 시트 편집 시 자동 실행되는 함수
 * 트리거: 편집 시 (onEdit)
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();

  // 요청목록 시트에서만 작동
  if (sheetName !== '요청목록') return;

  const range = e.range;
  const row = range.getRow();

  // 헤더 행은 무시
  if (row === 1) return;

  // 상태 컬럼(J열) 확인
  const statusCell = sheet.getRange(row, 10).getValue();

  // 새로 추가된 행이거나 상태가 '대기'인 경우
  if (statusCell === '대기' || statusCell === '') {
    // 상태가 비어있으면 '대기'로 설정
    if (statusCell === '') {
      sheet.getRange(row, 10).setValue('대기');
    }

    // 처리 API 호출 (비동기)
    triggerProcessing();
  }
}

/**
 * 새 행 추가 시 자동 실행 (더 안정적인 트리거)
 * 트리거: 폼 제출 시 또는 변경 시
 */
function onChange(e) {
  if (e.changeType === 'INSERT_ROW') {
    // 잠시 대기 후 처리 (데이터 입력 완료 대기)
    Utilities.sleep(2000);
    triggerProcessing();
  }
}

/**
 * 처리 API 호출
 */
function triggerProcessing() {
  try {
    const url = VERCEL_URL + '/api/process';

    const options = {
      'method': 'POST',
      'muteHttpExceptions': true,
      'headers': {
        'Content-Type': 'application/json'
      }
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    console.log('처리 결과:', result);

    if (result.processed > 0) {
      // 선택사항: 처리 완료 알림
      // sendSlackNotification(result);
    }

    return result;
  } catch (error) {
    console.error('API 호출 실패:', error);
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
      '처리 완료',
      `${result.processed}개의 요청이 처리되었습니다.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert(
      '오류',
      '처리 중 오류가 발생했습니다. 로그를 확인해주세요.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * 메뉴 추가 (시트 열 때 실행)
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 블로그 자동화')
    .addItem('대기 중인 요청 처리', 'manualProcess')
    .addSeparator()
    .addItem('트리거 설정', 'showTriggerSetup')
    .toMenu();
}

/**
 * 트리거 설정 안내
 */
function showTriggerSetup() {
  const message = `
트리거 설정 방법:

1. 왼쪽 메뉴에서 ⏰ (트리거) 클릭
2. "+ 트리거 추가" 클릭
3. 다음과 같이 설정:
   - 실행할 함수: onChange
   - 이벤트 소스: 스프레드시트에서
   - 이벤트 유형: 변경 시
4. 저장

이렇게 하면 새 행이 추가될 때마다 자동으로 글이 생성됩니다!
  `;

  SpreadsheetApp.getUi().alert('트리거 설정 안내', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Slack 알림 (선택사항)
 * 사용하려면 SLACK_WEBHOOK_URL 설정 필요
 */
const SLACK_WEBHOOK_URL = ''; // Slack Webhook URL (선택사항)

function sendSlackNotification(result) {
  if (!SLACK_WEBHOOK_URL) return;

  const completedCount = result.results.filter(r => r.status === 'completed').length;
  const errorCount = result.results.filter(r => r.status === 'error').length;

  const message = {
    text: `📝 블로그 자동 생성 완료!\n✅ 성공: ${completedCount}건\n❌ 실패: ${errorCount}건`
  };

  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify(message)
  });
}
