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

/**
 * League table zones, counted from the top and bottom of the table.
 * PLACEHOLDERS for the site owner to confirm against the current NPFL rules.
 */
export const TABLE_ZONES = {
  title: 1, // champions
  continental: 3, // places 1..3 (including the champions) go to CAF competitions
  relegation: 4, // bottom four go down
};

/** Contact details for the About page. Empty until the site owner sets them. */
export const CONTACT_EMAIL: string = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "";

/** Where the weekly articles live, and the short-post account. */
export const SUBSTACK_URL = "https://thatnaijaballboy.substack.com";
export const X_HANDLE = "@NaijaBallboy";
export const X_URL = "https://x.com/NaijaBallboy";
