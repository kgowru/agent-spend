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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AgentSpend, what Claude Code actually costs you",
    template: "%s · AgentSpend",
  },
  description: TAGLINE,
  applicationName: "AgentSpend",
  authors: [{ name: "Kapil Gowru" }],
  keywords: [
    "Claude Code",
    "AI cost tracking",
    "token cost",
    "macOS menu bar",
    "AI energy use",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "AgentSpend",
    title: "AgentSpend, what Claude Code actually costs you",
    description: TAGLINE,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
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
