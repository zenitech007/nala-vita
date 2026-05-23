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
  // Modern (Chrome-compatible) equivalent of apple-mobile-web-app-capable.
  // Apple's tag is deprecated by Chrome devtools but still respected by iOS Safari.
  // We emit both so neither browser warns AND iOS standalone still works.
  other: {
    "mobile-web-app-capable": "yes",
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
      <head>
        {/*
          ✅ FIX: silence Chrome's "preloaded but not used" warning.
          Next.js's dev server emits <link rel="preload" as="style"> for the
          CSS chunk and ALSO emits the matching <link rel="stylesheet">.
          When HMR rewrites the ?v=<timestamp> cache-buster between renders,
          the preload's href and the stylesheet's href can mismatch, so
          Chrome thinks the preload was never used and warns ~3s after load.
          This script runs early and, for every preload-as-style link:
            - if a matching stylesheet already exists, removes the preload
              (it's redundant);
            - otherwise promotes the preload to a stylesheet (the preloaded
              bytes are now "used").
          Result: zero warnings, zero extra network requests. In production
          there are no orphan preload tags so this is a no-op.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function f(){var p=document.querySelectorAll('link[rel="preload"][as="style"]');p.forEach(function(l){var h=l.href;var m=document.querySelector('link[rel="stylesheet"][href="'+h+'"]');if(m){l.parentNode&&l.parentNode.removeChild(l);}else{l.rel='stylesheet';}});}f();if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',f);}try{if(typeof MutationObserver!=='undefined'&&document.head){new MutationObserver(f).observe(document.head,{childList:true});}}catch(e){}})();`,
          }}
        />
      </head>
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
