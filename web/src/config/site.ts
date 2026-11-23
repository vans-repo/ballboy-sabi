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
 * League table zones (confirmed by the site owner). Counted from the top and
 * bottom of the table. The champions (1st) also go to the CAF Champions
 * League with the runners-up; 3rd goes to the CAF Confederation Cup. The
 * second Confederation Cup place goes to the President Federation Cup
 * winners, which the league table doesn't show.
 */
export const TABLE_ZONES = {
  title: 1, // champions (and CAF Champions League)
  championsLeague: 2, // places 1-2: CAF Champions League
  confederationCup: 3, // place 3: CAF Confederation Cup
  relegation: 4, // bottom four go down
};

/** Contact details for the About page. Empty until the site owner sets them. */
export const CONTACT_EMAIL: string = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "";

/** Where the weekly articles live, and the short-post account. */
export const SUBSTACK_URL = "https://thatnaijaballboy.substack.com";
export const X_HANDLE = "@NaijaBallboy";
export const X_URL = "https://x.com/NaijaBallboy";
