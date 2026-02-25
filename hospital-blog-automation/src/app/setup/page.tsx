"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Database,
  FileSpreadsheet,
} from "lucide-react";

export default function SetupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSetup = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/setup", { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: data.message });
      } else {
        setResult({ success: false, message: data.error });
      }
    } catch (error) {
      setResult({ success: false, message: "네트워크 오류가 발생했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Google Sheets 초기 설정</CardTitle>
          <CardDescription>
            블로그 자동화 시스템에 필요한 시트 구조를 자동으로 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 설명 */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              생성되는 시트
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                  병원설정
                </span>
                <span>병원 정보, 폴더 ID, 시스템 프롬프트 관리</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                  요청목록
                </span>
                <span>블로그 글 요청 및 진행 상태 관리</span>
              </li>
            </ul>
          </div>

          {/* 사전 요구사항 */}
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">사전 요구사항:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Google Spreadsheet 생성 완료</li>
              <li>서비스 계정에 편집자 권한 공유</li>
              <li>환경변수 설정 완료 (GOOGLE_SPREADSHEET_ID)</li>
            </ul>
          </div>

          {/* 결과 메시지 */}
          {result && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                result.success
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="text-sm">{result.message}</span>
            </div>
          )}

          {/* 버튼 */}
          <Button
            onClick={handleSetup}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                설정 중...
              </>
            ) : (
              "시트 구조 생성하기"
            )}
          </Button>

          {result?.success && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => (window.location.href = "/")}
            >
              대시보드로 이동
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
