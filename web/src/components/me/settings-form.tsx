"use client";

import { useActionState, useEffect, useState } from "react";

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

/** Dark (default) or light. Stored on this device. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the device setting on mount
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);
  function choose(t: "dark" | "light") {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      // storage blocked: the choice lasts for this visit only
    }
    setTheme(t);
  }
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-grid w-fit grid-cols-2 gap-1 rounded-lg bg-background p-1"
    >
      {(["dark", "light"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => choose(t)}
          className={`h-11 rounded-md px-4 text-sm ${theme === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          {t === "dark" ? "Dark" : "Light"}
        </button>
      ))}
    </div>
  );
}
