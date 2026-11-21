import type { Metadata } from "next";

import { NewPasswordForm } from "@/components/auth/forms";
import { PageTitle } from "@/components/section";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function Page() {
  return (
    <div className="mx-auto max-w-sm">
      <PageTitle>Choose a new password</PageTitle>
      <NewPasswordForm />
    </div>
  );
}
