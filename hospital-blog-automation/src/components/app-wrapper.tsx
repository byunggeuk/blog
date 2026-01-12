'use client';

import { useState } from 'react';
import { AppProvider, useApp } from '@/lib/store';
import { LoginPage, PendingApprovalPage, BlockedUserPage } from '@/components/auth/login-page';
import { Dashboard } from '@/components/dashboard/dashboard';
import { AdminLayout } from '@/components/admin/admin-layout';

function AppContent() {
  const { authStatus, user } = useApp();
  const isAdmin = user?.role === 'admin';

  // Handle different auth states
  switch (authStatus) {
    case 'unauthenticated':
      return <LoginPage />;
    case 'pending':
      return <PendingApprovalPage />;
    case 'blocked':
      return <BlockedUserPage />;
    case 'authenticated':
      // Show admin layout with tabs for admin users
      if (isAdmin) {
        return <AdminLayout />;
      }
      // Regular user dashboard
      return <Dashboard />;
    default:
      return <LoginPage />;
  }
}

export function AppWrapper() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
