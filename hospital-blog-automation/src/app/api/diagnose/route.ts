import { NextResponse } from 'next/server';
import { google } from 'googleapis';

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// GET: 시트 현재 상태 진단
export async function GET() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json({ error: '환경변수 미설정' }, { status: 400 });
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '요청목록!A1:P5',
    });

    const rows = response.data.values || [];
    const header = rows[0] || [];
    const dataRows = rows.slice(1);

    // 각 컬럼별로 데이터 보기 쉽게 정리
    const diagnosis = dataRows.map((row, idx) => {
      const rowData: { [key: string]: string } = {};
      header.forEach((colName: string, colIdx: number) => {
        const value = row[colIdx] || '';
        // 긴 값은 앞 50자만
        rowData[`${colIdx}:${colName}`] = value.length > 50 ? value.substring(0, 50) + '...' : value;
      });
      return { row: idx + 2, data: rowData };
    });

    return NextResponse.json({
      header,
      diagnosis,
      rawFirstRow: rows[1] || [],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
