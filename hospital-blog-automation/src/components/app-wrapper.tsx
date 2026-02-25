"use client";

import { useSession } from "next-auth/react";
import { AppProvider, useApp } from "@/lib/store";
import { LoginPage } from "@/components/auth/login-page";
import { Dashboard } from "@/components/dashboard/dashboard";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AccessDenied } from "@/components/auth/access-denied";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { data: session, status } = useSession();
  const { user, authStatus, isLoading } = useApp();

  // 세션 로딩 중이거나 사용자 데이터 로딩 중
  if (status === "loading" || (session && authStatus === "unauthenticated")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // 승인 대기 또는 차단된 사용자
  if (authStatus === "pending" || authStatus === "blocked") {
    return <AccessDenied />;
  }

  const isAdmin = user?.role === "admin";

  if (isAdmin) {
    return <AdminLayout />;
  }

  return <Dashboard />;
}

export function AppWrapper() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
