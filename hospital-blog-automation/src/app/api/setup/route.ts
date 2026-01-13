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

// 사용자 관리용 별도 스프레드시트
function getUsersSpreadsheetId() {
  return process.env.GOOGLE_USERS_SPREADSHEET_ID || '';
}

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

    // 현재 시트 목록 확인
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

    const requests: any[] = [];

    // 병원설정 탭 생성
    if (!existingSheets.includes('병원설정')) {
      requests.push({
        addSheet: {
          properties: {
            title: '병원설정',
            gridProperties: { rowCount: 100, columnCount: 8 },
          },
        },
      });
    }

    // 요청목록 탭 생성
    if (!existingSheets.includes('요청목록')) {
      requests.push({
        addSheet: {
          properties: {
            title: '요청목록',
            gridProperties: { rowCount: 1000, columnCount: 16 },
          },
        },
      });
    }

    // 메인 시트 추가 실행
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }

    // 사용자 관리용 별도 스프레드시트 설정
    const usersSpreadsheetId = getUsersSpreadsheetId();
    if (usersSpreadsheetId) {
      const usersSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: usersSpreadsheetId });
      const existingUsersSheets = usersSpreadsheet.data.sheets?.map(s => s.properties?.title) || [];

      if (!existingUsersSheets.includes('사용자')) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: usersSpreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: '사용자',
                  gridProperties: { rowCount: 100, columnCount: 8 },
                },
              },
            }],
          },
        });
      }
    }

    // 병원설정 헤더 추가
    const hospitalHeaders = [
      ['hospital_id', 'hospital_name', 'blog_url', 'reference_folder_id', 'output_folder_id', 'system_prompt', 'created_at', 'is_active'],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '병원설정!A1:H1',
      valueInputOption: 'RAW',
      requestBody: { values: hospitalHeaders },
    });

    // 요청목록 헤더 추가
    const requestHeaders = [
      ['request_id', 'created_at', 'hospital_id', 'hospital_name', 'target_keyword', 'topic_keyword', 'purpose', 'format_type', 'format_custom', 'status', 'revision_count', 'created_by', 'result_doc_id', 'result_doc_url', 'completed_at', 'chat_history'],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '요청목록!A1:P1',
      valueInputOption: 'RAW',
      requestBody: { values: requestHeaders },
    });

    // 사용자 헤더 추가 (별도 스프레드시트)
    if (usersSpreadsheetId) {
      const userHeaders = [
        ['id', 'email', 'name', 'role', 'status', 'created_at', 'approved_at', 'blocked_at'],
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: usersSpreadsheetId,
        range: '사용자!A1:H1',
        valueInputOption: 'RAW',
        requestBody: { values: userHeaders },
      });
    }

    // 헤더 스타일링 (굵게, 배경색)
    const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const hospitalSheetId = sheetInfo.data.sheets?.find(s => s.properties?.title === '병원설정')?.properties?.sheetId;
    const requestSheetId = sheetInfo.data.sheets?.find(s => s.properties?.title === '요청목록')?.properties?.sheetId;

    const formatRequests: any[] = [];

    if (hospitalSheetId !== undefined) {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: hospitalSheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
      // 열 너비 조정
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId: hospitalSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 },
          properties: { pixelSize: 150 },
          fields: 'pixelSize',
        },
      });
    }

    if (requestSheetId !== undefined) {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: requestSheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.6, blue: 0.4 },
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
      // 열 너비 조정
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId: requestSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 16 },
          properties: { pixelSize: 120 },
          fields: 'pixelSize',
        },
      });
    }

    if (formatRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: formatRequests },
      });
    }

    // 사용자 시트 스타일링 (별도 스프레드시트)
    if (usersSpreadsheetId) {
      const usersSheetInfo = await sheets.spreadsheets.get({ spreadsheetId: usersSpreadsheetId });
      const userSheetId = usersSheetInfo.data.sheets?.find(s => s.properties?.title === '사용자')?.properties?.sheetId;

      if (userSheetId !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: usersSpreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: { sheetId: userSheetId, startRowIndex: 0, endRowIndex: 1 },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.6, green: 0.2, blue: 0.6 },
                      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat)',
                },
              },
              {
                updateDimensionProperties: {
                  range: { sheetId: userSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 },
                  properties: { pixelSize: 150 },
                  fields: 'pixelSize',
                },
              },
            ],
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: '시트 구조가 성공적으로 생성되었습니다.',
      mainSheets: ['병원설정', '요청목록'],
      usersSheet: usersSpreadsheetId ? '사용자 (별도 스프레드시트)' : '미설정',
    });
  } catch (error) {
    console.error('Setup API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '시트 설정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
