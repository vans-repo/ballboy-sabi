import { cn } from "@/lib/utils";

/**
 * A news image in the site's look: greyscale under a navy wash with a thin
 * yellow edge, so pictures from different sources read as one set.
 * Decorative: the headline next to it says what the story is.
 */
export function NewsImageFrame({ src, className }: { src: string; className?: string }) {
  return (
    <span
      className={cn("relative block overflow-hidden bg-[#001F55]", className)}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small public image from Supabase Storage */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover opacity-80 mix-blend-luminosity grayscale"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-[#001F55]/80 via-[#001F55]/20 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 h-1 bg-[#FED700]" />
    </span>
  );
}
