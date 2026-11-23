import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/nav";
import { RunTracker } from "@/components/admin/run-tracker";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-ink uppercase">Admin</p>
      <Suspense>
        <AdminNav />
      </Suspense>
      <RunTracker />
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>{children}</Suspense>
    </div>
  );
}
