"use client";

/** Last-resort error page, used when the root layout itself fails. Plain styles: the app's CSS may be missing. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-NG">
      <body
        style={{
          margin: 0,
          background: "#000E2E",
          color: "#fff",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 16px" }}>
          <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
          <p style={{ color: "rgba(255,255,255,0.7)" }}>
            The site couldn&apos;t load. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 8,
              background: "#F5C842",
              color: "#000E2E",
              fontWeight: 700,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
