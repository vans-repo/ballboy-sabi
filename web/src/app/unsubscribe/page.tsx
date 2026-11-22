import type { Metadata } from "next";
import { Suspense } from "react";

import { UnsubscribeForm } from "@/app/unsubscribe/form";
import { PageTitle } from "@/components/section";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/**
 * One click, no login. The link is signed for one fan. A button (rather than
 * unsubscribing on page load) stops mail scanners that open links from
 * unsubscribing people by accident.
 */
export default function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle>Weekly email</PageTitle>
      <Suspense>
        <Form searchParams={searchParams as Promise<{ u?: string; t?: string }>} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: Promise<{ u?: string; t?: string }> }) {
  const { u, t } = await searchParams;
  return <UnsubscribeForm u={u ?? ""} t={t ?? ""} />;
}
