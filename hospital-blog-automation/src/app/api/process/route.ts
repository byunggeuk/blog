import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';

// Google Sheets 인증
function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

function getSpreadsheetId() {
  return process.env.GOOGLE_SPREADSHEET_ID || '';
}

// 병원 정보 가져오기
async function getHospitalById(sheets: any, spreadsheetId: string, hospitalId: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '병원설정!A2:H100',
  });

  const rows = response.data.values || [];
  for (const row of rows) {
    if (row[0] === hospitalId) {
      return {
        hospital_id: row[0] || '',
        hospital_name: row[1] || '',
        blog_url: row[2] || '',
        reference_folder_id: row[3] || '',
        output_folder_id: row[4] || '',
        system_prompt: row[5] || '',
      };
    }
  }
  return null;
}

// 요청 상태 업데이트
async function updateRequestStatus(
  sheets: any,
  spreadsheetId: string,
  rowIndex: number,
  status: string,
  resultDocId?: string,
  resultDocUrl?: string,
  completedAt?: string,
  chatHistory?: string
) {
  const updates: any[] = [];

  // 상태 업데이트 (J열 = 10번째)
  updates.push({
    range: `요청목록!J${rowIndex}`,
    values: [[status]],
  });

  if (resultDocId) {
    updates.push({ range: `요청목록!M${rowIndex}`, values: [[resultDocId]] });
  }
  if (resultDocUrl) {
    updates.push({ range: `요청목록!N${rowIndex}`, values: [[resultDocUrl]] });
  }
  if (completedAt) {
    updates.push({ range: `요청목록!O${rowIndex}`, values: [[completedAt]] });
  }
  if (chatHistory) {
    updates.push({ range: `요청목록!P${rowIndex}`, values: [[chatHistory]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates,
    },
  });
}

// Google Drive에 마크다운 파일 생성
async function createMarkdownFile(
  drive: any,
  fileName: string,
  content: string,
  folderId?: string
) {
  const fileMetadata: any = {
    name: `${fileName}.md`,
    mimeType: 'text/markdown',
  };

  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: 'text/markdown',
      body: content,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  return {
    fileId: response.data.id,
    fileUrl: response.data.webViewLink,
  };
}

// Claude API로 블로그 글 생성
async function generateBlogContent(
  hospitalName: string,
  systemPrompt: string,
  targetKeyword: string,
  topicKeyword: string,
  purpose: string,
  formatType: string,
  formatCustom?: string
) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const baseSystemPrompt = `당신은 ${hospitalName}의 전문 의료 블로그 작성자입니다.

${systemPrompt}

## 작성 규칙
1. 정확한 의료 정보를 바탕으로 작성
2. 환자가 이해하기 쉬운 언어 사용
3. SEO를 고려한 키워드 배치
4. 병원의 전문성과 신뢰성 강조
5. 마크다운 형식으로 작성 (제목은 ##, 소제목은 ###)`;

  const userPrompt = `다음 조건에 맞는 블로그 글을 작성해주세요.

**타겟 키워드:** ${targetKeyword}
**주제:** ${topicKeyword}
**목적:** ${purpose}
**구조:** ${formatType}${formatCustom ? `\n**추가 요청:** ${formatCustom}` : ''}

위 조건에 맞춰 완성된 블로그 글을 마크다운 형식으로 작성해주세요.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8096,
    system: baseSystemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  return textContent ? textContent.text : '';
}

// POST: 대기 중인 요청 처리
export async function POST() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: 'Google Sheets 환경변수가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API 키가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
    const spreadsheetId = getSpreadsheetId();

    // 요청 목록 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '요청목록!A2:P1000',
    });

    const rows = response.data.values || [];
    const results: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const status = row[9] || ''; // J열: status

      // 대기 상태인 요청만 처리
      if (status !== '대기') continue;

      const rowIndex = i + 2; // 실제 시트 행 번호 (헤더 + 0-index)
      const requestId = row[0] || '';
      const hospitalId = row[2] || '';
      const targetKeyword = row[4] || '';
      const topicKeyword = row[5] || '';
      const purpose = row[6] || '';
      const formatType = row[7] || '';
      const formatCustom = row[8] || '';

      try {
        // 상태를 '생성중'으로 변경
        await updateRequestStatus(sheets, spreadsheetId, rowIndex, '생성중');

        // 병원 정보 가져오기
        const hospital = await getHospitalById(sheets, spreadsheetId, hospitalId);
        if (!hospital) {
          await updateRequestStatus(sheets, spreadsheetId, rowIndex, '에러');
          results.push({ requestId, status: 'error', message: '병원 정보를 찾을 수 없습니다.' });
          continue;
        }

        // Claude로 글 생성
        const content = await generateBlogContent(
          hospital.hospital_name,
          hospital.system_prompt,
          targetKeyword,
          topicKeyword,
          purpose,
          formatType,
          formatCustom
        );

        // Google Drive에 저장
        const fileName = `${targetKeyword}_${requestId}`;
        const { fileId, fileUrl } = await createMarkdownFile(
          drive,
          fileName,
          content,
          hospital.output_folder_id
        );

        // 채팅 히스토리 생성
        const now = new Date().toISOString();
        const chatHistory = JSON.stringify([
          {
            id: `msg_${Date.now()}_1`,
            role: 'system',
            content: `블로그 글 생성을 시작합니다.\n\n**타겟 키워드:** ${targetKeyword}\n**주제:** ${topicKeyword}\n**구조:** ${formatType}`,
            created_at: now,
          },
          {
            id: `msg_${Date.now()}_2`,
            role: 'assistant',
            content: content,
            created_at: now,
            doc_id: fileId,
            doc_url: fileUrl,
          },
        ]);

        // 완료 상태로 업데이트
        await updateRequestStatus(
          sheets,
          spreadsheetId,
          rowIndex,
          '완료',
          fileId,
          fileUrl,
          now,
          chatHistory
        );

        results.push({
          requestId,
          status: 'completed',
          fileId,
          fileUrl,
        });
      } catch (error) {
        console.error(`요청 ${requestId} 처리 실패:`, error);
        await updateRequestStatus(sheets, spreadsheetId, rowIndex, '에러');
        results.push({
          requestId,
          status: 'error',
          message: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Process API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 처리 상태 확인 (Vercel Cron에서 사용 가능)
export async function GET() {
  // POST와 동일하게 처리 (Cron job 호환)
  return POST();
}

