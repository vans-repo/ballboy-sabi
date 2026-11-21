"use client";

import { PageTitle } from "@/components/section";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageTitle>Something went wrong</PageTitle>
      <p className="mb-4 text-muted-foreground">
        We couldn&apos;t load this page. Please try again in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </>
  );
}
