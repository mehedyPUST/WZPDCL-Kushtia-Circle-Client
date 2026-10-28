import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import ThemeInitScript from "@/components/ThemeInitScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WZPDCL Load Calculator | Bottail-Kushtia",
  description:
    "33/11 kV power substation load calculator for WZPDCL Bottail-Kushtia. Calculate feeder MW, history, max load, and statistics.",
  applicationName: "WZPDCL Load Calculator",
  authors: [{ name: "SBA-Bottail, WZPDCL" }],
  openGraph: {
    title: "WZPDCL Load Calculator",
    description:
      "33/11 kV power substation load calculator for WZPDCL Bottail-Kushtia. Calculate feeder MW, history, max load, and statistics.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full min-h-0 flex flex-col bg-app text-app antialiased overflow-hidden selection:bg-[color-mix(in_srgb,var(--app-accent)_35%,transparent)] selection:text-[var(--app-accent-ink)]">
        <ThemeInitScript />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
