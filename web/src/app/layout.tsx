import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SideNavFooter, SiteHeader } from "@/components/site-header";
import { BottomTabs, SideNav } from "@/components/site-nav";
import { SITE_NAME } from "@/config/site";
import { publicEnv } from "@/lib/env";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for share images (WhatsApp and X need them).
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description:
    "Data-driven NPFL match predictions with Home, Draw and Away percentages, and Beat the Ballboy, a free prediction game.",
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_NG" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#001F55",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-NG"
      className={`dark ${inter.variable} ${barlowCondensed.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the fan's light/dark choice before the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.replace('dark','light')}}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <a href="#main" className="sr-only focus:not-sr-only focus:p-3">
          Skip to content
        </a>
        <div className="flex flex-1">
          <SideNav footer={<SideNavFooter />} />
          <div className="flex min-w-0 flex-1 flex-col">
            <SiteHeader />
            <div id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-8 md:py-7">
              {children}
            </div>
            <SiteFooter />
          </div>
        </div>
        <BottomTabs />
      </body>
    </html>
  );
}
