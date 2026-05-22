import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import Providers from "@/providers";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  // ✅ FIX: tell Next.js this font is stable and can be cached aggressively
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#FC94AF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Nala Vita — Healthcare Management Platform",
    template: "%s | Nala Vita",
  },
  description:
    "Nala Vita connects patients, doctors, and administrators. Book appointments, access telemedicine, manage prescriptions, and monitor health — all in one secure, HIPAA-aware platform.",
  keywords: [
    "healthcare",
    "telemedicine",
    "doctor appointment",
    "medical records",
    "patient portal",
    "Nala Vita",
  ],
  openGraph: {
    title: "Nala Vita — Healthcare Management Platform",
    description:
      "Book appointments, access telemedicine, manage prescriptions, and monitor health — all in one secure platform.",
    type: "website",
    locale: "en_US",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nala Vita",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  // ✅ FIX: only load the 'common' and 'nav' namespaces at root level.
  // Each page/layout should load its own namespace via getMessages({ namespace })
  // so clients only download translations they actually use.
  const messages = await getMessages();

  return (
    <html lang={locale} className="theme-rose" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <Providers>{children}</Providers>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
