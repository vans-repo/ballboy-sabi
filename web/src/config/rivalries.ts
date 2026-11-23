/**
 * Derbies and rivalries between clubs, by team slug. Sources and notes are
 * in docs/club-research.md; only pairings confirmed by a news report are
 * here. The first entry that contains both clubs names the match, so the
 * specific derbies come before the broad regional one.
 */
export const DERBIES: { name: string; clubs: string[] }[] = [
  { name: "Oriental derby", clubs: ["enyimba", "enugu-rangers"] },
  { name: "Abia derby", clubs: ["abia-warriors", "enyimba"] },
  { name: "Kano derby", clubs: ["kano-pillars", "barau"] },
  { name: "Lagos derby", clubs: ["ikorodu-city", "inter-lagos", "sporting-lagos"] },
  { name: "North-West derby", clubs: ["kano-pillars", "katsina-united"] },
  { name: "Rivalry", clubs: ["kano-pillars", "nasarawa-united"] },
  // Any two South-East clubs.
  {
    name: "Oriental derby",
    clubs: ["enyimba", "enugu-rangers", "abia-warriors", "kun-khalifat", "heartland"],
  },
];
