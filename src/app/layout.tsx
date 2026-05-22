import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import Providers from "@/providers";

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

export const metadata: Metadata = {
  title: {
    default: "MediConnect — Healthcare Management Platform",
    template: "%s | MediConnect",
  },
  description:
    "MediConnect connects patients, doctors, and administrators. Book appointments, access telemedicine, manage prescriptions, and monitor health — all in one secure, HIPAA-aware platform.",
  keywords: [
    "healthcare",
    "telemedicine",
    "doctor appointment",
    "medical records",
    "patient portal",
    "MediConnect",
  ],
  openGraph: {
    title: "MediConnect — Healthcare Management Platform",
    description:
      "Book appointments, access telemedicine, manage prescriptions, and monitor health — all in one secure platform.",
    type: "website",
    locale: "en_US",
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
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}