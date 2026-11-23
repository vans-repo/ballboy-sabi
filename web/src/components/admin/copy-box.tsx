"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/** A block of text with a Copy button. */
export function CopyBox({ text, label, rows = 4 }: { text: string; label: string; rows?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2">
      <textarea
        readOnly
        value={text}
        rows={rows}
        aria-label={label}
        className="w-full rounded-lg border bg-background p-3 font-mono text-xs"
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(text).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <span className="text-xs text-muted-foreground">{text.length} characters</span>
      </div>
    </div>
  );
}
