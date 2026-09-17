import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL, TAGLINE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "AgentSpend, what Claude Code actually costs you";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · AgentSpend",
  },
  description: TAGLINE,
  applicationName: "AgentSpend",
  authors: [{ name: "Kapil Gowru", url: "https://kapilgowru.xyz" }],
  creator: "Kapil Gowru",
  publisher: "Kapil Gowru",
  category: "technology",
  keywords: [
    "Claude Code",
    "AI cost tracking",
    "token cost",
    "macOS menu bar",
    "AI energy use",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "AgentSpend",
    title: TITLE,
    description: TAGLINE,
    url: "/",
    locale: "en_US",
  },
  // The image and its alt text come from opengraph-image.png and
  // opengraph-image.alt.txt. Next fills in the twitter:* image, title and
  // description from the Open Graph block, so only the card type is set here.
  twitter: { card: "summary_large_image" },
  // Names the icon iOS saves to the home screen. `capable: false` keeps it a
  // normal bookmark instead of launching it as a chromeless web app.
  appleWebApp: { title: "AgentSpend", capable: false },
};

// Must be its own export. `themeColor` and `colorScheme` are Viewport fields,
// not Metadata fields.
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#07090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="font-sans min-h-full flex flex-col bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-2 focus:text-sm focus:font-medium focus:text-canvas"
        >
          Skip to content
        </a>
        {children}
        <div
          aria-hidden="true"
          className="noise pointer-events-none fixed inset-0 z-50 opacity-[0.035] mix-blend-soft-light"
        />
        <Analytics />
      </body>
    </html>
  );
}
