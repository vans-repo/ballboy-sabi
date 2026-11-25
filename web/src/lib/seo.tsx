import { BRAND, INSTAGRAM_URL, SITE_NAME, SUBSTACK_URL, X_URL } from "@/config/site";
import { publicEnv } from "@/lib/env";

/**
 * Structured data (schema.org JSON-LD) for search engines and AI answer
 * engines. Facts only: nothing here that the page doesn't also show.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // `<` escaped so text in the data can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export const LEAGUE = {
  "@type": "SportsOrganization",
  name: "Nigeria Premier Football League",
  alternateName: "NPFL",
  sport: "Soccer",
};

/** The site and the brand behind it, on every page. */
export function siteJsonLd() {
  const url = publicEnv.siteUrl;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: SITE_NAME,
        description:
          "NPFL match predictions with Home, Draw and Away percentages, fixtures, results, the league table, and Beat the Ballboy, a free prediction game.",
        inLanguage: "en-NG",
        publisher: { "@id": `${url}/#org` },
      },
      {
        "@type": "Organization",
        "@id": `${url}/#org`,
        name: BRAND,
        url,
        logo: `${url}/icon.svg`,
        sameAs: [X_URL, INSTAGRAM_URL, SUBSTACK_URL],
      },
    ],
  };
}

/** Absolute URL for a site path, for canonical links and structured data. */
export const abs = (path: string) => `${publicEnv.siteUrl}${path}`;
