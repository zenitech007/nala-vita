"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Shield, Stethoscope, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setChecking(false);
        return;
      }
      const role = session.user.user_metadata?.role?.toUpperCase();
      if (role === "DOCTOR") router.replace("/doctor/dashboard");
      else if (role === "ADMIN") router.replace("/admin/dashboard");
      else router.replace("/patient/dashboard");
    });
  }, [router]);

  if (checking) {
    return <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Heart className="w-7 h-7 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">MediConnect</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight">
          Healthcare Management
          <br />
          <span className="text-blue-600">Made Simple</span>
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          A complete platform connecting patients, doctors, and administrators.
          Book appointments, manage prescriptions, and access telemedicine — all
          in one place.
        </p>
        <div className="mt-10 flex gap-4 justify-center">
          <Link
            href="/register"
            className="px-8 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-lg shadow-blue-200"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-xl transition border border-gray-200"
          >
            Sign In
          </Link>
        </div>

        {/* Features */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Smart Scheduling</h3>
            <p className="mt-2 text-sm text-gray-600">
              Book appointments with doctors, manage your schedule, and receive
              reminders automatically.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Telemedicine</h3>
            <p className="mt-2 text-sm text-gray-600">
              Video consultations, real-time chat, and AI-powered symptom
              checking from anywhere.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">HIPAA Compliant</h3>
            <p className="mt-2 text-sm text-gray-600">
              End-to-end security with audit logging, role-based access, and
              encrypted data at rest.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
