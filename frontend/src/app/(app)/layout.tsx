"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { DualLogoLoader } from "@/components/ui/LoadingState";
import { NavigationTracker } from "@/components/NavigationTracker";

import { SidebarProvider } from "@/lib/sidebar-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <DualLogoLoader
        label="Loading Workspace..."
        fullscreen
      />
    );
  }

  return (
    <SidebarProvider>
      <Suspense fallback={null}>
        <NavigationTracker />
      </Suspense>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin,width] duration-300 ease-in-out">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-6 py-6 transition-all duration-300 ease-in-out">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
