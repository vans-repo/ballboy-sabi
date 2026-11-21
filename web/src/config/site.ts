/**
 * Site-wide configuration.
 *
 * SITE_NAME is the one value to change to rebrand the site, for example to
 * "Ballboy Predicts". Set NEXT_PUBLIC_SITE_NAME in the environment, or edit
 * the default below.
 */
export const SITE_NAME: string = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Ballboy Sabi";

export const BRAND = "That Naija Ballboy";

/** All times are stored in UTC and shown in West Africa Time. */
export const DISPLAY_TIME_ZONE = "Africa/Lagos";

/** Shown in the footer and on the About page. */
export const FREE_TO_PLAY_LINE = "Free to play. No money involved, ever.";
