import type { Metadata } from "next";
import { Suspense } from "react";

import { LogInForm } from "@/components/auth/forms";
import { PageTitle } from "@/components/section";
import { FREE_TO_PLAY_LINE } from "@/config/site";
import { safeNext } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

type Search = { next?: string; pick?: string; error?: string };

export default function Page({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm">
      <PageTitle sub={FREE_TO_PLAY_LINE}>Log in</PageTitle>
      <Suspense>
        <Form searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Search> }) {
  const { next, pick, error } = await searchParams;
  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/15 p-3 text-sm">
          {error === "google"
            ? "Google sign-in isn't available right now. Use your email instead."
            : "That link has expired or was already used. Please try again."}
        </p>
      )}
      <LogInForm next={safeNext(next)} pick={pick ?? null} />
    </>
  );
}
