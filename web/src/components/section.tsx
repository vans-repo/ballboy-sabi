import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-3xl uppercase md:text-4xl">{children}</h1>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Section({
  title,
  more,
  children,
  className,
}: {
  title: string;
  more?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-xl uppercase">{title}</h2>
        {more && (
          <Link
            href={more.href}
            className="inline-flex min-h-11 items-center text-sm text-ink hover:underline"
          >
            {more.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">{children}</p>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-surface p-4", className)}>{children}</div>;
}
