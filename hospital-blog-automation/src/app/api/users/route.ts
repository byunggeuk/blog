import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// 사용자 관리용 별도 스프레드시트 (관리자만 접근)
function getUsersSpreadsheetId() {
  return process.env.GOOGLE_USERS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || '';
}

interface SheetUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'blocked';
  created_at: string;
  approved_at?: string;
  blocked_at?: string;
}

// GET: 모든 사용자 가져오기
export async function GET() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !getUsersSpreadsheetId()) {
      return NextResponse.json({ users: [], source: 'mock' });
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getUsersSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '사용자!A2:H100',
    });

    const rows = response.data.values || [];
    const users: SheetUser[] = rows.map((row) => ({
      id: row[0] || '',
      email: row[1] || '',
      name: row[2] || '',
      role: (row[3] as 'admin' | 'user') || 'user',
      status: (row[4] as 'pending' | 'approved' | 'blocked') || 'pending',
      created_at: row[5] || '',
      approved_at: row[6] || undefined,
      blocked_at: row[7] || undefined,
    }));

    return NextResponse.json({ users, source: 'sheets' });
  } catch (error) {
    console.error('Users API Error:', error);
    return NextResponse.json({ users: [], source: 'mock', error: (error as Error).message });
  }
}

// 사용자 시트 존재 확인 및 생성
async function ensureUserSheet(sheets: any, spreadsheetId: string) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheet.data.sheets?.map((s: any) => s.properties?.title) || [];

    if (!existingSheets.includes('사용자')) {
      // 시트 생성
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
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

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: '사용자!A1:H1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'email', 'name', 'role', 'status', 'created_at', 'approved_at', 'blocked_at']],
        },
      });
    }
  } catch (error) {
    console.error('시트 확인/생성 오류:', error);
  }
}

// POST: 새 사용자 추가 (첫 로그인 시)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json({ error: '이메일이 필요합니다.' }, { status: 400 });
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !getUsersSpreadsheetId()) {
      return NextResponse.json({ error: 'Google Sheets 설정이 필요합니다.' }, { status: 500 });
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getUsersSpreadsheetId();

    // 사용자 시트 존재 확인 및 생성
    await ensureUserSheet(sheets, spreadsheetId);

    // 기존 사용자 확인
    let existingResponse;
    try {
      existingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: '사용자!A2:H100',
      });
    } catch {
      existingResponse = { data: { values: [] } };
    }

    const rows = existingResponse.data.values || [];
    const existingUser = rows.find((row) => row[1] === email);

    if (existingUser) {
      // 기존 사용자 정보 반환
      return NextResponse.json({
        user: {
          id: existingUser[0],
          email: existingUser[1],
          name: existingUser[2],
          role: existingUser[3] || 'user',
          status: existingUser[4] || 'pending',
          created_at: existingUser[5],
          approved_at: existingUser[6] || undefined,
          blocked_at: existingUser[7] || undefined,
        },
        isNew: false,
      });
    }

    // 새 사용자 추가
    const now = new Date().toISOString();
    const userId = `U${Date.now()}`;

    // 첫 번째 사용자는 자동으로 admin으로 설정
    const isFirstUser = rows.length === 0;
    const role = isFirstUser ? 'admin' : 'user';
    const status = isFirstUser ? 'approved' : 'pending';

    const newRow = [
      userId,
      email,
      name || email.split('@')[0],
      role,
      status,
      now,
      isFirstUser ? now : '', // approved_at
      '', // blocked_at
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: '사용자!A:H',
      valueInputOption: 'RAW',
      requestBody: {
        values: [newRow],
      },
    });

    return NextResponse.json({
      user: {
        id: userId,
        email,
        name: name || email.split('@')[0],
        role,
        status,
        created_at: now,
        approved_at: isFirstUser ? now : undefined,
      },
      isNew: true,
      isFirstUser,
    });
  } catch (error) {
    console.error('Add User Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// PUT: 사용자 상태 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action } = body; // action: 'approve' | 'block' | 'unblock'

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId와 action이 필요합니다.' }, { status: 400 });
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !getUsersSpreadsheetId()) {
      return NextResponse.json({ error: 'Google Sheets 설정이 필요합니다.' }, { status: 500 });
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getUsersSpreadsheetId();

    // 사용자 찾기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '사용자!A2:H100',
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === userId);

    if (rowIndex === -1) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const actualRowIndex = rowIndex + 2; // 헤더 + 0-index

    let updates: { range: string; values: string[][] }[] = [];

    switch (action) {
      case 'approve':
        updates = [
          { range: `사용자!E${actualRowIndex}`, values: [['approved']] },
          { range: `사용자!G${actualRowIndex}`, values: [[now]] },
          { range: `사용자!H${actualRowIndex}`, values: [['']] },
        ];
        break;
      case 'block':
        updates = [
          { range: `사용자!E${actualRowIndex}`, values: [['blocked']] },
          { range: `사용자!H${actualRowIndex}`, values: [[now]] },
        ];
        break;
      case 'unblock':
        updates = [
          { range: `사용자!E${actualRowIndex}`, values: [['approved']] },
          { range: `사용자!H${actualRowIndex}`, values: [['']] },
        ];
        break;
      default:
        return NextResponse.json({ error: '유효하지 않은 action입니다.' }, { status: 400 });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('Update User Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
