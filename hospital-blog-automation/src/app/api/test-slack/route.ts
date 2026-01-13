import { NextResponse } from 'next/server';
import { sendSlackDM, sendPersonalNotification } from '@/lib/slack';

// GET: Slack DM 테스트
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slackMemberId = searchParams.get('slack_id');

  if (!slackMemberId) {
    return NextResponse.json({
      error: 'slack_id 파라미터가 필요합니다.',
      usage: '/api/test-slack?slack_id=U05ABC123XY',
    }, { status: 400 });
  }

  try {
    const result = await sendSlackDM(slackMemberId, {
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
    });

    return NextResponse.json({
      success: result,
      message: result ? 'DM 전송 성공!' : 'DM 전송 실패 - 로그를 확인하세요.',
      slack_member_id: slackMemberId,
    });
  } catch (error) {
    console.error('Test Slack Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'DM 전송 중 오류 발생',
    }, { status: 500 });
  }
}
