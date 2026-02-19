import { NextResponse } from 'next/server';
  import { google } from 'googleapis';
  import Anthropic from '@anthropic-ai/sdk';
  import { getReferenceContents } from '@/lib/google-drive';

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
      range: '병원설정!A2:I100',
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
          prompt_name: row[5] || '',
          system_prompt: row[6] || '',
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

    updates.push({
      range: `요청목록!J${rowIndex}`,
      values: [[status]],
    });

    if (resultDocId) {
      updates.push({ range: `요청목록!K${rowIndex}`, values: [[resultDocId]] });
    }
    if (resultDocUrl) {
      updates.push({ range: `요청목록!L${rowIndex}`, values: [[resultDocUrl]] });
    }
    if (completedAt) {
      updates.push({ range: `요청목록!N${rowIndex}`, values: [[completedAt]] });
    }
    if (chatHistory) {
      updates.push({ range: `요청목록!O${rowIndex}`, values: [[chatHistory]] });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });
  }

  // Google Drive에 마크다운 파일 생성 (공유 드라이브 필수)
  async function createMarkdownFile(
    drive: any,
    fileName: string,
    content: string,
    folderId?: string
  ) {
    if (!folderId) {
      throw new Error('output_folder_id가 설정되지 않았습니다. 병원설정에서 출력 폴더 ID를 확인해주세요.');
    }

    const fileMetadata: any = {
      name: `${fileName}.md`,
      mimeType: 'text/markdown',
      parents: [folderId],
    };

    const createResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: 'text/markdown',
        body: content,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const fileId = createResponse.data.id;
    if (!fileId) {
      throw new Error('파일 생성에 실패했습니다.');
    }

    // 파일을 누구나 볼 수 있도록 권한 설정 (링크 공유)
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });

    return {
      fileId,
      fileUrl: createResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
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
    formatCustom?: string,
    referenceText?: string
  ) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const baseSystemPrompt = `당신은 ${hospitalName}의 전문 의료 블로그 작성자입니다.

  ${systemPrompt}

  ## 작성 규칙
  1. 정확한 의료 정보를 바탕으로 작성
  2. 환자가 이해하기 쉬운 언어 사용
  3. SEO를 고려한 키워드 배치
  4. 병원의 전문성과 신뢰성 강조
  5. 마크다운 형식으로 작성 (제목은 ##, 소제목은 ###)

  ## ⚠️ 최우선 원칙: 사실만 작성 (할루시네이션 절대 금지)

  ### 절대 하지 말아야 할 것 (위반 시 글 전체가 무효):
  - ❌ 구체적인 숫자/통계 사용 금지: "90%의 환자", "3배 빠른", "80% 이상", "10명 중 8명" 등
  - ❌ 연구/논문 인용 금지: "연구에 따르면", "논문에서 밝혀진", "임상 결과" 등
  - ❌ 가상의 환자 사례 작성 금지: "A씨는...", "30대 직장인 김씨", "실제 환자의 경우" 등
  - ❌ 특정 기간/기한 단언 금지: "2주 안에 회복", "3개월 후에는", "1주일이면 충분" 등
  - ❌ 병원 실적/성과 날조 금지: "수천 건의 시술 경험", "높은 성공률", "많은 환자분들이" 등
  - ❌ 비교 우위 주장 금지: "가장 효과적인", "최고의 결과", "타 치료법보다 우수한" 등

  ### 반드시 사용해야 하는 표현 방식:
  - ✅ 정도 표현: "많은 경우", "일부 환자에서", "경우에 따라 다를 수 있음"
  - ✅ 가능성 표현: "~할 수 있습니다", "~가 기대됩니다", "~에 도움이 될 수 있습니다"
  - ✅ 일반론: "일반적으로", "통상적으로", "대체로"
  - ✅ 개인차 강조: "개인마다 다를 수 있습니다", "전문의와 상담이 필요합니다"
  - ✅ 조건부 표현: "~한 경우에는", "~라면", "상황에 따라"

  ### 기간/효과 언급 시 필수 표현:
  - "정확한 기간은 개인의 상태에 따라 달라집니다"
  - "담당 전문의와의 상담을 통해 확인하시기 바랍니다"
  - "일반적인 경우를 기준으로 하며, 개인차가 있을 수 있습니다"

  ### 글 작성 시 자가 점검:
  작성 후 다음 질문에 "예"라고 답할 수 있는 내용이 하나라도 있다면 해당 문장을 수정하세요:
  1. 이 숫자/통계의 출처를 댈 수 있는가? → 출처 없으면 삭제
  2. 이 환자 사례는 실제인가? → 가상이면 삭제 (가상 사례도 쓰지 마세요)
  3. 이 기간/효과를 보장할 수 있는가? → 보장 못하면 "개인차가 있습니다" 추가
  4. 이 비교/우위 주장의 근거가 있는가? → 근거 없으면 삭제` + (referenceText ? `

  ## 참고자료
  아래는 이 병원에서 제공한 참고자료입니다. 반드시 다음 규칙을 따르세요:
  - 아래 참고자료에 포함된 정보를 우선적으로 활용하세요
  - 참고자료에 없는 의료 정보는 '일반적으로 알려진 바에 따르면'과 같은 표현을 사용하세요
  - 참고자료의 내용과 모순되는 내용을 절대 작성하지 마세요

  ${referenceText}` : '');

    const userPrompt = `다음 조건에 맞는 블로그 글을 작성해주세요.

  **타겟 키워드:** ${targetKeyword}
  **주제:** ${topicKeyword}
  **목적:** ${purpose}
  **구조:** ${formatType}${formatCustom ? `\n**추가 요청:** ${formatCustom}` : ''}

  위 조건에 맞춰 완성된 블로그 글을 마크다운 형식으로 작성해주세요.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8096,
      temperature: 0,
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
        const status = row[9] || '';

        if (status !== '대기') continue;

        const rowIndex = i + 2;
        const requestId = row[0] || '';
        const hospitalId = row[2] || '';
        const targetKeyword = row[4] || '';
        const topicKeyword = row[5] || '';
        const purpose = row[6] || '';
        const formatType = row[7] || '';
        const formatCustom = row[8] || '';

        // 필수 필드 검증: 모든 필수 정보가 입력되었는지 확인
        // (format_custom은 선택사항이므로 검증하지 않음)
        if (!requestId || !hospitalId || !targetKeyword || !topicKeyword || !purpose || !formatType) {
          // 필수 필드가 비어있으면 건너뜀 (아직 입력 중인 상태)
          continue;
        }

        try {
          await updateRequestStatus(sheets, spreadsheetId, rowIndex, '생성중');

          const hospital = await getHospitalById(sheets, spreadsheetId, hospitalId);
          if (!hospital) {
            await updateRequestStatus(sheets, spreadsheetId, rowIndex, '에러');
            results.push({ requestId, status: 'error', message: '병원 정보를 찾을 수 없습니다.' });
            continue;
          }

          // 참고자료 읽기
          let referenceText = '';
          if (hospital.reference_folder_id) {
            try {
              referenceText = await getReferenceContents(hospital.reference_folder_id);
            } catch (refError) {
              console.error(`참고자료 읽기 실패 (${hospital.hospital_name}):`, refError);
            }
          }

          const content = await generateBlogContent(
            hospital.hospital_name,
            hospital.system_prompt,
            targetKeyword,
            topicKeyword,
            purpose,
            formatType,
            formatCustom,
            referenceText
          );

          const fileName = `${targetKeyword}_${requestId}`;
          const { fileId, fileUrl } = await createMarkdownFile(
            drive,
            fileName,
            content,
            hospital.output_folder_id
          );

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
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          console.error(`요청 ${requestId} 처리 실패:`, error);
          const errorChatHistory = JSON.stringify([{
            id: `error_${Date.now()}`,
            role: 'system',
            content: `에러 발생: ${errorMessage}`,
            created_at: new Date().toISOString(),
          }]);
          await updateRequestStatus(sheets, spreadsheetId, rowIndex, '에러', undefined, undefined, undefined, errorChatHistory);
          results.push({
            requestId,
            status: 'error',
            message: errorMessage,
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

  export async function GET() {
    return POST();
  }
