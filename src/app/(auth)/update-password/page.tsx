import type { Metadata } from "next";
import PasswordRecoveryForm from "@/components/auth/PasswordRecoveryForm";

export const metadata: Metadata = { title: "Update password", robots: { index: false, follow: false } };

export default function UpdatePasswordPage() {
  return <PasswordRecoveryForm mode="update" />;
}
