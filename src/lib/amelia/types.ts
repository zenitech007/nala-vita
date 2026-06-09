// src/lib/amelia/types.ts
export type Audience = "patient" | "doctor";
export type Urgency = "emergency" | "routine";

export interface RedFlag {
  pattern: string;
  reason: string;
}

export interface AmeliaContext {
  firstName: string;
  age: number | null;
  gender: string | null;
  allergies: string[];
  activeMedications: { medication: string; dosage: string; frequency: string }[];
  recentVitals: {
    recordedAt: string;
    bloodPressure: string | null;
    heartRate: number | null;
    bloodSugar: number | null;
    oxygenSaturation: number | null;
  }[];
  recentLabs: { testName: string; resultValue: string; unit: string | null; isAbnormal: boolean }[];
}

export interface AmeliaTurnInput {
  audience: Audience;
  patientId: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface AmeliaReply {
  content: string;
  urgency: Urgency;
  redFlags: RedFlag[];
  disclaimer: string;
}
