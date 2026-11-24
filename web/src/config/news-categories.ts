/**
 * Football news categories. Headlines are sorted into one by keywords (the
 * first category with a match wins, so the more specific ones come first);
 * anything else is "General". Each category has its own small set of
 * generic images in /admin → Images.
 *
 * `brief` is the image idea for that category, for an image generator or a
 * free photo library. Rules for every image: no club crests, kits or
 * colours that identify a club, no real players' faces, no stadium names or
 * sponsor logos, no betting imagery.
 */
export type NewsCategory = {
  key: string;
  label: string;
  /** Lowercase words or phrases, matched as whole words in the headline. */
  words: string[];
  brief: string;
};

export const NEWS_CATEGORIES: NewsCategory[] = [
  {
    key: "discipline",
    label: "Discipline and rulings",
    words: [
      "docked",
      "deducted",
      "deduction",
      "fined",
      "fine",
      "sanction",
      "sanctioned",
      "suspended",
      "suspension",
      "ban",
      "banned",
      "charged",
      "disciplinary",
      "appeal",
      "verdict",
      "ruling",
      "red card",
    ],
    brief:
      "A referee's whistle and a red card on a desk; a gavel beside a football; an empty referee's room with a kit bag.",
  },
  {
    key: "managers",
    label: "Managers",
    words: [
      "head coach",
      "new coach",
      "appoints",
      "appointed",
      "appointment",
      "sacked",
      "sacks",
      "parts ways",
      "technical adviser",
      "interim",
      "resigns",
      "steps down",
    ],
    brief:
      "An empty dugout at dusk; a tactics board with magnets; a coach's silhouette on the touchline, face not visible.",
  },
  {
    key: "transfers",
    label: "Transfers",
    words: [
      "signs",
      "signing",
      "signed",
      "transfer",
      "joins",
      "loan",
      "contract",
      "unveils",
      "unveiled",
      "release",
      "released",
      "deal",
    ],
    brief:
      "A pen on a contract next to a football; a new jersey on a hanger with no badge; a handshake in close-up.",
  },
  {
    key: "injuries",
    label: "Injuries and team news",
    words: [
      "injury",
      "injured",
      "ruled out",
      "sidelined",
      "fitness",
      "return",
      "returns",
      "recovered",
      "squad",
      "line-up",
      "lineup",
    ],
    brief:
      "Physio bench with strapping tape; ice pack on a boot; boots lined up on a dressing-room floor.",
  },
  {
    key: "preview",
    label: "Previews",
    words: [
      "preview",
      "face",
      "host",
      "hosts",
      "visit",
      "visits",
      "clash",
      "showdown",
      "battle",
      "set for",
      "ahead of",
      "derby",
      "travel",
    ],
    brief:
      "Floodlights coming on over an empty pitch; a ball on the centre spot; corner flag in evening light.",
  },
  {
    key: "results",
    label: "Results",
    words: [
      "beat",
      "beats",
      "win",
      "wins",
      "won",
      "draw",
      "draws",
      "drew",
      "lose",
      "loses",
      "lost",
      "thrash",
      "thrashes",
      "edge",
      "edges",
      "stun",
      "stuns",
      "hold",
      "holds",
      "victory",
      "defeat",
      "comeback",
      "rout",
    ],
    brief:
      "Ball hitting the back of the net; a scoreboard with blank team names; celebrating crowd silhouettes (no faces).",
  },
  {
    key: "table",
    label: "Table and title race",
    words: [
      "table",
      "standings",
      "top spot",
      "summit",
      "title race",
      "relegation",
      "log",
      "zone",
      "points clear",
      "leaders",
    ],
    brief:
      "A trophy shape in silhouette; stairs or a ladder graphic in navy and yellow; a pitch seen from above, empty.",
  },
  {
    key: "awards",
    label: "Awards and records",
    words: [
      "award",
      "awards",
      "player of the month",
      "coach of the month",
      "record",
      "milestone",
      "honour",
      "honoured",
      "best",
    ],
    brief:
      "A trophy or medal on a plinth with no engraving; a spotlight on a podium; confetti in navy and yellow.",
  },
  {
    key: "continental",
    label: "Continental and cup",
    words: [
      "caf",
      "champions league",
      "confederation cup",
      "federation cup",
      "president federation cup",
      "aiteo cup",
      "cup",
    ],
    brief:
      "A generic cup on a plinth; a map of Africa in lines; a stadium tunnel looking out to light.",
  },
  {
    key: "super-eagles",
    label: "Super Eagles call-ups",
    words: [
      "super eagles",
      "invitation",
      "invited",
      "call-up",
      "called up",
      "chan",
      "home-based",
      "national team",
    ],
    brief:
      "Green and white ribbons; an eagle silhouette (not the federation's crest); a training cone line on grass.",
  },
  {
    key: "business",
    label: "Club business",
    words: [
      "sponsor",
      "sponsorship",
      "salary",
      "salaries",
      "wages",
      "unpaid",
      "owner",
      "ownership",
      "budget",
      "funding",
      "board",
      "chairman",
      "partnership",
      "partner",
    ],
    brief: "A boardroom table; stacked folders and a calculator; a handshake across a desk.",
  },
  {
    key: "fans",
    label: "Fans and stadiums",
    words: [
      "fans",
      "supporters",
      "stadium",
      "venue",
      "pitch",
      "crowd",
      "attendance",
      "violence",
      "invasion",
      "security",
    ],
    brief:
      "Empty stand seats in navy and yellow; a turnstile; floodlights over terraces, no people's faces.",
  },
];

/** Used when a headline matches nothing above. */
export const GENERAL_CATEGORY: NewsCategory = {
  key: "general",
  label: "General",
  words: [],
  brief: "A football on grass; pitch markings close up; a goal net against the sky.",
};

export const ALL_CATEGORIES = [...NEWS_CATEGORIES, GENERAL_CATEGORY];
