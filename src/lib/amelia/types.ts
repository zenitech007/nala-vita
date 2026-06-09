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

export type MemoryKind = "ALLERGY" | "CONDITION" | "MEDICATION" | "PREFERENCE" | "LIFESTYLE" | "OTHER";

export interface MemoryCandidate {
  kind: MemoryKind;
  value: string;
}

export interface AmeliaMemoryFact {
  id: string;
  kind: MemoryKind;
  value: string;
  confirmedByUser: boolean;
}

export interface GroundingMemories {
  known: AmeliaMemoryFact[];
  toConfirm: AmeliaMemoryFact[];
}

export type ReminderKind = "MEDICATION" | "APPOINTMENT" | "VITALS" | "OTHER";
export type ReminderFrequency = "ONCE" | "DAILY";

export interface ReminderCandidate {
  kind: ReminderKind;
  label: string;
  frequency: ReminderFrequency;
  hour?: number;        // DAILY
  minute?: number;      // DAILY
  isoDateTime?: string; // ONCE
}

export interface ReminderSuggestion {
  kind: ReminderKind;
  label: string;
  frequency: ReminderFrequency;
  nextFireAt: string; // ISO
  schedule: string;   // human-readable
}

export interface ReminderRecord {
  id: string;
  kind: ReminderKind;
  label: string;
  frequency: ReminderFrequency;
  nextFireAt: string; // ISO
  schedule: string;
}
