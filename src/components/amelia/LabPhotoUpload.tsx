"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { downscaleImage } from "@/lib/downscaleImage";

interface ExtractedLab { name: string; value: string; unit: string | null; referenceRange: string | null; flag: string }
interface LabPhotoResult { results: ExtractedLab[]; summary: string; overallNote: string }

const FLAG_STYLE: Record<string, string> = {
  abnormal: "text-red-600",
  normal: "text-green-600",
  unknown: "text-gray-400",
};

export default function LabPhotoUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [result, setResult] = useState<LabPhotoResult | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("reading");
    try {
      const imageDataUrl = await downscaleImage(file);
      const res = await fetch("/api/ai/lab-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setState("done");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reset = () => {
    setResult(null);
    setState("idle");
  };

  return (
    <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-5">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} aria-label="lab photo" />

      {state === "idle" && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Have a paper lab report?</h2>
            <p className="text-sm text-gray-500">Let Amelia read it and explain the values.</p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-semibold rounded-xl hover:opacity-90 shrink-0"
          >
            <Camera className="w-4 h-4" /> Read a lab report photo
          </button>
        </div>
      )}

      {state === "reading" && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Amelia is reading your report…
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Amelia couldn&apos;t read that image. Try a clearer photo.</p>
          <button onClick={reset} className="text-sm text-[var(--primary)] font-medium">Try again</button>
        </div>
      )}

      {state === "done" && result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">What Amelia read</h2>
            <button onClick={reset} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          {result.results.length > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase">
                    <th className="py-1 pr-3">Test</th>
                    <th className="py-1 pr-3">Value</th>
                    <th className="py-1 pr-3">Ref</th>
                    <th className="py-1">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-1 pr-3 text-gray-800">{r.name}</td>
                      <td className="py-1 pr-3 text-gray-800">{r.value}{r.unit ? ` ${r.unit}` : ""}</td>
                      <td className="py-1 pr-3 text-gray-500">{r.referenceRange ?? "—"}</td>
                      <td className={`py-1 capitalize font-medium ${FLAG_STYLE[r.flag] ?? "text-gray-400"}`}>{r.flag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm text-gray-700">{result.summary}</p>
          {result.overallNote && <p className="text-xs text-gray-400 mt-2">{result.overallNote}</p>}
          <button onClick={reset} className="mt-3 text-sm text-[var(--primary)] font-medium">Read another</button>
        </div>
      )}
    </section>
  );
}
