"use client";

import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, Ban, LogOut, Mail } from "lucide-react";

export function AccessDenied() {
  const { authStatus, user, logout } = useApp();

  if (authStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-2xl">승인 대기 중</CardTitle>
            <CardDescription className="text-base">
              관리자의 승인을 기다리고 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-sm text-amber-800">
                <strong>{user?.name || user?.email}</strong>님의 가입 신청이
                접수되었습니다.
              </p>
              <p className="mt-2 text-sm text-amber-700">
                관리자가 승인하면 서비스를 이용하실 수 있습니다.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href="mailto:admin@company.com">
                  <Mail className="h-4 w-4" />
                  관리자에게 문의
                </a>
              </Button>
              <Button variant="ghost" className="w-full gap-2" onClick={logout}>
                <LogOut className="h-4 w-4" />
                로그아웃
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authStatus === "blocked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Ban className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">접근이 차단되었습니다</CardTitle>
            <CardDescription className="text-base">
              서비스 이용이 제한되었습니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-sm text-red-800">
                <strong>{user?.name || user?.email}</strong>님의 계정이
                차단되었습니다.
              </p>
              <p className="mt-2 text-sm text-red-700">
                자세한 내용은 관리자에게 문의해 주세요.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href="mailto:admin@company.com">
                  <Mail className="h-4 w-4" />
                  관리자에게 문의
                </a>
              </Button>
              <Button variant="ghost" className="w-full gap-2" onClick={logout}>
                <LogOut className="h-4 w-4" />
                로그아웃
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
