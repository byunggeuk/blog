import { NextRequest, NextResponse } from 'next/server';
import { getRequests, addRequest, updateRequest } from '@/lib/google-sheets';
import { mockRequests } from '@/lib/mock-data';
import { BlogRequest } from '@/types';

// GET: 모든 요청 가져오기
export async function GET() {
  try {
    // Google Sheets 연동이 설정되어 있으면 시트에서 가져옴
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SPREADSHEET_ID) {
      const requests = await getRequests();
      return NextResponse.json({ requests, source: 'sheets' });
    }

    // 아니면 mock 데이터 반환
    return NextResponse.json({ requests: mockRequests, source: 'mock' });
  } catch (error) {
    console.error('Requests API Error:', error);

    // 에러 시 mock 데이터로 폴백
    return NextResponse.json({
      requests: mockRequests,
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST: 새 요청 추가
export async function POST(request: NextRequest) {
  try {
    const body: BlogRequest = await request.json();

    // Google Sheets 연동이 설정되어 있으면 시트에 추가
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SPREADSHEET_ID) {
      await addRequest(body);
      return NextResponse.json({ success: true, source: 'sheets' });
    }

    // mock 모드에서는 성공만 반환 (실제 저장 안 됨)
    return NextResponse.json({ success: true, source: 'mock' });
  } catch (error) {
    console.error('Add Request API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT: 요청 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body: BlogRequest = await request.json();

    // Google Sheets 연동이 설정되어 있으면 시트 업데이트
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SPREADSHEET_ID) {
      await updateRequest(body);
      return NextResponse.json({ success: true, source: 'sheets' });
    }

    // mock 모드에서는 성공만 반환
    return NextResponse.json({ success: true, source: 'mock' });
  } catch (error) {
    console.error('Update Request API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
