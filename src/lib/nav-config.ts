import {
  LayoutDashboard,
  Calendar,
  Pill,
  Activity,
  Stethoscope,
  FileText,
  TestTube,
  MessageSquare,
  Brain,
  CreditCard,
  Settings,
  Users,
  Video,
  FlaskConical,
  Share2,
  BarChart3,
  Bed,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  icon: LucideIcon;
  label: string;
  messageKey?: string;
  href: string;
};

export const PATIENT_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", messageKey: "dashboard",       href: "/patient/dashboard" },
  { icon: Calendar,        label: "Appointments", messageKey: "appointments",    href: "/patient/appointments" },
  { icon: Pill,            label: "Medications", messageKey: "medications",     href: "/patient/medications" },
  { icon: Activity,        label: "Vitals", messageKey: "vitals",          href: "/patient/vitals" },
  { icon: Stethoscope,     label: "Symptom Checker", messageKey: "symptomChecker", href: "/patient/symptom-checker" },
  { icon: FileText,        label: "My Records", messageKey: "records",      href: "/patient/records" },
  { icon: TestTube,        label: "Lab Results", messageKey: "labResults",     href: "/patient/lab-results" },
  { icon: FileText,        label: "Prescriptions", messageKey: "prescriptions",   href: "/patient/prescriptions" },
  { icon: MessageSquare,   label: "Messages", messageKey: "messages",        href: "/patient/chat" },
  { icon: Brain,           label: "Mental Health", messageKey: "mentalHealth",   href: "/patient/mental-health" },
  { icon: CreditCard,      label: "Payments", messageKey: "payments",        href: "/patient/payments" },
];

export const DOCTOR_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", messageKey: "dashboard",          href: "/doctor/dashboard" },
  { icon: Calendar,        label: "Appointments", messageKey: "appointments",       href: "/doctor/appointments" },
  { icon: Users,           label: "My Patients", messageKey: "patients",        href: "/doctor/patients" },
  { icon: Video,           label: "Consultations", messageKey: "consultations",      href: "/doctor/consultations" },
  { icon: FileText,        label: "Prescriptions", messageKey: "prescriptions",      href: "/doctor/prescriptions" },
  { icon: FlaskConical,    label: "Lab Orders", messageKey: "labOrders",         href: "/doctor/lab-orders" },
  { icon: Activity,        label: "Patient Monitoring", messageKey: "monitoring", href: "/doctor/monitoring" },
  { icon: Share2,          label: "Referrals", messageKey: "referrals",          href: "/doctor/referrals" },
  { icon: CreditCard,      label: "Billing", messageKey: "billing",            href: "/doctor/billing" },
  { icon: BarChart3,       label: "Analytics", messageKey: "analytics",          href: "/doctor/analytics" },
  { icon: Settings,        label: "Settings", messageKey: "settings",           href: "/doctor/settings" },
];

export const ADMIN_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", messageKey: "dashboard",        href: "/admin/dashboard" },
  { icon: Users,           label: "Staff", messageKey: "staff",            href: "/admin/staff" },
  { icon: Users,           label: "Doctor verification", messageKey: "doctorVerification", href: "/admin/doctors" },
  { icon: Bed,             label: "Beds & Resources", messageKey: "beds", href: "/admin/beds" },
  { icon: FileText,        label: "Reports", messageKey: "reports",          href: "/admin/reports" },
  { icon: Settings,        label: "Settings", messageKey: "settings",         href: "/admin/settings" },
];
