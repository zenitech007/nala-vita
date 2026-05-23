"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Stethoscope,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Clock,
  X,
  Plus,
  Calendar,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COMMON_SYMPTOMS = [
  "Headache",
  "Fever",
  "Cough",
  "Sore Throat",
  "Fatigue",
  "Nausea",
  "Dizziness",
  "Chest Pain",
  "Shortness of Breath",
  "Back Pain",
  "Joint Pain",
  "Abdominal Pain",
  "Runny Nose",
  "Muscle Aches",
  "Diarrhea",
  "Vomiting",
  "Rash",
  "Insomnia",
  "Anxiety",
  "Swelling",
];

const EXISTING_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Asthma",
  "Heart Disease",
  "Thyroid Disorder",
  "Arthritis",
  "Depression",
  "Allergies",
  "GERD",
  "Migraine",
];

const DURATION_OPTIONS = [
  "Less than 24 hours",
  "1-3 days",
  "4-7 days",
  "1-2 weeks",
  "2-4 weeks",
  "More than a month",
];

interface SymptomResult {
  urgency: "Low" | "Medium" | "High" | "Emergency";
  possibleConditions: {
    name: string;
    probability: string;
    description: string;
  }[];
  recommendation: string;
  seekCareIn: string;
  selfCareAdvice: string[];
  disclaimer: string;
}

export default function SymptomCheckerPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 state
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 state
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState(5);
  const [conditions, setConditions] = useState<string[]>([]);

  // Step 3 state
  const [result, setResult] = useState<SymptomResult | null>(null);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const addCustomSymptom = () => {
    const trimmed = customSymptom.trim();
    if (trimmed && !selectedSymptoms.includes(trimmed)) {
      setSelectedSymptoms((prev) => [...prev, trimmed]);
      setCustomSymptom("");
    }
  };

  const toggleCondition = (condition: string) => {
    setConditions((prev) =>
      prev.includes(condition)
        ? prev.filter((c) => c !== condition)
        : [...prev, condition]
    );
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/symptom-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          description,
          duration,
          severity,
          existingConditions: conditions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to analyze symptoms");
        return;
      }

      setResult(data);
      setStep(3);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const urgencyConfig = {
    Low: {
      color: "bg-green-100 text-green-800 border-green-200",
      icon: CheckCircle,
      iconColor: "text-green-600",
      bgColor: "bg-green-50",
    },
    Medium: {
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      icon: Clock,
      iconColor: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    High: {
      color: "bg-orange-100 text-orange-800 border-orange-200",
      icon: AlertTriangle,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    Emergency: {
      color: "bg-red-100 text-red-800 border-red-200",
      icon: ShieldAlert,
      iconColor: "text-red-600",
      bgColor: "bg-red-50",
    },
  };

  const severityLabel = (val: number) => {
    if (val <= 3) return "Mild";
    if (val <= 6) return "Moderate";
    if (val <= 8) return "Severe";
    return "Very Severe";
  };

  const severityColor = (val: number) => {
    if (val <= 3) return "text-green-600";
    if (val <= 6) return "text-yellow-600";
    if (val <= 8) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <Link
            href="/patient/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                AI Symptom Checker
              </h1>
              <p className="text-gray-500 text-sm">
                Describe your symptoms for a preliminary assessment
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition",
                  step >= s
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "w-12 h-1 rounded-full transition",
                    step > s ? "bg-emerald-600" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* ── Step 1: Symptoms ── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              What symptoms are you experiencing?
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Select all that apply or add your own
            </p>

            {/* Selected chips */}
            {selectedSymptoms.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedSymptoms.map((symptom) => (
                  <span
                    key={symptom}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium"
                  >
                    {symptom}
                    <button
                      onClick={() => toggleSymptom(symptom)}
                      className="hover:text-emerald-900"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Common symptoms grid */}
            <div className="flex flex-wrap gap-2 mb-6">
              {COMMON_SYMPTOMS.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => toggleSymptom(symptom)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-sm font-medium border transition",
                    selectedSymptoms.includes(symptom)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-600"
                  )}
                >
                  {symptom}
                </button>
              ))}
            </div>

            {/* Custom symptom input */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomSymptom()}
                placeholder="Add another symptom..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
              />
              <button
                onClick={addCustomSymptom}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Free text description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Describe your symptoms in detail{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition resize-none"
                placeholder="e.g., The headache started this morning and is worse when I stand up..."
              />
            </div>

            {/* Next */}
            <div className="flex justify-end mt-8">
              <button
                onClick={() => setStep(2)}
                disabled={selectedSymptoms.length === 0}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Duration, Severity, Conditions ── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Tell us more
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Help us understand the severity and context
            </p>

            {/* Duration */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How long have you had these symptoms?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DURATION_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => setDuration(option)}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-medium border transition text-center",
                      duration === option
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Slider */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Severity Level
                </label>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    severityColor(severity)
                  )}
                >
                  {severity}/10 — {severityLabel(severity)}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Mild</span>
                <span>Moderate</span>
                <span>Severe</span>
              </div>
            </div>

            {/* Existing Conditions */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Pre-existing conditions{" "}
                <span className="text-gray-400 font-normal">
                  (select if any)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {EXISTING_CONDITIONS.map((condition) => (
                  <button
                    key={condition}
                    onClick={() => toggleCondition(condition)}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-sm font-medium border transition",
                      conditions.includes(condition)
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
                    )}
                  >
                    {condition}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!duration || isLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Get Assessment
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Results ── */}
        {step === 3 && result && (
          <div className="space-y-6">
            {/* Urgency Banner */}
            {(() => {
              const config = urgencyConfig[result.urgency];
              const Icon = config.icon;
              return (
                <div
                  className={cn(
                    "rounded-2xl border p-6",
                    config.bgColor,
                    config.color
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/60 rounded-xl flex items-center justify-center">
                      <Icon className={cn("w-7 h-7", config.iconColor)} />
                    </div>
                    <div>
                      <span
                        className={cn(
                          "inline-block px-3 py-1 rounded-full text-xs font-bold mb-1",
                          config.color
                        )}
                      >
                        {result.urgency} Urgency
                      </span>
                      <p className="text-lg font-semibold">
                        {result.recommendation}
                      </p>
                      <p className="text-sm mt-1 opacity-80">
                        Seek care: {result.seekCareIn}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Possible Conditions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Possible Conditions
              </h3>
              <div className="space-y-4">
                {result.possibleConditions.map((condition, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-200 flex-shrink-0">
                      <Heart className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">
                          {condition.name}
                        </p>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            condition.probability === "High"
                              ? "bg-red-100 text-red-700"
                              : condition.probability === "Medium"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          )}
                        >
                          {condition.probability} likelihood
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {condition.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Self-Care Advice */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Self-Care Advice
              </h3>
              <ul className="space-y-3">
                {result.selfCareAdvice.map((advice, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{advice}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">{result.disclaimer}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/patient/appointments?action=book"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition"
              >
                <Calendar className="w-5 h-5" />
                Book Appointment Now
              </Link>
              <button
                onClick={() => {
                  setStep(1);
                  setSelectedSymptoms([]);
                  setDescription("");
                  setDuration("");
                  setSeverity(5);
                  setConditions([]);
                  setResult(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition"
              >
                Start New Check
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
