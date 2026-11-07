import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";

import NavBar from "@/components/navbar";
import Footer from "@/components/footer";
import GoogleAnalytics from "@/components/google-analytics";
import QueryProvider from "@/providers/query-provider";
import { ICON_VERSION } from "@/constants/assets";

import { ThemeProvider } from "@/components/theme-provider";

import { Toaster } from "@/components/ui/sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
// const geistMono = localFont({
//   src: "./fonts/GeistMonoVF.woff",
//   variable: "--font-geist-mono",
//   weight: "100 900",
// });

const APP_NAME = "Animke";
const APP_DEFAULT_TITLE = "Animke | Anime İzle";
const APP_DESCRIPTION = "Favori animelerinizii kolayca ve reklamsız izleyin";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: APP_DEFAULT_TITLE,
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
  },
  manifest: `/manifest.json?v=${ICON_VERSION}`,
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_DEFAULT_TITLE,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: APP_DEFAULT_TITLE,
    description: APP_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="icon" href={`/favicon.ico?v=${ICON_VERSION}`} sizes="any" />
        <link
          rel="icon"
          href={`/favicon-32x32.png?v=${ICON_VERSION}`}
          type="image/png"
          sizes="32x32"
        />
        <link
          rel="icon"
          href={`/favicon-16x16.png?v=${ICON_VERSION}`}
          type="image/png"
          sizes="16x16"
        />
        <link
          rel="icon"
          href={`/icon-192x192.png?v=${ICON_VERSION}`}
          type="image/png"
          sizes="192x192"
        />
        <link
          rel="apple-touch-icon"
          href={`/apple-touch-icon.png?v=${ICON_VERSION}`}
          sizes="180x180"
        />
      </head>
      <body
        className={`${geistSans.className} antialiased max-w-[100vw] overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <GoogleAnalytics />
          <QueryProvider>
            <NavBar />
            {children}
            <Footer />
          </QueryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
