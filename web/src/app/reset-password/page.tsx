import type { Metadata } from "next";

import { ResetForm } from "@/components/auth/forms";
import { PageTitle } from "@/components/section";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function Page() {
  return (
    <div className="mx-auto max-w-sm">
      <PageTitle sub="We'll email you a link to choose a new password.">
        Reset your password
      </PageTitle>
      <ResetForm />
    </div>
  );
}
