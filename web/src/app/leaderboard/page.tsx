import type { Metadata } from "next";

import { Empty, PageTitle } from "@/components/section";

export const metadata: Metadata = { title: "Leaderboard" };

// Built in Stage 5 (accounts and picks).
export default function LeaderboardPage() {
  return (
    <>
      <PageTitle>Leaderboard</PageTitle>
      <Empty>No scores yet. The leaderboard fills in once fans start making picks.</Empty>
    </>
  );
}
