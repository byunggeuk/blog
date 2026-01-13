// Slack 알림 유틸리티 (Webhook + Bot Token DM 지원)

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

// 웹훅 URL 가져오기 (채널 전체 알림용)
function getSlackWebhookUrl(): string | null {
  return process.env.SLACK_WEBHOOK_URL || null;
}

// Bot Token 가져오기 (개인 DM용)
function getSlackBotToken(): string | null {
  return process.env.SLACK_BOT_TOKEN || null;
}

// 개인 DM 전송 (Bot Token 사용)
export async function sendSlackDM(
  slackMemberId: string,
  message: SlackMessage
): Promise<boolean> {
  const botToken = getSlackBotToken();

  if (!botToken) {
    console.log('Slack bot token not configured, skipping DM');
    return false;
  }

  if (!slackMemberId) {
    console.log('No slack member ID provided, skipping DM');
    return false;
  }

  try {
    // 1. DM 채널 열기 (conversations.open)
    const openResponse = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ users: slackMemberId }),
    });

    const openData = await openResponse.json();
    if (!openData.ok) {
      console.error('Failed to open DM channel:', openData.error);
      return false;
    }

    const channelId = openData.channel.id;

    // 2. 메시지 전송 (chat.postMessage)
    const postResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        ...message,
      }),
    });

    const postData = await postResponse.json();
    if (!postData.ok) {
      console.error('Failed to send DM:', postData.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Slack DM error:', error);
    return false;
  }
}

// 웹훅으로 채널 메시지 전송
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

// 개인 알림 전송 (DM 우선, 실패시 채널로 폴백)
export async function sendPersonalNotification(
  slackMemberId: string | undefined,
  message: SlackMessage
): Promise<boolean> {
  // slack_member_id가 있으면 DM 시도
  if (slackMemberId && getSlackBotToken()) {
    const dmSent = await sendSlackDM(slackMemberId, message);
    if (dmSent) return true;
  }

  // DM 실패 또는 slack_member_id 없으면 채널로 폴백
  return sendSlackMessage(message);
}

// 새 요청 생성 알림 (채널 전체에 알림 - 관리자용)
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

// 요청 완료 알림 (개인 DM 지원)
export async function notifyRequestCompleted(params: {
  requestId: string;
  hospitalName: string;
  targetKeyword: string;
  docUrl?: string;
  slackMemberId?: string; // 요청자의 Slack ID (개인 DM용)
}): Promise<boolean> {
  const { requestId, hospitalName, targetKeyword, docUrl, slackMemberId } = params;

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

  return sendPersonalNotification(slackMemberId, { blocks });
}

// 수정 요청 알림 (개인 DM 지원)
export async function notifyRevisionRequested(params: {
  requestId: string;
  hospitalName: string;
  targetKeyword: string;
  revisionRequest: string;
  revisionCount: number;
  slackMemberId?: string;
}): Promise<boolean> {
  const { requestId, hospitalName, targetKeyword, revisionRequest, revisionCount, slackMemberId } = params;

  const message = {
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
  };

  return sendPersonalNotification(slackMemberId, message);
}

// 수정 완료 알림 (개인 DM 지원)
export async function notifyRevisionCompleted(params: {
  requestId: string;
  hospitalName: string;
  targetKeyword: string;
  revisionCount: number;
  docUrl?: string;
  slackMemberId?: string;
}): Promise<boolean> {
  const { requestId, hospitalName, targetKeyword, revisionCount, docUrl, slackMemberId } = params;

  const message = {
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
  };

  return sendPersonalNotification(slackMemberId, message);
}

// 에러 알림 (개인 DM 지원)
export async function notifyError(params: {
  requestId: string;
  hospitalName: string;
  errorMessage: string;
  slackMemberId?: string;
}): Promise<boolean> {
  const { requestId, hospitalName, errorMessage, slackMemberId } = params;

  const message = {
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
  };

  return sendPersonalNotification(slackMemberId, message);
}
