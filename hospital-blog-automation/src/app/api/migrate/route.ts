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

    // 현재 헤더 확인
    const currentHeader = rows[0];
    console.log('현재 헤더:', currentHeader);

    // 올바른 헤더 순서
    const correctHeader = [
      'request_id', 'created_at', 'hospital_id', 'hospital_name',
      'target_keyword', 'topic_keyword', 'purpose', 'format_type',
      'format_custom', 'status', 'result_doc_id', 'result_doc_url',
      'revision_count', 'completed_at', 'chat_history', 'created_by'
    ];

    // 현재 헤더에서 각 컬럼의 인덱스 찾기
    const columnMap: { [key: string]: number } = {};
    currentHeader.forEach((col: string, index: number) => {
      columnMap[col] = index;
    });

    console.log('컬럼 매핑:', columnMap);

    // 데이터 재정렬
    const migratedRows = rows.map((row, rowIndex) => {
      if (rowIndex === 0) {
        // 헤더 행
        return correctHeader;
      }

      // 데이터 행 재정렬
      return correctHeader.map((colName) => {
        const oldIndex = columnMap[colName];
        if (oldIndex !== undefined && row[oldIndex] !== undefined) {
          return row[oldIndex];
        }
        return '';
      });
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
