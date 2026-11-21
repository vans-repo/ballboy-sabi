import type { Metadata } from "next";

import { Empty, PageTitle } from "@/components/section";

export const metadata: Metadata = { title: "Me" };

// Built in Stage 5 (accounts and picks).
export default function MePage() {
  return (
    <>
      <PageTitle>Me</PageTitle>
      <Empty>Accounts are coming soon. You will see your picks, points and settings here.</Empty>
    </>
  );
}
