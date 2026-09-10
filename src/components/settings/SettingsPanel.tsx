"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Type,
  Sun,
  Moon,
  Check,
  Loader2,
  ChevronLeft,
  Palette,
  User,
  Bell,
  Shield,
  Cpu,
  Save,
  Phone,
  Mail,
  Heart,
  Scale,
  Sparkles,
  Smartphone,
  Volume2,
  Lock,
  FileText,
  AlertCircle,
  Activity,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

// ─── Types ───────────────────────────────────────────────

type SettingsTab = "general" | "profile" | "notifications" | "security" | "system";
type FontSize = "small" | "medium" | "large";
type UnitSystem = "metric" | "imperial";
type GlucoseUnit = "mg/dL" | "mmol/L";

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá" },
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

interface UserProfileData {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  avatarUrl?: string | null;
  patient?: {
    bloodType?: string;
    allergies?: string[];
    emergencyName?: string;
    emergencyPhone?: string;
    address?: string;
    insuranceProvider?: string;
    insuranceNumber?: string;
    gender?: string;
  } | null;
  doctor?: {
    specialization?: string;
    licenseNumber?: string;
    yearsOfExperience?: number;
    consultationFee?: number;
    isVerified?: boolean;
  } | null;
}

interface SettingsPanelProps {
  backHref: string;
  backLabel?: string;
}

// ─── Animated Switch Component ───────────────────────────

function ToggleSwitch({
  enabled,
  onChange,
  label,
  id,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2",
        enabled ? "bg-[var(--primary)]" : "bg-gray-200 dark:bg-gray-700"
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-all",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ─── Main SettingsPanel Component ────────────────────────

export default function SettingsPanel({
  backHref,
  backLabel = "Back",
}: SettingsPanelProps) {
  const t = useTranslations("settings");
  const router = useRouter();

  // ─── Active Tab ─────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  // ─── General & Display State ────────────────────────────
  const [currentLocale, setCurrentLocale] = useState("en");
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [highContrast, setHighContrast] = useState(false);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [glucoseUnit, setGlucoseUnit] = useState<GlucoseUnit>("mg/dL");

  // ─── Profile State ──────────────────────────────────────
  const [profile, setProfile] = useState<UserProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    patient: {
      bloodType: "",
      emergencyName: "",
      emergencyPhone: "",
      address: "",
      insuranceProvider: "",
      insuranceNumber: "",
    },
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // ─── Notification Preferences State ─────────────────────
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyAmelia, setNotifyAmelia] = useState(true);
  const [notifySound, setNotifySound] = useState(true);

  // ─── UI Status States ───────────────────────────────────
  const [savingLocale, setSavingLocale] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const showToast = (message: string) => {
    setSavedBanner(message);
    setTimeout(() => setSavedBanner(null), 3500);
  };

  // ─── Load Local Preferences ─────────────────────────────
  useEffect(() => {
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    if (match) setCurrentLocale(match[1]);

    const storedFontSize = localStorage.getItem("mediconnect-font-size");
    if (storedFontSize === "small" || storedFontSize === "medium" || storedFontSize === "large") {
      setFontSize(storedFontSize);
    }

    const storedContrast = localStorage.getItem("mediconnect-high-contrast");
    if (storedContrast === "true") setHighContrast(true);

    const storedUnits = localStorage.getItem("mediconnect-unit-system");
    if (storedUnits === "imperial" || storedUnits === "metric") {
      setUnitSystem(storedUnits);
    }

    const storedGlucose = localStorage.getItem("mediconnect-glucose-unit");
    if (storedGlucose === "mmol/L" || storedGlucose === "mg/dL") {
      setGlucoseUnit(storedGlucose);
    }

    // Notifications
    const storedEmail = localStorage.getItem("mediconnect-notify-email");
    if (storedEmail !== null) setNotifyEmail(storedEmail === "true");

    const storedSms = localStorage.getItem("mediconnect-notify-sms");
    if (storedSms !== null) setNotifySms(storedSms === "true");

    const storedAmelia = localStorage.getItem("mediconnect-notify-amelia");
    if (storedAmelia !== null) setNotifyAmelia(storedAmelia === "true");

    const storedSound = localStorage.getItem("mediconnect-notify-sound");
    if (storedSound !== null) setNotifySound(storedSound === "true");
  }, []);

  // ─── Apply Font Size and High Contrast ──────────────────
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

  // ─── Persist Unit Preferences ───────────────────────────
  const handleUnitSystemChange = (system: UnitSystem) => {
    setUnitSystem(system);
    localStorage.setItem("mediconnect-unit-system", system);
    showToast("Measurement units updated");
  };

  const handleGlucoseUnitChange = (unit: GlucoseUnit) => {
    setGlucoseUnit(unit);
    localStorage.setItem("mediconnect-glucose-unit", unit);
    showToast("Glucose unit updated");
  };

  // ─── Persist Notification Toggles ───────────────────────
  const handleToggleNotify = (
    key: "email" | "sms" | "amelia" | "sound",
    val: boolean
  ) => {
    if (key === "email") {
      setNotifyEmail(val);
      localStorage.setItem("mediconnect-notify-email", String(val));
    } else if (key === "sms") {
      setNotifySms(val);
      localStorage.setItem("mediconnect-notify-sms", String(val));
    } else if (key === "amelia") {
      setNotifyAmelia(val);
      localStorage.setItem("mediconnect-notify-amelia", String(val));
    } else if (key === "sound") {
      setNotifySound(val);
      localStorage.setItem("mediconnect-notify-sound", String(val));
    }
    showToast("Notification preferences updated");
  };

  // ─── Fetch Profile From Backend ─────────────────────────
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/settings/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, []);

  // ─── Save Profile Handler ───────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        emergencyName: profile.patient?.emergencyName,
        emergencyPhone: profile.patient?.emergencyPhone,
        address: profile.patient?.address,
        bloodType: profile.patient?.bloodType,
        insuranceProvider: profile.patient?.insuranceProvider,
        insuranceNumber: profile.patient?.insuranceNumber,
      };

      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("Profile & health information saved successfully!");
      } else {
        showToast("Failed to save profile. Please try again.");
      }
    } catch {
      showToast("Network error saving profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── Language Change ────────────────────────────────────
  const changeLocale = useCallback(
    async (locale: string) => {
      setSavingLocale(true);
      try {
        const res = await fetch("/api/settings/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        });

        if (res.ok) {
          setCurrentLocale(locale);
          showToast(t("savedSuccessfully"));
          router.refresh();
        }
      } finally {
        setSavingLocale(false);
      }
    },
    [router, t]
  );

  // ─── Tab Navigation List ────────────────────────────────
  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "general", label: "General & Display", icon: Palette },
    { id: "profile", label: "Profile & Medical", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security & Privacy", icon: Shield },
    { id: "system", label: "System & AI Engine", icon: Cpu },
  ];

  const fontSizeOptions: { key: FontSize; label: string }[] = [
    { key: "small", label: t("fontSmall") },
    { key: "medium", label: t("fontMedium") },
    { key: "large", label: t("fontLarge") },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* ── Top Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href={backHref}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label={backLabel}
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.a>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  {t("title")}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Sparkles className="w-3 h-3" />
                    Personalized
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500">
                  Manage your preferences, medical profile, notifications, and system settings.
                </p>
              </div>
            </div>

            {/* AI Status Badge in Header */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Gemini 3.6 Flash Active
            </div>
          </div>

          {/* ── Category Navigation Tabs with Gliding Pill ─── */}
          <nav className="flex space-x-1 sm:space-x-2 mt-5 p-1 bg-gray-100/90 rounded-2xl overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-colors z-10",
                    isSelected ? "text-gray-900 font-semibold" : "text-gray-500 hover:text-gray-800"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isSelected ? "text-[var(--primary)]" : "text-gray-400")} />
                  {tab.label}
                  {isSelected && (
                    <motion.div
                      layoutId="activeSettingsTab"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-gray-200/80 -z-10"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Main Content Container ────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Floating Toast Notification */}
        <AnimatePresence>
          {savedBanner && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-900 text-white shadow-xl border border-gray-700"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium">{savedBanner}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tab Content with Entrance Animations ────────── */}
        <AnimatePresence mode="wait">
          {/* TAB 1: GENERAL & DISPLAY */}
          {activeTab === "general" && (
            <motion.div
              key="general"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Color Theme */}
              <motion.section
                whileHover={{ y: -1 }}
                className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                    <Palette className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Color Theme</h2>
                    <p className="text-sm text-gray-500">Pick the theme palette that feels best for your eye.</p>
                  </div>
                </div>
                <ThemeSwitcher />
              </motion.section>

              {/* Language Selection */}
              <motion.section
                whileHover={{ y: -1 }}
                className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                    <Globe className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{t("language")}</h2>
                    <p className="text-sm text-gray-500">{t("selectLanguage")}</p>
                  </div>
                  {savingLocale && (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)] ml-auto" />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {LANGUAGES.map((lang) => {
                    const isSelected = currentLocale === lang.code;
                    return (
                      <motion.button
                        key={lang.code}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => changeLocale(lang.code)}
                        disabled={savingLocale}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left",
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-xs"
                            : "border-gray-100 hover:border-gray-300 hover:bg-gray-50/70"
                        )}
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{lang.nativeName}</p>
                          <p className="text-xs text-gray-500">{lang.name}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>

              {/* Accessibility & Typography */}
              <motion.section
                whileHover={{ y: -1 }}
                className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                    <Type className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{t("accessibility")}</h2>
                    <p className="text-sm text-gray-500">Adjust readability and visual contrast settings.</p>
                  </div>
                </div>

                {/* Font Size */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">{t("fontSize")}</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {fontSizeOptions.map((opt) => (
                      <motion.button
                        key={opt.key}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFontSize(opt.key)}
                        className={cn(
                          "py-3 rounded-xl border-2 text-center font-medium transition-all",
                          FONT_SIZE_MAP[opt.key],
                          fontSize === opt.key
                            ? "border-violet-500 bg-violet-50 text-violet-800 font-semibold shadow-xs"
                            : "border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Live font preview:</p>
                    <p className={cn("text-gray-800 transition-all", FONT_SIZE_MAP[fontSize])}>
                      Nala Vita provides accessible telemedicine and clinical guidance for everyone.
                    </p>
                  </div>
                </div>

                {/* High Contrast */}
                <div className="flex items-center justify-between p-4 bg-gray-50/80 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-200/80 flex items-center justify-center">
                      {highContrast ? <Moon className="w-4 h-4 text-violet-700" /> : <Sun className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t("highContrast")}</p>
                      <p className="text-xs text-gray-500">{t("highContrastDescription")}</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    enabled={highContrast}
                    onChange={setHighContrast}
                    label="Toggle high contrast mode"
                    id="high-contrast-toggle"
                  />
                </div>
              </motion.section>

              {/* Medical Measurement Units */}
              <motion.section
                whileHover={{ y: -1 }}
                className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                    <Scale className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Clinical Units</h2>
                    <p className="text-sm text-gray-500">Choose standard measurement units for vitals and lab data.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Weight & Height System
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleUnitSystemChange("metric")}
                        className={cn(
                          "py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition text-center",
                          unitSystem === "metric"
                            ? "border-sky-500 bg-sky-50 text-sky-800 font-semibold"
                            : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        Metric (kg, cm, °C)
                      </button>
                      <button
                        onClick={() => handleUnitSystemChange("imperial")}
                        className={cn(
                          "py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition text-center",
                          unitSystem === "imperial"
                            ? "border-sky-500 bg-sky-50 text-sky-800 font-semibold"
                            : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        Imperial (lbs, in, °F)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Blood Glucose Units
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleGlucoseUnitChange("mg/dL")}
                        className={cn(
                          "py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition text-center",
                          glucoseUnit === "mg/dL"
                            ? "border-sky-500 bg-sky-50 text-sky-800 font-semibold"
                            : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        mg/dL (Standard)
                      </button>
                      <button
                        onClick={() => handleGlucoseUnitChange("mmol/L")}
                        className={cn(
                          "py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition text-center",
                          glucoseUnit === "mmol/L"
                            ? "border-sky-500 bg-sky-50 text-sky-800 font-semibold"
                            : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        mmol/L (Molar)
                      </button>
                    </div>
                  </div>
                </div>
              </motion.section>
            </motion.div>
          )}

          {/* TAB 2: PROFILE & MEDICAL DETAILS */}
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Account Card */}
                <section className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-emerald-400 text-white flex items-center justify-center text-2xl font-bold shadow-md">
                      {profile.firstName ? profile.firstName[0] : "U"}
                      {profile.lastName ? profile.lastName[0] : ""}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {profile.firstName || profile.lastName
                          ? `${profile.firstName} ${profile.lastName}`
                          : "Your Healthcare Profile"}
                      </h2>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5" />
                        {profile.email || "Loading account details..."}
                      </p>
                      {profile.role && (
                        <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          Role: {profile.role}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">First Name</label>
                      <input
                        type="text"
                        value={profile.firstName ?? ""}
                        onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                        placeholder="First Name"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Last Name</label>
                      <input
                        type="text"
                        value={profile.lastName ?? ""}
                        onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                        placeholder="Last Name"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Phone Number</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                        <input
                          type="tel"
                          value={profile.phone ?? ""}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          placeholder="+234 800 000 0000"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Emergency Contact & Medical Info */}
                <section className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <Heart className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Emergency & Clinical Details</h2>
                      <p className="text-sm text-gray-500">Essential for critical medical care and doctor consultation.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Blood Type</label>
                      <select
                        value={profile.patient?.bloodType ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            patient: { ...profile.patient, bloodType: e.target.value },
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
                      >
                        <option value="">Unknown</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Residential Address</label>
                      <input
                        type="text"
                        value={profile.patient?.address ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            patient: { ...profile.patient, address: e.target.value },
                          })
                        }
                        placeholder="Street, City, State"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={profile.patient?.emergencyName ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            patient: { ...profile.patient, emergencyName: e.target.value },
                          })
                        }
                        placeholder="Spouse / Parent / Next of Kin"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Emergency Contact Phone</label>
                      <input
                        type="tel"
                        value={profile.patient?.emergencyPhone ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            patient: { ...profile.patient, emergencyPhone: e.target.value },
                          })
                        }
                        placeholder="+234 800 123 4567"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>
                  </div>
                </section>

                {/* Insurance Provider */}
                <section className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Health Insurance</h2>
                      <p className="text-sm text-gray-500">Provide coverage information for direct billing claims.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Insurance Provider</label>
                      <input
                        type="text"
                        value={profile.patient?.insuranceProvider ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            patient: { ...profile.patient, insuranceProvider: e.target.value },
                          })
                        }
                        placeholder="e.g. AXA Mansard, Hygeia HMO"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Policy / Member ID</label>
                      <input
                        type="text"
                        value={profile.patient?.insuranceNumber ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            patient: { ...profile.patient, insuranceNumber: e.target.value },
                          })
                        }
                        placeholder="POL-12345678"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>
                  </div>
                </section>

                {/* Submit Action */}
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium shadow-md shadow-[var(--primary)]/25 hover:opacity-95 transition-opacity"
                  >
                    {savingProfile ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savingProfile ? "Saving Profile..." : "Save Profile Changes"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

          {/* TAB 3: NOTIFICATIONS & COMMUNICATION */}
          {activeTab === "notifications" && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <section className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Bell className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Delivery Channels</h2>
                    <p className="text-sm text-gray-500">Configure how and where Nala Vita contacts you.</p>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* Email Notifications */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mt-0.5">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Email Notifications</p>
                        <p className="text-xs text-gray-500">
                          Receive appointment confirmations, lab report summaries, and payment receipts.
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      enabled={notifyEmail}
                      onChange={(v) => handleToggleNotify("email", v)}
                      label="Toggle email notifications"
                    />
                  </div>

                  {/* SMS Alerts */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mt-0.5">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">SMS / Text Reminders</p>
                        <p className="text-xs text-gray-500">
                          Instant text messages 15 minutes before telemedicine calls and for critical health alerts.
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      enabled={notifySms}
                      onChange={(v) => handleToggleNotify("sms", v)}
                      label="Toggle SMS alerts"
                    />
                  </div>

                  {/* Amelia AI Proactive Coach */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Amelia AI Health Coach Check-ins</p>
                        <p className="text-xs text-gray-500">
                          Allow Amelia to suggest personalized medication reminders and follow-up on recorded vitals.
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      enabled={notifyAmelia}
                      onChange={(v) => handleToggleNotify("amelia", v)}
                      label="Toggle Amelia AI check-ins"
                    />
                  </div>

                  {/* In-app Sound Effects */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mt-0.5">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Audio Feedback & Chimes</p>
                        <p className="text-xs text-gray-500">
                          Play soft audio cues when receiving new doctor messages and incoming video consultations.
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      enabled={notifySound}
                      onChange={(v) => handleToggleNotify("sound", v)}
                      label="Toggle sound alerts"
                    />
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {/* TAB 4: SECURITY & PRIVACY */}
          {activeTab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* HIPAA / Security Status */}
              <section className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Data Security & Encryption</h2>
                    <p className="text-sm text-gray-500">HIPAA & GDPR-aligned clinical protection protocols.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">End-to-End In Transit</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        TLS 1.3 encryption across all telehealth video channels and patient records.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">PHI Redaction Engine</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Automatic stripping of Protected Health Information from audit records.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Supabase Row-Level Security</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Strict multi-tenant role isolation ensuring only authorized doctors access records.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Session Guard</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Cryptographically signed JWT tokens with automatic timeout protection.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900">Medical Record Consent</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      By using Nala Vita, you authorize certified healthcare providers on this platform to review
                      your recorded vitals and lab findings for diagnostic and treatment purposes.
                    </p>
                  </div>
                </div>
              </section>

              {/* Password & Session */}
              <section className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Lock className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Authentication & Access</h2>
                    <p className="text-sm text-gray-500">Manage credentials and authentication states.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Account Password</p>
                    <p className="text-xs text-gray-500">Managed securely through Supabase Auth identity.</p>
                  </div>
                  <a
                    href="/forgot-password"
                    className="text-xs font-semibold text-[var(--primary)] hover:underline px-3 py-1.5 rounded-lg bg-[var(--primary)]/10"
                  >
                    Reset Password
                  </a>
                </div>
              </section>
            </motion.div>
          )}

          {/* TAB 5: SYSTEM & AI ENGINE */}
          {activeTab === "system" && (
            <motion.div
              key="system"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* AI Engine Card */}
              <section className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs relative overflow-hidden">
                <div className="absolute right-0 top-0 w-48 h-48 bg-emerald-100/50 rounded-full blur-3xl -z-0 pointer-events-none" />

                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900">Google Gemini 3.6 Flash</h2>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800">
                          Next-Gen
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Powering Amelia AI, Medical Triage, & Decision Support</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Operational
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">Architecture</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">Interactions API</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Server-managed state</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">Model Identifier</p>
                    <p className="text-sm font-mono font-semibold text-gray-900 mt-0.5">gemini-3.6-flash</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Multimodal native</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">Inference Latency</p>
                    <p className="text-sm font-semibold text-emerald-600 mt-0.5">~180ms</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Ultra-fast stream</p>
                  </div>
                </div>
              </section>

              {/* Infrastructure & Database */}
              <section className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Platform Infrastructure</h2>
                    <p className="text-sm text-gray-500">System health and connection topology.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">PostgreSQL (Prisma 7)</p>
                        <p className="text-xs text-gray-500">Connection pool active</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Healthy
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Supabase Storage & Realtime</p>
                        <p className="text-xs text-gray-500">Websockets connected</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Connected
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Paystack Gateway</p>
                        <p className="text-xs text-gray-500">Webhooks ready</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Operational
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">App Version</p>
                        <p className="text-xs text-gray-500">Nala Vita MediConnect</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      v0.1.0-prod
                    </span>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
