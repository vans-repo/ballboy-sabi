import { ResultEditor } from "@/components/admin/result-editor";
import { Empty, PageTitle } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { renderTime } from "@/lib/time";
import { editable } from "@/lib/admin/rows";
import { getContext } from "@/lib/data/context";

/** Every match whose kick-off has passed with no result yet, oldest first. */
export default async function NeedsResultsPage() {
  await requireAdmin();
  const ctx = await getContext();
  const now = renderTime();
  const waiting = ctx.matches
    .filter(
      (m) => (m.status === "scheduled" || m.status === "postponed") && Date.parse(m.kickoff) <= now,
    )
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  return (
    <>
      <PageTitle sub="Matches that have kicked off without a result, oldest first.">
        Needs results
      </PageTitle>
      {waiting.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {waiting.map((m) => (
            <li key={m.id}>
              <ResultEditor match={editable(m, ctx)} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nothing waiting. Every match that has kicked off has a result.</Empty>
      )}
    </>
  );
}
