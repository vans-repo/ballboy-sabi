"use client";

import { useActionState } from "react";

import { saveSettings } from "@/app/me/actions";
import { Button } from "@/components/ui/button";

export function SettingsForm({
  displayName,
  emailOptIn,
}: {
  displayName: string;
  emailOptIn: boolean;
}) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Display name
        <input
          name="display_name"
          defaultValue={displayName}
          minLength={2}
          maxLength={30}
          required
          className="h-11 rounded-lg border bg-background px-3 text-base"
        />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="email_opt_in"
          defaultChecked={emailOptIn}
          className="size-5 accent-[var(--tnb-accent)]"
        />
        Weekly Matchday Preview email
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        Save
      </Button>
    </form>
  );
}
