import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// 사용자 관리용 별도 스프레드시트 (관리자만 접근, 필수)
function getUsersSpreadsheetId() {
  return process.env.GOOGLE_USERS_SPREADSHEET_ID || '';
}

interface SheetUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'blocked';
  slack_member_id?: string;
  created_at: string;
  approved_at?: string;
  blocked_at?: string;
}

// GET: 모든 사용자 가져오기
export async function GET() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({ users: [], source: 'mock', error: 'Service account not configured' });
    }

    if (!process.env.GOOGLE_USERS_SPREADSHEET_ID) {
      return NextResponse.json({ users: [], source: 'mock', error: 'GOOGLE_USERS_SPREADSHEET_ID 환경변수를 설정해주세요.' });
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getUsersSpreadsheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '사용자!A2:I100',
    });

    const rows = response.data.values || [];
    // 컬럼 순서: id, email, name, role, status, slack_member_id, created_at, approved_at, blocked_at
    const users: SheetUser[] = rows.map((row) => ({
      id: row[0] || '',
      email: row[1] || '',
      name: row[2] || '',
      role: (row[3] as 'admin' | 'user') || 'user',
      status: (row[4] as 'pending' | 'approved' | 'blocked') || 'pending',
      slack_member_id: row[5] || undefined,
      created_at: row[6] || '',
      approved_at: row[7] || undefined,
      blocked_at: row[8] || undefined,
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
                gridProperties: { rowCount: 100, columnCount: 9 },
              },
            },
          }],
        },
      });

      // 헤더 추가 (slack_member_id 포함)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: '사용자!A1:I1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'email', 'name', 'role', 'status', 'slack_member_id', 'created_at', 'approved_at', 'blocked_at']],
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

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({ error: 'Service account not configured' }, { status: 500 });
    }

    if (!process.env.GOOGLE_USERS_SPREADSHEET_ID) {
      return NextResponse.json({ error: 'GOOGLE_USERS_SPREADSHEET_ID 환경변수를 설정해주세요.' }, { status: 500 });
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getUsersSpreadsheetId();

    // 사용자 시트 존재 확인 및 생성 (별도 스프레드시트에)
    await ensureUserSheet(sheets, spreadsheetId);

    // 기존 사용자 확인
    let existingResponse;
    try {
      existingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: '사용자!A2:I100',
      });
    } catch {
      existingResponse = { data: { values: [] } };
    }

    const rows = existingResponse.data.values || [];
    const existingUser = rows.find((row) => row[1] === email);

    if (existingUser) {
      // 기존 사용자 정보 반환 (컬럼 순서: id, email, name, role, status, slack_member_id, created_at, approved_at, blocked_at)
      return NextResponse.json({
        user: {
          id: existingUser[0],
          email: existingUser[1],
          name: existingUser[2],
          role: existingUser[3] || 'user',
          status: existingUser[4] || 'pending',
          slack_member_id: existingUser[5] || undefined,
          created_at: existingUser[6],
          approved_at: existingUser[7] || undefined,
          blocked_at: existingUser[8] || undefined,
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

    // 컬럼 순서: id, email, name, role, status, slack_member_id, created_at, approved_at, blocked_at
    const newRow = [
      userId,
      email,
      name || email.split('@')[0],
      role,
      status,
      '', // slack_member_id (나중에 사용자가 직접 설정)
      now, // created_at
      isFirstUser ? now : '', // approved_at
      '', // blocked_at
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: '사용자!A:I',
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
        slack_member_id: undefined,
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
    const { userId, action, slackMemberId } = body; // action: 'approve' | 'block' | 'unblock' | 'update_slack_id'

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId와 action이 필요합니다.' }, { status: 400 });
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({ error: 'Service account not configured' }, { status: 500 });
    }

    if (!process.env.GOOGLE_USERS_SPREADSHEET_ID) {
      return NextResponse.json({ error: 'GOOGLE_USERS_SPREADSHEET_ID 환경변수를 설정해주세요.' }, { status: 500 });
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getUsersSpreadsheetId();

    // 사용자 찾기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '사용자!A2:I100',
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === userId);

    if (rowIndex === -1) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const actualRowIndex = rowIndex + 2; // 헤더 + 0-index

    // 컬럼: A:id, B:email, C:name, D:role, E:status, F:slack_member_id, G:created_at, H:approved_at, I:blocked_at
    let updates: { range: string; values: string[][] }[] = [];

    switch (action) {
      case 'approve':
        updates = [
          { range: `사용자!E${actualRowIndex}`, values: [['approved']] },
          { range: `사용자!H${actualRowIndex}`, values: [[now]] }, // approved_at
          { range: `사용자!I${actualRowIndex}`, values: [['']] }, // blocked_at 초기화
        ];
        break;
      case 'block':
        updates = [
          { range: `사용자!E${actualRowIndex}`, values: [['blocked']] },
          { range: `사용자!I${actualRowIndex}`, values: [[now]] }, // blocked_at
        ];
        break;
      case 'unblock':
        updates = [
          { range: `사용자!E${actualRowIndex}`, values: [['approved']] },
          { range: `사용자!I${actualRowIndex}`, values: [['']] }, // blocked_at 초기화
        ];
        break;
      case 'update_slack_id':
        updates = [
          { range: `사용자!F${actualRowIndex}`, values: [[slackMemberId || '']] }, // slack_member_id
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
