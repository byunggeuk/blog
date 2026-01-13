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

// PATCH: 사용자 시트 데이터 수정
export async function PATCH() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_USERS_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: 'Google Sheets 환경변수가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_USERS_SPREADSHEET_ID;

    // 현재 사용자 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '사용자!A:I',
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({ message: '수정할 데이터가 없습니다.', fixed: 0 });
    }

    // 올바른 헤더
    const correctHeader = ['id', 'email', 'name', 'role', 'status', 'slack_member_id', 'created_at', 'approved_at', 'blocked_at'];

    // 데이터 수정
    let fixedCount = 0;
    const fixedRows = rows.map((row, index) => {
      if (index === 0) {
        return correctHeader;
      }

      // created_at 필드(인덱스 6)가 비어있고 slack_member_id(인덱스 5)에 날짜가 있는 경우 수정
      const slackIdValue = row[5] || '';
      const createdAtValue = row[6] || '';

      // slack_member_id에 날짜 형식이 들어가 있으면 데이터가 밀린 것
      if (slackIdValue && slackIdValue.includes('T') && slackIdValue.includes('Z') && !createdAtValue) {
        // 데이터 재배치: slack_member_id 위치의 값을 created_at으로 이동
        fixedCount++;
        return [
          row[0] || '',   // id
          row[1] || '',   // email
          row[2] || '',   // name
          row[3] || '',   // role
          row[4] || '',   // status
          '',             // slack_member_id (비움)
          slackIdValue,   // created_at ← slack_member_id 위치에 있던 날짜값
          row[7] || '',   // approved_at
          row[8] || '',   // blocked_at
        ];
      }

      // 정상 데이터는 그대로
      const newRow = [...row];
      while (newRow.length < 9) newRow.push('');
      return newRow;
    });

    // 시트 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `사용자!A1:I${fixedRows.length}`,
      valueInputOption: 'RAW',
      requestBody: { values: fixedRows },
    });

    return NextResponse.json({
      success: true,
      message: '사용자 시트 데이터 수정 완료',
      fixed: fixedCount,
    });
  } catch (error) {
    console.error('Fix Users Sheet Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: created_by 필드 업데이트
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const defaultEmail = body.email || 'byunggeuk.son@philomedi.com';

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: 'Google Sheets 환경변수가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getSpreadsheetId();

    // 현재 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '요청목록!A:P',
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({ message: '업데이트할 데이터가 없습니다.', updated: 0 });
    }

    // created_by가 비어있는 행만 업데이트
    let updatedCount = 0;
    const updatedRows = rows.map((row, index) => {
      if (index === 0) return row; // 헤더 건너뛰기

      // created_by (16번째 컬럼, 인덱스 15)가 비어있으면 기본값 설정
      if (!row[15] || row[15] === '') {
        const newRow = [...row];
        while (newRow.length < 16) newRow.push(''); // 컬럼 수 맞추기
        newRow[15] = defaultEmail;
        updatedCount++;
        return newRow;
      }
      return row;
    });

    // 시트 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `요청목록!A1:P${updatedRows.length}`,
      valueInputOption: 'RAW',
      requestBody: { values: updatedRows },
    });

    return NextResponse.json({
      success: true,
      message: `created_by 필드 업데이트 완료`,
      updated: updatedCount,
      email: defaultEmail,
    });
  } catch (error) {
    console.error('Update created_by Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
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

    // 새로운 헤더 순서 (created_by를 status 다음에 배치)
    const correctHeader = [
      'request_id', 'created_at', 'hospital_id', 'hospital_name',
      'target_keyword', 'topic_keyword', 'purpose', 'format_type',
      'format_custom', 'status', 'created_by', 'result_doc_id', 'result_doc_url',
      'revision_count', 'completed_at', 'chat_history'
    ];

    // 이전 순서 (마이그레이션 전):
    // 0-9: request_id, created_at, hospital_id, hospital_name, target_keyword, topic_keyword, purpose, format_type, format_custom, status
    // 10: result_doc_id
    // 11: result_doc_url
    // 12: revision_count
    // 13: completed_at
    // 14: chat_history
    // 15: created_by

    // 새로운 순서:
    // 0-9: 동일
    // 10: created_by (이전 15)
    // 11: result_doc_id (이전 10)
    // 12: result_doc_url (이전 11)
    // 13: revision_count (이전 12)
    // 14: completed_at (이전 13)
    // 15: chat_history (이전 14)

    // 데이터 재정렬
    const migratedRows = rows.map((row, rowIndex) => {
      if (rowIndex === 0) {
        return correctHeader;
      }

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
        row[15] || '',  // 10: created_by ← 이전 인덱스 15
        row[10] || '',  // 11: result_doc_id ← 이전 인덱스 10
        row[11] || '',  // 12: result_doc_url ← 이전 인덱스 11
        row[12] || '',  // 13: revision_count ← 이전 인덱스 12
        row[13] || '',  // 14: completed_at ← 이전 인덱스 13
        row[14] || '',  // 15: chat_history ← 이전 인덱스 14
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
