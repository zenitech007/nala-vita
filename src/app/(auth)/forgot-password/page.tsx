import type { Metadata } from "next";
import PasswordRecoveryForm from "@/components/auth/PasswordRecoveryForm";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return <PasswordRecoveryForm mode="request" expired={query.error === "expired"} />;
}
