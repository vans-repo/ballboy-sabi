"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  type FormState,
  logIn,
  logInWithGoogle,
  requestReset,
  signUp,
  updatePassword,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

const input =
  "h-11 w-full rounded-lg border bg-surface px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, ...props }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input className={input} {...props} />
    </label>
  );
}

function Status({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-lg bg-destructive/15 p-3 text-sm">
        {state.error}
      </p>
    );
  if (state?.message)
    return (
      <p role="status" className="rounded-lg bg-muted p-3 text-sm">
        {state.message}
      </p>
    );
  return null;
}

function Carry({ next, pick }: { next: string; pick: string | null }) {
  return (
    <>
      <input type="hidden" name="next" value={next} />
      {pick && <input type="hidden" name="pick" value={pick} />}
    </>
  );
}

function GoogleButton({ next, pick }: { next: string; pick: string | null }) {
  return (
    <form action={logInWithGoogle}>
      <Carry next={next} pick={pick} />
      <Button type="submit" variant="outline" className="w-full">
        Continue with Google
      </Button>
    </form>
  );
}

export function LogInForm({ next, pick }: { next: string; pick: string | null }) {
  const [state, action, pending] = useActionState(logIn, undefined);
  const qs = new URLSearchParams({ next, ...(pick ? { pick } : {}) }).toString();
  return (
    <div className="grid gap-4">
      {pick && (
        <p className="rounded-lg bg-muted p-3 text-sm">Log in and we&apos;ll save your pick.</p>
      )}
      <form action={action} className="grid gap-3">
        <Carry next={next} pick={pick} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Status state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <GoogleButton next={next} pick={pick} />
      <p className="text-sm">
        New here?{" "}
        <Link href={`/signup?${qs}`} className="text-primary underline underline-offset-2">
          Create an account
        </Link>
        {" · "}
        <Link href="/reset-password" className="text-primary underline underline-offset-2">
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm({ next, pick }: { next: string; pick: string | null }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  const qs = new URLSearchParams({ next, ...(pick ? { pick } : {}) }).toString();
  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-3">
        <Carry next={next} pick={pick} />
        <Field
          label="Display name (shown on the leaderboard)"
          name="display_name"
          minLength={2}
          maxLength={30}
          required
          autoComplete="nickname"
        />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password (at least 8 characters)"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="email_opt_in"
            className="size-5 accent-[var(--tnb-accent)]"
          />
          Send me the weekly Matchday Preview email
        </label>
        <Status state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating your account…" : "Create account"}
        </Button>
      </form>
      <GoogleButton next={next} pick={pick} />
      <p className="text-sm">
        Already have an account?{" "}
        <Link href={`/login?${qs}`} className="text-primary underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  return (
    <form action={action} className="grid gap-3">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Status state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="grid gap-3">
      <Field
        label="New password (at least 8 characters)"
        name="password"
        type="password"
        minLength={8}
        autoComplete="new-password"
        required
      />
      <Status state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        Save password
      </Button>
    </form>
  );
}
