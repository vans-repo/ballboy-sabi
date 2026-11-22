"use client";

import Link from "next/link";
import { useActionState } from "react";

import { confirmUnsubscribe } from "@/app/unsubscribe/actions";
import { Button } from "@/components/ui/button";

export function UnsubscribeForm({ u, t }: { u: string; t: string }) {
  const [state, action, pending] = useActionState(confirmUnsubscribe, {});
  if (state.done) {
    return (
      <p role="status" className="rounded-xl bg-surface p-4">
        Done. You won&apos;t get the weekly preview any more. You can turn it back on in{" "}
        <Link href="/me" className="text-primary underline underline-offset-2">
          Me
        </Link>
        .
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="u" value={u} />
      <input type="hidden" name="t" value={t} />
      <p>Stop the weekly Matchday Preview email? You can still log in and play.</p>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="justify-self-start">
        Unsubscribe
      </Button>
    </form>
  );
}
