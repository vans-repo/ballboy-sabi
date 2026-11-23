import { useId } from "react";

import { cn } from "@/lib/utils";

/** An Adire-style resist pattern (circles and corner ticks), in the text colour. Decorative. */
export function AdirePattern({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="20" cy="20" r="3" fill="currentColor" />
          <path
            d="M0 0L9 9M40 0L31 9M0 40L9 31M40 40L31 31"
            stroke="currentColor"
            strokeWidth="2"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
