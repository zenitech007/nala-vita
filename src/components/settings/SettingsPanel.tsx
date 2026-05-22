"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Type,
  Sun,
  Moon,
  Check,
  Loader2,
  ChevronLeft,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

// ─── Types ───────────────────────────────────────────────

type FontSize = "small" | "medium" | "large";

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Fran\u00e7ais" },
  { code: "yo", name: "Yoruba", nativeName: "Yor\u00f9b\u00e1" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
  { code: "ig", name: "Igbo", nativeName: "Igbo" },
];

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
};

const FONT_SIZE_ROOT: Record<FontSize, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

interface SettingsPanelProps {
  backHref: string;
  backLabel?: string;
}

// ─── Component ──────────────────────────────────────────

export default function SettingsPanel({
  backHref,
  backLabel = "Back",
}: SettingsPanelProps) {
  const t = useTranslations("settings");
  const router = useRouter();

  // ─── State ─────────────────────────────────────────────
  const [currentLocale, setCurrentLocale] = useState("en");
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [highContrast, setHighContrast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ─── Load preferences from localStorage ────────────────
  useEffect(() => {
    // Read locale from cookie
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    if (match) setCurrentLocale(match[1]);

    // Read font size
    const storedFontSize = localStorage.getItem("mediconnect-font-size");
    if (storedFontSize && (storedFontSize === "small" || storedFontSize === "medium" || storedFontSize === "large")) {
      setFontSize(storedFontSize);
    }

    // Read high contrast
    const storedContrast = localStorage.getItem("mediconnect-high-contrast");
    if (storedContrast === "true") {
      setHighContrast(true);
    }
  }, []);

  // ─── Apply font size and contrast to document ──────────
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_ROOT[fontSize];
    localStorage.setItem("mediconnect-font-size", fontSize);
  }, [fontSize]);

  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }
    localStorage.setItem("mediconnect-high-contrast", String(highContrast));
  }, [highContrast]);

  // ─── Language change ───────────────────────────────────
  const changeLocale = useCallback(
    async (locale: string) => {
      setSaving(true);
      try {
        const res = await fetch("/api/settings/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        });

        if (res.ok) {
          setCurrentLocale(locale);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          router.refresh();
        }
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  // ─── Font size options ─────────────────────────────────
  const fontSizeOptions: { key: FontSize; label: string }[] = [
    { key: "small", label: t("fontSmall") },
    { key: "medium", label: t("fontMedium") },
    { key: "large", label: t("fontLarge") },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <a
              href={backHref}
              className="text-gray-400 hover:text-gray-600"
              aria-label={backLabel}
            >
              <ChevronLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
              <p className="text-gray-500 text-sm">{t("preferences")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Success banner */}
        {saved && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
            <Check className="w-4 h-4" />
            {t("savedSuccessfully")}
          </div>
        )}

        {/* ── Color Theme ──────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <Palette className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Color theme</h2>
              <p className="text-sm text-gray-500">Pick the palette that feels best.</p>
            </div>
          </div>
          <ThemeSwitcher />
        </section>

        {/* ── Language Selection ───────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {t("language")}
              </h2>
              <p className="text-sm text-gray-500">{t("selectLanguage")}</p>
            </div>
            {saving && (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500 ml-auto" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLocale(lang.code)}
                disabled={saving}
                aria-label={`Select language: ${lang.name}`}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border-2 transition text-left",
                  currentLocale === lang.code
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {lang.nativeName}
                  </p>
                  <p className="text-xs text-gray-500">{lang.name}</p>
                </div>
                {currentLocale === lang.code && (
                  <Check className="w-5 h-5 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Accessibility ────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <Type className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {t("accessibility")}
              </h2>
            </div>
          </div>

          {/* Font Size */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t("fontSize")}
            </label>
            <div className="flex gap-2">
              {fontSizeOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFontSize(opt.key)}
                  aria-label={`Set font size to ${opt.key}`}
                  aria-pressed={fontSize === opt.key}
                  className={cn(
                    "flex-1 py-3 rounded-xl border-2 text-center font-medium transition",
                    FONT_SIZE_MAP[opt.key],
                    fontSize === opt.key
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Preview:{" "}
              <span className={FONT_SIZE_MAP[fontSize]}>
                The quick brown fox jumps over the lazy dog
              </span>
            </p>
          </div>

          {/* High Contrast */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              {highContrast ? (
                <Moon className="w-5 h-5 text-gray-700" />
              ) : (
                <Sun className="w-5 h-5 text-gray-500" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {t("highContrast")}
                </p>
                <p className="text-xs text-gray-500">
                  {t("highContrastDescription")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setHighContrast(!highContrast)}
              role="switch"
              aria-checked={highContrast}
              aria-label="Toggle high contrast mode"
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
              style={{
                backgroundColor: highContrast ? "#7C3AED" : "#D1D5DB",
              }}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  highContrast ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
