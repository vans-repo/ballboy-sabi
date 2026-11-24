"use client";

import { useEffect, useId, useRef, useState } from "react";

import { SHARE_SIGNOFF, shareLinks, shareText } from "@/lib/share-post";
import { cn } from "@/lib/utils";

/**
 * "Share…": X, Facebook, WhatsApp, Instagram, Telegram, Threads, copy, and
 * the phone's own share sheet where there is one. Every post carries the
 * sign-off line and the link back to the site (lib/share).
 *
 * Facebook and Instagram don't take text from a link, so the post is copied
 * for the fan to paste. Instagram also needs a picture: the share image is
 * handed to the phone's share sheet, or saved where that isn't possible.
 */
export function ShareMenu({
  message,
  path,
  image,
  imageName = "ballboy-sabi.png",
  label = "Share…",
  className,
  buttonClassName,
}: {
  message: string;
  /** Site path the post links to, e.g. /match/<id>. */
  path: string;
  /** Site path of a PNG for Instagram, e.g. /match/<id>/opengraph-image. */
  image?: string;
  imageName?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  // The phone's own share sheet, where there is one (checked after load).
  const [canShare, setCanShare] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only check after hydration
    setCanShare(!!navigator.share);
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const url = () => new URL(path, window.location.origin).toString();
  const text = () => shareText(message, url());
  const copy = async (done: string) => {
    try {
      await navigator.clipboard.writeText(text());
      setNote(done);
    } catch {
      setNote("Couldn't copy. Long-press the link to copy it instead.");
    }
  };
  // Links are built on click so they use the address the fan is on.
  const go = (to: keyof ReturnType<typeof shareLinks>) => () => {
    window.open(shareLinks(message, url())[to], "_blank", "noopener");
    setOpen(false);
  };

  async function instagram() {
    setOpen(false);
    if (!image) return copy("Post copied. Paste it on Instagram.");
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], imageName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.clipboard.writeText(text()).catch(() => {});
        await navigator.share({ files: [file], text: text() });
        setNote("Choose Instagram. The post is copied too, to paste as the caption.");
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = imageName;
      a.click();
      URL.revokeObjectURL(a.href);
      await copy("Image saved and post copied. Add them to Instagram from your phone.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("Couldn't get the image. Try again.");
    }
  }

  async function more() {
    setOpen(false);
    try {
      await navigator.share({ text: `${message}\n\n${SHARE_SIGNOFF}`, url: url() });
    } catch {
      /* closed by the fan */
    }
  }

  const item =
    "flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  return (
    <div ref={box} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setNote("");
          setOpen((o) => !o);
        }}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-lg bg-muted px-4 text-sm font-semibold hover:bg-muted/70",
          buttonClassName,
        )}
      >
        <ShareIcon /> {label}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Share on"
          className="absolute top-full left-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border bg-surface py-1 shadow-lg"
        >
          <button type="button" role="menuitem" className={item} onClick={go("x")}>
            <Icon d={X} /> X
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              void copy("Post copied. Paste it into your Facebook post.");
              go("facebook")();
            }}
          >
            <Icon d={FACEBOOK} /> Facebook
          </button>
          <button type="button" role="menuitem" className={item} onClick={go("whatsapp")}>
            <Icon d={WHATSAPP} /> WhatsApp
          </button>
          <button type="button" role="menuitem" className={item} onClick={instagram}>
            <Icon d={INSTAGRAM} /> Instagram
          </button>
          <button type="button" role="menuitem" className={item} onClick={go("telegram")}>
            <Icon d={TELEGRAM} /> Telegram
          </button>
          <button type="button" role="menuitem" className={item} onClick={go("threads")}>
            <Icon d={THREADS} /> Threads
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(item, "border-t")}
            onClick={() => {
              setOpen(false);
              void copy("Post and link copied.");
            }}
          >
            <Icon d={LINK} /> Copy post and link
          </button>
          {canShare && (
            <button type="button" role="menuitem" className={item} onClick={more}>
              <ShareIcon /> More apps…
            </button>
          )}
        </div>
      )}
      <p role="status" className="mt-1 text-xs text-muted-foreground empty:hidden">
        {note}
      </p>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true" fill="currentColor">
      <path d={d} />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

const X =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
const FACEBOOK =
  "M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z";
const WHATSAPP =
  "M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.5.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zM12 0a12 12 0 0 0-10.3 18L0 24l6.2-1.6A12 12 0 1 0 12 0z";
const INSTAGRAM =
  "M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z";
const TELEGRAM =
  "M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.6 8.2-1.9 9c-.1.6-.5.8-1.1.5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.3-.4-.1l-6.9 4.3-3-.9c-.6-.2-.7-.6.1-1l11.6-4.5c.6-.2 1 .1.8 1.3z";
const THREADS =
  "M17.7 11.1l-.4-.2c-.2-3.3-2-5.2-5-5.2-1.8 0-3.3.8-4.3 2.2l1.7 1.1c.7-1 1.8-1.3 2.6-1.3 1 0 1.8.3 2.3.9.4.4.6 1 .7 1.7-.9-.2-1.8-.2-2.8-.2-2.8.2-4.6 1.8-4.5 4.1.1 1.2.7 2.2 1.7 2.8.8.5 1.9.8 3 .7 1.5-.1 2.6-.6 3.4-1.6.6-.8 1-1.7 1.2-2.9.7.4 1.2 1 1.5 1.6.5 1.2.5 3.1-1 4.6-1.4 1.4-3 2-5.5 2-2.8 0-4.8-.9-6.2-2.6C4.8 17.5 4.1 15 4.1 12s.7-5.5 2-7.2C7.5 3.1 9.6 2.2 12.4 2.2c2.8 0 4.9.9 6.4 2.6.7.9 1.3 2 1.6 3.2l2-.5c-.4-1.6-1.1-2.9-2-4.1C18.4 1.2 15.8.1 12.4.1 9 .1 6.4 1.2 4.6 3.4 3 5.4 2.1 8.3 2.1 12s.9 6.6 2.5 8.6c1.8 2.2 4.4 3.3 7.8 3.3 3 0 5.1-.8 6.9-2.6 2.3-2.3 2.2-5.2 1.5-6.9-.6-1.3-1.6-2.3-3.1-3.3zm-5.3 5c-1.2.1-2.5-.5-2.6-1.6 0-.9.6-1.8 2.6-2 .2 0 .5 0 .7 0 .7 0 1.4.1 2 .2-.2 2.8-1.6 3.3-2.7 3.4z";
const LINK =
  "M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8.5 18.4a3.5 3.5 0 0 1-5-5l2.8-2.8 1.4 1.4-2.8 2.8a1.5 1.5 0 0 0 2.1 2.1l2.8-2.8 1.4 1.4-2.7 2.9zm9.2-5-1.4-1.4 2.8-2.8a1.5 1.5 0 0 0-2.1-2.1l-2.8 2.8-1.4-1.4 2.8-2.8a3.5 3.5 0 0 1 5 5l-2.9 2.7z";
