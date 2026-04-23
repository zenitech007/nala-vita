import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const SUPPORTED_LOCALES = ["en", "fr", "yo", "ha", "ig"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export default getRequestConfig(async () => {
  // Read preferred locale from cookie; default to English
  const cookieStore = cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? "en";
  const locale: SupportedLocale = isSupported(raw) ? raw : "en";

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
