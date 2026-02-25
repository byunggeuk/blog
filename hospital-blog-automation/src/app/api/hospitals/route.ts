import { NextRequest, NextResponse } from "next/server";
import {
  getHospitals,
  addHospital,
  updateHospital,
  deleteHospital,
} from "@/lib/google-sheets";
import { mockHospitals } from "@/lib/mock-data";
import { Hospital } from "@/types";

export async function GET() {
  try {
    // Google Sheets 연동이 설정되어 있으면 시트에서 가져옴
    if (
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
      process.env.GOOGLE_SPREADSHEET_ID
    ) {
      const hospitals = await getHospitals();
      // 활성화된 병원만 반환 (관리 페이지에서는 전체 조회 가능하도록 쿼리 파라미터로 구분 가능)
      return NextResponse.json({ hospitals, source: "sheets" });
    }

    // 아니면 mock 데이터 반환
    return NextResponse.json({ hospitals: mockHospitals, source: "mock" });
  } catch (error) {
    console.error("Hospitals API Error:", error);

    // 에러 시 mock 데이터로 폴백
    return NextResponse.json({
      hospitals: mockHospitals,
      source: "mock",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// 병원 추가
export async function POST(request: NextRequest) {
  try {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      !process.env.GOOGLE_SPREADSHEET_ID
    ) {
      return NextResponse.json(
        { error: "Google Sheets 설정이 필요합니다." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const {
      hospital_name,
      blog_url,
      reference_folder_id,
      output_folder_id,
      prompt_name,
      system_prompt,
    } = body;

    if (!hospital_name) {
      return NextResponse.json(
        { error: "병원 이름은 필수입니다." },
        { status: 400 },
      );
    }

    const hospital: Hospital = {
      hospital_id: `H${Date.now()}`,
      hospital_name,
      blog_url: blog_url || "",
      reference_folder_id: reference_folder_id || "",
      output_folder_id: output_folder_id || "",
      prompt_name: prompt_name || "",
      system_prompt: system_prompt || "",
      created_at: new Date().toISOString(),
      is_active: true,
    };

    await addHospital(hospital);

    return NextResponse.json({ success: true, hospital });
  } catch (error) {
    console.error("Add Hospital Error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

// 병원 수정
export async function PUT(request: NextRequest) {
  try {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      !process.env.GOOGLE_SPREADSHEET_ID
    ) {
      return NextResponse.json(
        { error: "Google Sheets 설정이 필요합니다." },
        { status: 500 },
      );
    }

    const hospital: Hospital = await request.json();

    if (!hospital.hospital_id) {
      return NextResponse.json(
        { error: "병원 ID가 필요합니다." },
        { status: 400 },
      );
    }

    await updateHospital(hospital);

    return NextResponse.json({ success: true, hospital });
  } catch (error) {
    console.error("Update Hospital Error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

// 병원 삭제 (비활성화)
export async function DELETE(request: NextRequest) {
  try {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      !process.env.GOOGLE_SPREADSHEET_ID
    ) {
      return NextResponse.json(
        { error: "Google Sheets 설정이 필요합니다." },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const hospitalId = searchParams.get("id");

    if (!hospitalId) {
      return NextResponse.json(
        { error: "병원 ID가 필요합니다." },
        { status: 400 },
      );
    }

    await deleteHospital(hospitalId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Hospital Error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
