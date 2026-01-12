'use client';

import { Header } from '@/components/layout/header';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

export function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        <DashboardContent />
      </main>
    </div>
  );
}
