/** Cache tags for public data. Pages tag what they read (Stage 4). */
export const CACHE_TAGS = {
  predictions: "predictions",
  teamRatings: "team-ratings",
  matches: "matches",
} as const;

/** Everything a model run changes. */
export const MODEL_RUN_TAGS = [CACHE_TAGS.predictions, CACHE_TAGS.teamRatings] as const;
