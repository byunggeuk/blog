import { NextRequest, NextResponse } from 'next/server';
import { getRequests, addRequest, updateRequest } from '@/lib/google-sheets';
import { mockRequests } from '@/lib/mock-data';
import { BlogRequest } from '@/types';
import {
  notifyNewRequest,
  notifyRequestCompleted,
  notifyRevisionRequested,
  notifyRevisionCompleted,
  notifyError,
} from '@/lib/slack';

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

      // Slack 알림 발송 (비동기, 실패해도 무시)
      notifyNewRequest({
        requestId: body.request_id,
        hospitalName: body.hospital_name,
        targetKeyword: body.target_keyword,
        topicKeyword: body.topic_keyword,
        formatType: body.format_type,
        createdBy: body.created_by,
      }).catch(console.error);

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

      // 상태에 따른 Slack 알림 발송 (비동기, 실패해도 무시)
      switch (body.status) {
        case '완료':
          notifyRequestCompleted({
            requestId: body.request_id,
            hospitalName: body.hospital_name,
            targetKeyword: body.target_keyword,
            docUrl: body.result_doc_url,
          }).catch(console.error);
          break;

        case '수정요청':
          notifyRevisionRequested({
            requestId: body.request_id,
            hospitalName: body.hospital_name,
            targetKeyword: body.target_keyword,
            revisionRequest: body.revision_request || '',
            revisionCount: body.revision_count,
          }).catch(console.error);
          break;

        case '수정완료':
          notifyRevisionCompleted({
            requestId: body.request_id,
            hospitalName: body.hospital_name,
            targetKeyword: body.target_keyword,
            revisionCount: body.revision_count,
            docUrl: body.result_doc_url,
          }).catch(console.error);
          break;

        case '에러':
          const lastMessage = body.chat_history[body.chat_history.length - 1];
          notifyError({
            requestId: body.request_id,
            hospitalName: body.hospital_name,
            errorMessage: lastMessage?.content || '알 수 없는 오류',
          }).catch(console.error);
          break;
      }

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
