"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { BocoHeader } from '@/components/boco-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur h-16 flex items-center px-6">
          <Skeleton className="h-8 w-32 rounded-xl" />
        </header>
        <main className="flex-1 max-w-7xl mx-auto w-full p-8">
          <Skeleton className="h-96 w-full rounded-3xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <BocoHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
