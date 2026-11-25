import { X_HANDLE } from "@/config/site";

/**
 * The line every fan post carries, so anyone who sees it can find the game
 * and the Ballboy. Plain English, no betting words.
 */
export const SHARE_SIGNOFF =
  "Beat the Ballboy: the free NPFL predictions game by That Naija Ballboy (@NaijaBallboy). No money involved, ever. #NPFL";

/** On X the "via @NaijaBallboy" credit is added by X, so the handle isn't repeated. */
const X_SIGNOFF = "Beat the Ballboy, the free NPFL predictions game. No money involved, ever.";

/** The full post for apps that take text: message, sign-off, link. */
export function shareText(message: string, url: string): string {
  return `${message}\n\n${SHARE_SIGNOFF}\n${url}`;
}

/** Share links for the apps that accept text and a link in the address. */
export function shareLinks(message: string, url: string) {
  const full = shareText(message, url);
  return {
    x: `https://x.com/intent/post?${new URLSearchParams({
      text: `${message} ${X_SIGNOFF}`,
      url,
      via: X_HANDLE.replace(/^@/, ""),
      hashtags: "NPFL",
    })}`,
    // Facebook takes only the link; the text is copied for the fan to paste.
    facebook: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
    whatsapp: `https://wa.me/?${new URLSearchParams({ text: full })}`,
    telegram: `https://t.me/share/url?${new URLSearchParams({ url, text: `${message}\n\n${SHARE_SIGNOFF}` })}`,
    threads: `https://www.threads.net/intent/post?${new URLSearchParams({ text: full })}`,
  };
}

type ShareMatch = {
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  kickoff: string;
  timeConfirmed: boolean;
};

/**
 * What a fan's post about a match says, before the sign-off. No numbers
 * from the model: it invites people to play.
 */
export function matchShareMessage(
  m: ShareMatch,
  home: string,
  away: string,
  o: { played: boolean; upcoming: boolean; locked: boolean; when: string; oneToWatch?: boolean },
): string {
  const teams = `${home} v ${away}`;
  if (o.played) return `Full time: ${home} ${m.homeGoals}–${m.awayGoals} ${away}.`;
  if (m.status === "postponed") return `${teams} has been postponed.`;
  if (m.status === "abandoned") return `${teams} was abandoned.`;
  if (o.locked) return `${teams} is under way.`;
  if (o.upcoming)
    return `${teams}, ${o.when}.${o.oneToWatch ? " One To Watch 🔥" : ""} Who wins? Make your pick and see if you can beat the Ballboy.`;
  return `${teams}.`;
}
