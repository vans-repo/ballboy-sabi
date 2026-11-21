"use client";

import { useEffect } from "react";

import { type PicksState, setPicksState } from "@/lib/picks-store";

/** Hands the server's view of the fan and their picks to the pick buttons. */
export function PicksHydrator({ viewer, picks }: Omit<PicksState, "ready">) {
  useEffect(() => {
    setPicksState({ ready: true, viewer, picks });
  }, [viewer, picks]);
  return null;
}
