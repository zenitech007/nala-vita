"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Validation schemas ───────────────────────────────────

const baseSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(["PATIENT", "DOCTOR"]),
  // Patient fields
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  // Doctor fields
  licenseNumber: z.string().optional(),
  specialization: z.string().optional(),
  yearsOfExperience: z.coerce.number<number>().optional(),
  consultationFee: z.coerce.number<number>().optional(),
});

const registerSchema = baseSchema
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (d) => d.role !== "PATIENT" || (!!d.dateOfBirth && !!d.gender),
    { message: "Date of birth is required for patients", path: ["dateOfBirth"] }
  )
  .refine(
    (d) => d.role !== "PATIENT" || !!d.gender,
    { message: "Gender is required for patients", path: ["gender"] }
  )
  .refine(
    (d) =>
      d.role !== "DOCTOR" ||
      (!!d.licenseNumber && !!d.specialization &&
        d.yearsOfExperience !== undefined && d.consultationFee !== undefined),
    { message: "License number is required for doctors", path: ["licenseNumber"] }
  );

// Explicit form type — avoids z.coerce inference issues with react-hook-form generics
interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  role: "PATIENT" | "DOCTOR";
  // Patient-specific
  dateOfBirth?: string;
  gender?: string;
  // Doctor-specific
  licenseNumber?: string;
  specialization?: string;
  yearsOfExperience?: number;
  consultationFee?: number;
}

// ─── Field wrapper ────────────────────────────────────────

function Field({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{" "}
        {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition";

// ─── Page ─────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "PATIENT" },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: RegisterForm) => {
    setServerError("");
    setSuccessMessage("");

    const payload =
      data.role === "PATIENT"
        ? {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            password: data.password,
            role: data.role,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
          }
        : {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            password: data.password,
            role: data.role,
            licenseNumber: data.licenseNumber,
            specialization: data.specialization,
            yearsOfExperience: Number(data.yearsOfExperience),
            consultationFee: Number(data.consultationFee),
          };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || "Registration failed");
        return;
      }

      setSuccessMessage(result.message || "Account created successfully! Redirecting to login...");
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-tint)] via-white to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--primary)] rounded-2xl mb-4">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Nala Vita</h1>
          <p className="text-gray-500 mt-1">Create your account</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              {successMessage}
            </div>
          )}

          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Role Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                {(["PATIENT", "DOCTOR"] as const).map((role) => (
                  <label
                    key={role}
                    className={cn(
                      "flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all",
                      selectedRole === role
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    )}
                  >
                    <input
                      type="radio"
                      value={role}
                      {...register("role")}
                      className="sr-only"
                    />
                    <span className="font-medium">
                      {role === "PATIENT" ? "Patient" : "Doctor"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" error={errors.firstName?.message}>
                <input
                  {...register("firstName")}
                  className={inputCls}
                  placeholder="John"
                />
              </Field>
              <Field label="Last Name" error={errors.lastName?.message}>
                <input
                  {...register("lastName")}
                  className={inputCls}
                  placeholder="Doe"
                />
              </Field>
            </div>

            {/* Email */}
            <Field label="Email" error={errors.email?.message}>
              <input type="email" {...register("email")} className={inputCls} placeholder="john@example.com" />
            </Field>

            {/* Phone */}
            <Field label="Phone" optional>
              <input type="tel" {...register("phone")} className={inputCls} placeholder="+1 (555) 000-0000" />
            </Field>

            {/* ── Patient-specific fields ── */}
            {selectedRole === "PATIENT" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date of Birth" error={errors.dateOfBirth?.message}>
                    <input type="date" {...register("dateOfBirth")} className={inputCls} />
                  </Field>
                  <Field label="Gender" error={errors.gender?.message}>
                    <select {...register("gender")} className={inputCls}>
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </Field>
                </div>
              </>
            )}

            {/* ── Doctor-specific fields ── */}
            {selectedRole === "DOCTOR" && (
              <>
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm">
                  ⚠️ Doctor accounts require admin verification before you can see patients.
                </div>
                <Field label="Medical License Number" error={errors.licenseNumber?.message}>
                  <input
                    {...register("licenseNumber")}
                    className={inputCls}
                    placeholder="e.g. MD-12345"
                  />
                </Field>
                <Field label="Specialization" error={errors.specialization?.message}>
                  <input
                    {...register("specialization")}
                    className={inputCls}
                    placeholder="e.g. Cardiology"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Years of Experience" error={errors.yearsOfExperience?.message}>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      {...register("yearsOfExperience")}
                      className={inputCls}
                      placeholder="5"
                    />
                  </Field>
                  <Field label="Consultation Fee (USD)" error={errors.consultationFee?.message}>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      {...register("consultationFee")}
                      className={inputCls}
                      placeholder="150.00"
                    />
                  </Field>
                </div>
              </>
            )}

            {/* Password */}
            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className={cn(inputCls, "pr-10")}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </Field>

            {/* Confirm Password */}
            <Field label="Confirm Password" error={errors.confirmPassword?.message}>
              <input
                type="password"
                {...register("confirmPassword")}
                className={inputCls}
                placeholder="Re-enter your password"
              />
            </Field>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[var(--primary)] hover:opacity-90 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--primary)] hover:opacity-80 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
