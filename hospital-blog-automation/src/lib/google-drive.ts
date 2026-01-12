import { google } from 'googleapis';

// Service Account 인증 설정
function getAuthClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.');
  }

  const serviceAccount = JSON.parse(credentials);

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return auth;
}

export interface FileResult {
  fileId: string;
  fileUrl: string;
  fileName: string;
  version: number;
}

export interface FileVersion {
  revisionId: string;
  version: number;
  modifiedTime: string;
  downloadUrl: string;
}

// 마크다운 파일 생성
export async function createMarkdownFile(
  fileName: string,
  content: string,
  folderId?: string
): Promise<FileResult> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata: { name: string; mimeType: string; parents?: string[] } = {
    name: fileName.endsWith('.md') ? fileName : `${fileName}.md`,
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
    fields: 'id, name, webViewLink, version',
    supportsAllDrives: true,
  });

  const fileId = response.data.id;
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
    fileUrl: response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    fileName: response.data.name || fileName,
    version: 1,
  };
}

// 마크다운 파일 업데이트 (새 버전 자동 생성)
export async function updateMarkdownFile(
  fileId: string,
  content: string
): Promise<FileResult> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // keepRevisionForever: true로 설정하면 버전이 영구 보관됨
  const response = await drive.files.update({
    fileId: fileId,
    media: {
      mimeType: 'text/markdown',
      body: content,
    },
    fields: 'id, name, webViewLink, version',
    keepRevisionForever: true,
    supportsAllDrives: true,
  });

  // 현재 버전 번호 가져오기
  const revisions = await drive.revisions.list({
    fileId: fileId,
    fields: 'revisions(id)',
  });
  const versionCount = revisions.data.revisions?.length || 1;

  return {
    fileId,
    fileUrl: response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    fileName: response.data.name || '',
    version: versionCount,
  };
}

// 파일의 모든 버전 가져오기
export async function getFileVersions(fileId: string): Promise<FileVersion[]> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.revisions.list({
    fileId: fileId,
    fields: 'revisions(id, modifiedTime, keepForever)',
  });

  return (response.data.revisions || []).map((rev, index) => ({
    revisionId: rev.id || '',
    version: index + 1,
    modifiedTime: rev.modifiedTime || '',
    downloadUrl: `https://drive.google.com/uc?id=${fileId}&revisionId=${rev.id}&export=download`,
  }));
}

// 특정 버전의 파일 내용 가져오기
export async function getFileContent(
  fileId: string,
  revisionId?: string
): Promise<string> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  let response;
  if (revisionId) {
    response = await drive.revisions.get({
      fileId: fileId,
      revisionId: revisionId,
      alt: 'media',
    });
  } else {
    response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    });
  }

  return response.data as string;
}

// 파일 정보 가져오기
export async function getFileInfo(fileId: string): Promise<{
  name: string;
  modifiedTime: string;
  version: number;
}> {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const [fileResponse, revisionsResponse] = await Promise.all([
    drive.files.get({
      fileId: fileId,
      fields: 'name, modifiedTime',
    }),
    drive.revisions.list({
      fileId: fileId,
      fields: 'revisions(id)',
    }),
  ]);

  return {
    name: fileResponse.data.name || '',
    modifiedTime: fileResponse.data.modifiedTime || '',
    version: revisionsResponse.data.revisions?.length || 1,
  };
}
