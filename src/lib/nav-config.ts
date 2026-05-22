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
  href: string;
};

export const PATIENT_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",       href: "/patient/dashboard" },
  { icon: Calendar,        label: "Appointments",    href: "/patient/appointments" },
  { icon: Pill,            label: "Medications",     href: "/patient/medications" },
  { icon: Activity,        label: "Vitals",          href: "/patient/vitals" },
  { icon: Stethoscope,     label: "Symptom Checker", href: "/patient/symptom-checker" },
  { icon: FileText,        label: "My Records",      href: "/patient/records" },
  { icon: TestTube,        label: "Lab Results",     href: "/patient/lab-results" },
  { icon: FileText,        label: "Prescriptions",   href: "/patient/prescriptions" },
  { icon: MessageSquare,   label: "Messages",        href: "/patient/chat" },
  { icon: Brain,           label: "Mental Health",   href: "/patient/mental-health" },
  { icon: CreditCard,      label: "Payments",        href: "/patient/payments" },
];

export const DOCTOR_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",          href: "/doctor/dashboard" },
  { icon: Calendar,        label: "Appointments",       href: "/doctor/appointments" },
  { icon: Users,           label: "My Patients",        href: "/doctor/patients" },
  { icon: Video,           label: "Consultations",      href: "/doctor/consultations" },
  { icon: FileText,        label: "Prescriptions",      href: "/doctor/prescriptions" },
  { icon: FlaskConical,    label: "Lab Orders",         href: "/doctor/lab-orders" },
  { icon: Activity,        label: "Patient Monitoring", href: "/doctor/monitoring" },
  { icon: Share2,          label: "Referrals",          href: "/doctor/referrals" },
  { icon: CreditCard,      label: "Billing",            href: "/doctor/billing" },
  { icon: BarChart3,       label: "Analytics",          href: "/doctor/analytics" },
  { icon: Settings,        label: "Settings",           href: "/doctor/settings" },
];

export const ADMIN_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",        href: "/admin/dashboard" },
  { icon: Users,           label: "Staff",            href: "/admin/staff" },
  { icon: Bed,             label: "Beds & Resources", href: "/admin/beds" },
  { icon: FileText,        label: "Reports",          href: "/admin/reports" },
  { icon: Settings,        label: "Settings",         href: "/admin/settings" },
];
