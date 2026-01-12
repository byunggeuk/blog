'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { UserManagement } from '@/components/admin/user-management';

type AppTab = 'dashboard' | 'users';

export function AdminLayout() {
  const [currentTab, setCurrentTab] = useState<AppTab>('dashboard');

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header currentTab={currentTab} onTabChange={setCurrentTab} />
      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        {currentTab === 'dashboard' ? (
          <DashboardContent />
        ) : (
          <UserManagement />
        )}
      </main>
    </div>
  );
}
