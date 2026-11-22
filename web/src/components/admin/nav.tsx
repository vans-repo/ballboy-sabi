"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Needs results" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/results", label: "Results history" },
  { href: "/admin/teams", label: "Teams & Seasons" },
  { href: "/admin/model", label: "Model" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 mb-5 overflow-x-auto px-4">
      <ul className="flex gap-1">
        {ITEMS.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center rounded-lg px-3 text-sm whitespace-nowrap",
                  active ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-muted",
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
