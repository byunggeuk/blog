import { NextResponse } from 'next/server';
import { google } from 'googleapis';

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSpreadsheetId() {
  return process.env.GOOGLE_SPREADSHEET_ID || '';
}

// POST: 시트 컬럼 순서 수정 및 format_type 드롭다운 추가
export async function POST() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: 'Google Sheets 환경변수가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getSpreadsheetId();

    // 1. 현재 요청목록 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '요청목록!A:P',
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      return NextResponse.json({ message: '데이터가 없습니다.', migrated: 0 });
    }

    // 올바른 헤더 순서
    const correctHeader = [
      'request_id', 'created_at', 'hospital_id', 'hospital_name',
      'target_keyword', 'topic_keyword', 'purpose', 'format_type',
      'format_custom', 'status', 'result_doc_id', 'result_doc_url',
      'revision_count', 'completed_at', 'chat_history', 'created_by'
    ];

    // 이전 잘못된 순서 (setup API의 원래 순서)
    // 0-9는 동일: request_id, created_at, hospital_id, hospital_name, target_keyword, topic_keyword, purpose, format_type, format_custom, status
    // 10: revision_count (잘못됨, result_doc_id여야 함)
    // 11: created_by (잘못됨, result_doc_url이어야 함)
    // 12: result_doc_id (잘못됨, revision_count여야 함)
    // 13: result_doc_url (잘못됨, completed_at이어야 함)
    // 14: completed_at (잘못됨, chat_history여야 함)
    // 15: chat_history (잘못됨, created_by여야 함)

    // 데이터 재정렬 (하드코딩으로 강제 매핑)
    const migratedRows = rows.map((row, rowIndex) => {
      if (rowIndex === 0) {
        // 헤더 행
        return correctHeader;
      }

      // 현재 시트 상태 분석 결과:
      // [10] result_doc_id 위치에 → "1" (revision_count 값)
      // [11] result_doc_url 위치에 → 날짜 (completed_at 값)
      // [12] revision_count 위치에 → doc_id
      // [13] completed_at 위치에 → chat_history JSON
      // [14] chat_history 위치에 → 빈 값
      // [15] created_by 위치에 → doc_url

      // 올바른 재매핑:
      return [
        row[0] || '',   // 0: request_id
        row[1] || '',   // 1: created_at
        row[2] || '',   // 2: hospital_id
        row[3] || '',   // 3: hospital_name
        row[4] || '',   // 4: target_keyword
        row[5] || '',   // 5: topic_keyword
        row[6] || '',   // 6: purpose
        row[7] || '',   // 7: format_type
        row[8] || '',   // 8: format_custom
        row[9] || '',   // 9: status
        row[12] || '',  // 10: result_doc_id ← 현재 [12]에 있는 doc_id
        row[15] || '',  // 11: result_doc_url ← 현재 [15]에 있는 doc_url
        row[10] || '',  // 12: revision_count ← 현재 [10]에 있는 "1"
        row[11] || '',  // 13: completed_at ← 현재 [11]에 있는 날짜
        row[13] || '',  // 14: chat_history ← 현재 [13]에 있는 JSON
        '',             // 15: created_by ← 기존 데이터에 없음 (빈 값으로)
      ];
    });

    // 2. 시트 데이터 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `요청목록!A1:P${migratedRows.length}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: migratedRows,
      },
    });

    // 3. format_type 컬럼에 드롭다운 추가 (H열)
    const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const requestSheet = sheetInfo.data.sheets?.find(s => s.properties?.title === '요청목록');
    const sheetId = requestSheet?.properties?.sheetId;

    if (sheetId !== undefined) {
      // format_type 드롭다운 옵션
      const formatTypes = [
        'Q&A형',
        '사례/스토리텔링형',
        '실패분석형',
        '치료과정 시뮬레이션형',
        '비교분석형',
        '팩트체크형',
        '칼럼형',
        '기타'
      ];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              setDataValidation: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 1, // 헤더 제외
                  endRowIndex: 1000,
                  startColumnIndex: 7, // H열 (format_type)
                  endColumnIndex: 8,
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: formatTypes.map(t => ({ userEnteredValue: t })),
                  },
                  showCustomUi: true,
                  strict: false, // 다른 값도 허용 (기타 용도)
                },
              },
            },
            // status 컬럼에도 드롭다운 추가 (J열)
            {
              setDataValidation: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 9, // J열 (status)
                  endColumnIndex: 10,
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: '대기' },
                      { userEnteredValue: '생성중' },
                      { userEnteredValue: '완료' },
                      { userEnteredValue: '수정요청' },
                      { userEnteredValue: '수정완료' },
                      { userEnteredValue: '에러' },
                    ],
                  },
                  showCustomUi: true,
                  strict: true,
                },
              },
            },
          ],
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: '마이그레이션 완료',
      migrated: migratedRows.length - 1, // 헤더 제외
      newHeader: correctHeader,
      dropdowns: ['format_type (H열)', 'status (J열)'],
    });
  } catch (error) {
    console.error('Migration Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '마이그레이션 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
