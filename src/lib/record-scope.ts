export const RECORD_SCOPES = ["PROFILE", "APPOINTMENTS", "VITALS", "PRESCRIPTIONS", "LAB_TESTS", "NOTES", "REFERRALS"] as const;
export type ClinicalScope = typeof RECORD_SCOPES[number];
export const RECORD_SCOPE_LABELS: Record<ClinicalScope, string> = {
  PROFILE: "Profile and allergies", APPOINTMENTS: "Appointments", VITALS: "Vital readings", PRESCRIPTIONS: "Prescriptions",
  LAB_TESTS: "Lab tests and results", NOTES: "Shared clinical notes", REFERRALS: "Referrals",
};
