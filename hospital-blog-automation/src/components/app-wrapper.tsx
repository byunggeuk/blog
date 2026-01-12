'use client';

import { useSession } from 'next-auth/react';
import { AppProvider, useApp } from '@/lib/store';
import { LoginPage } from '@/components/auth/login-page';
import { Dashboard } from '@/components/dashboard/dashboard';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { data: session, status } = useSession();
  const { user } = useApp();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const isAdmin = user?.role === 'admin';

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
