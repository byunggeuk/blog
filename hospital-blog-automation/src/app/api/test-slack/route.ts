import { NextResponse } from 'next/server';

// GET: Slack DM 테스트 (직접 구현으로 디버깅)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slackMemberId = searchParams.get('slack_id');

  if (!slackMemberId) {
    return NextResponse.json({
      error: 'slack_id 파라미터가 필요합니다.',
      usage: '/api/test-slack?slack_id=U05ABC123XY',
    }, { status: 400 });
  }

  const botToken = process.env.SLACK_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({
      error: 'SLACK_BOT_TOKEN 환경변수가 설정되지 않았습니다.',
      has_token: false,
    }, { status: 400 });
  }

  try {
    // 1. DM 채널 열기
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
      return NextResponse.json({
        error: 'DM 채널 열기 실패',
        slack_error: openData.error,
        slack_member_id: slackMemberId,
        hint: openData.error === 'user_not_found' ? '슬랙 멤버 ID가 잘못되었거나 Bot이 해당 워크스페이스에 없습니다.' :
              openData.error === 'invalid_auth' ? 'SLACK_BOT_TOKEN이 유효하지 않습니다.' :
              openData.error === 'missing_scope' ? 'Bot에 im:write 권한이 필요합니다.' : '',
      }, { status: 400 });
    }

    const channelId = openData.channel.id;

    // 2. 메시지 전송
    const postResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🧪 테스트 알림',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '블로그 자동화 시스템에서 보낸 테스트 메시지입니다.\n\n이 메시지가 보인다면 DM 설정이 정상입니다! ✅',
            },
          },
        ],
        text: '테스트 알림',
      }),
    });

    const postData = await postResponse.json();

    if (!postData.ok) {
      return NextResponse.json({
        error: '메시지 전송 실패',
        slack_error: postData.error,
        channel_id: channelId,
        hint: postData.error === 'channel_not_found' ? '채널을 찾을 수 없습니다.' :
              postData.error === 'not_in_channel' ? 'Bot이 채널에 없습니다.' :
              postData.error === 'missing_scope' ? 'Bot에 chat:write 권한이 필요합니다.' : '',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'DM 전송 성공!',
      slack_member_id: slackMemberId,
      channel_id: channelId,
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'DM 전송 중 오류 발생',
    }, { status: 500 });
  }
}
