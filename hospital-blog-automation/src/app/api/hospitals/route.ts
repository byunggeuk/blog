import { NextResponse } from 'next/server';
import { getHospitals } from '@/lib/google-sheets';
import { mockHospitals } from '@/lib/mock-data';

export async function GET() {
  try {
    // Google Sheets 연동이 설정되어 있으면 시트에서 가져옴
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SPREADSHEET_ID) {
      const hospitals = await getHospitals();
      return NextResponse.json({ hospitals, source: 'sheets' });
    }

    // 아니면 mock 데이터 반환
    return NextResponse.json({ hospitals: mockHospitals, source: 'mock' });
  } catch (error) {
    console.error('Hospitals API Error:', error);

    // 에러 시 mock 데이터로 폴백
    return NextResponse.json({
      hospitals: mockHospitals,
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
