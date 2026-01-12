import { NextRequest, NextResponse } from 'next/server';
import {
  createMarkdownFile,
  updateMarkdownFile,
  getFileVersions,
  getFileContent,
} from '@/lib/google-drive';

// POST: 새 파일 생성 또는 기존 파일 업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, fileName, content, fileId, folderId } = body;

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json(
        { error: 'Google 서비스 계정이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    if (action === 'create') {
      if (!fileName || !content) {
        return NextResponse.json(
          { error: '파일명과 내용이 필요합니다.' },
          { status: 400 }
        );
      }

      const result = await createMarkdownFile(fileName, content, folderId);
      return NextResponse.json(result);
    }

    if (action === 'update') {
      if (!fileId || !content) {
        return NextResponse.json(
          { error: '파일 ID와 내용이 필요합니다.' },
          { status: 400 }
        );
      }

      const result = await updateMarkdownFile(fileId, content);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: '유효하지 않은 action입니다. (create 또는 update)' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Google Drive API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 파일 버전 히스토리 또는 특정 버전 내용 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const revisionId = searchParams.get('revisionId');
    const action = searchParams.get('action') || 'versions';

    if (!fileId) {
      return NextResponse.json(
        { error: '파일 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json(
        { error: 'Google 서비스 계정이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    if (action === 'content') {
      const content = await getFileContent(fileId, revisionId || undefined);
      return NextResponse.json({ content });
    }

    // 기본: 버전 목록 조회
    const versions = await getFileVersions(fileId);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Google Drive API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
