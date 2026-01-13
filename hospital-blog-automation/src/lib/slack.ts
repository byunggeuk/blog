// Slack Webhook 알림 유틸리티

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: any[];
  accessory?: any;
}

interface SlackAttachment {
  color?: string;
  blocks?: SlackBlock[];
}

// 웹훅 URL 가져오기
function getSlackWebhookUrl(): string | null {
  return process.env.SLACK_WEBHOOK_URL || null;
}

// 기본 메시지 전송
export async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  const webhookUrl = getSlackWebhookUrl();

  if (!webhookUrl) {
    console.log('Slack webhook URL not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('Slack notification failed:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Slack notification error:', error);
    return false;
  }
}

// 새 요청 생성 알림
export async function notifyNewRequest(params: {
  requestId: string;
  hospitalName: string;
  targetKeyword: string;
  topicKeyword: string;
  formatType: string;
  createdBy: string;
}): Promise<boolean> {
  const { requestId, hospitalName, targetKeyword, topicKeyword, formatType, createdBy } = params;

  return sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📝 새 블로그 요청',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${hospitalName}*의 새로운 블로그 글 요청이 등록되었습니다.`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `• *요청 ID:* ${requestId}`,
            `• *타겟 키워드:* ${targetKeyword}`,
            `• *주제:* ${topicKeyword}`,
            `• *글 구조:* ${formatType}`,
            `• *요청자:* ${createdBy}`,
          ].join('\n'),
        },
      },
    ],
  });
}

// 요청 완료 알림
export async function notifyRequestCompleted(params: {
  requestId: string;
  hospitalName: string;
  targetKeyword: string;
  docUrl?: string;
}): Promise<boolean> {
  const { requestId, hospitalName, targetKeyword, docUrl } = params;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '✅ 블로그 글 생성 완료',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${hospitalName}*의 블로그 글이 생성되었습니다.`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `• *요청 ID:* ${requestId}`,
          `• *타겟 키워드:* ${targetKeyword}`,
          docUrl ? `• *문서:* <${docUrl}|Google Docs에서 보기>` : '',
        ].filter(Boolean).join('\n'),
      },
    },
  ];

  return sendSlackMessage({ blocks });
}

// 수정 요청 알림
export async function notifyRevisionRequested(params: {
  requestId: string;
  hospitalName: string;
  targetKeyword: string;
  revisionRequest: string;
  revisionCount: number;
}): Promise<boolean> {
  const { requestId, hospitalName, targetKeyword, revisionRequest, revisionCount } = params;

  return sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔄 수정 요청',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${hospitalName}*의 블로그 글에 수정 요청이 있습니다.`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `• *요청 ID:* ${requestId}`,
            `• *타겟 키워드:* ${targetKeyword}`,
            `• *수정 횟수:* ${revisionCount}회`,
            `• *수정 내용:* ${revisionRequest}`,
          ].join('\n'),
        },
      },
    ],
  });
}

// 수정 완료 알림
export async function notifyRevisionCompleted(params: {
  requestId: string;
  hospitalName: string;
  targetKeyword: string;
  revisionCount: number;
  docUrl?: string;
}): Promise<boolean> {
  const { requestId, hospitalName, targetKeyword, revisionCount, docUrl } = params;

  return sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ 수정 완료',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${hospitalName}*의 블로그 글 수정이 완료되었습니다.`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `• *요청 ID:* ${requestId}`,
            `• *타겟 키워드:* ${targetKeyword}`,
            `• *총 수정 횟수:* ${revisionCount}회`,
            docUrl ? `• *문서:* <${docUrl}|Google Docs에서 보기>` : '',
          ].filter(Boolean).join('\n'),
        },
      },
    ],
  });
}

// 에러 알림
export async function notifyError(params: {
  requestId: string;
  hospitalName: string;
  errorMessage: string;
}): Promise<boolean> {
  const { requestId, hospitalName, errorMessage } = params;

  return sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ 오류 발생',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${hospitalName}*의 블로그 글 생성 중 오류가 발생했습니다.`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `• *요청 ID:* ${requestId}`,
            `• *오류 내용:* ${errorMessage}`,
          ].join('\n'),
        },
      },
    ],
    attachments: [
      {
        color: '#dc3545',
        blocks: [],
      },
    ],
  });
}
