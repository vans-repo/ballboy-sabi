import { FREE_TO_PLAY_LINE, SITE_NAME } from "@/config/site";

// Stage 1 placeholder. Replaced by the real Home page in Stage 4.
const swatches = [
  { name: "background", className: "bg-background border" },
  { name: "surface", className: "bg-surface" },
  { name: "accent", className: "bg-primary" },
  { name: "accent-pressed", className: "bg-primary-pressed" },
  { name: "neutral (draw)", className: "bg-draw" },
  { name: "away", className: "bg-away" },
  { name: "success", className: "bg-success" },
  { name: "danger", className: "bg-danger" },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-8">
      <h1 className="text-4xl font-extrabold uppercase">{SITE_NAME}</h1>
      <p className="mt-2 text-muted-foreground">Design tokens, Stage 1.</p>

      <section className="mt-6 rounded-xl bg-surface p-4">
        <div className="figure flex items-baseline gap-4 text-5xl">
          <span className="text-primary">65%</span>
          <span>26%</span>
          <span className="text-away">9%</span>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
          <div className="bg-home" style={{ width: "65%" }} />
          <div className="bg-draw" style={{ width: "26%" }} />
          <div className="bg-away" style={{ width: "9%" }} />
        </div>
      </section>

      <ul className="mt-6 grid grid-cols-2 gap-3">
        {swatches.map((s) => (
          <li key={s.name} className="flex items-center gap-3">
            <span className={`size-11 rounded-lg ${s.className}`} />
            <span className="text-sm">{s.name}</span>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-muted-foreground">{FREE_TO_PLAY_LINE}</p>
    </main>
  );
}
