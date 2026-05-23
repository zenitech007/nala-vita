"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  UserPlus,
  Search,
  MoreVertical,
  Shield,
  Stethoscope,
  X,
  Loader2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "DOCTOR" | "NURSE";
  speciality: string;
  licenceNumber: string;
  department: string;
  isActive: boolean;
  joinedAt: string;
}

const DEPARTMENTS = [
  "General Medicine",
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Oncology",
  "Emergency",
  "Radiology",
  "Dermatology",
  "Psychiatry",
];

const SPECIALITIES = [
  "General Practitioner",
  "Cardiologist",
  "Neurologist",
  "Orthopedic Surgeon",
  "Pediatrician",
  "Oncologist",
  "Emergency Medicine",
  "Radiologist",
  "Dermatologist",
  "Psychiatrist",
  "Nurse Practitioner",
  "Registered Nurse",
  "ICU Nurse",
  "OR Nurse",
];

// ─── Component ──────────────────────────────────────────

export default function AdminStaffPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "DOCTOR" | "NURSE">("ALL");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"DOCTOR" | "NURSE">("DOCTOR");
  const [formSpeciality, setFormSpeciality] = useState("");
  const [formLicence, setFormLicence] = useState("");
  const [formDepartment, setFormDepartment] = useState("");

  // Department assignment modal
  const [deptModalId, setDeptModalId] = useState<string | null>(null);
  const [deptModalValue, setDeptModalValue] = useState("");

  // ─── Placeholder data ──────────────────────────────────

  const [staffList, setStaffList] = useState<StaffMember[]>([
    { id: "s1", name: "Dr. Sarah Chen", email: "sarah.chen@mediconnect.io", role: "DOCTOR", speciality: "Cardiologist", licenceNumber: "MD-2024-1001", department: "Cardiology", isActive: true, joinedAt: "2023-06-15" },
    { id: "s2", name: "Dr. Michael Ross", email: "m.ross@mediconnect.io", role: "DOCTOR", speciality: "Neurologist", licenceNumber: "MD-2024-1002", department: "Neurology", isActive: true, joinedAt: "2023-08-20" },
    { id: "s3", name: "Dr. Emily Taylor", email: "e.taylor@mediconnect.io", role: "DOCTOR", speciality: "Pediatrician", licenceNumber: "MD-2024-1003", department: "Pediatrics", isActive: false, joinedAt: "2023-09-10" },
    { id: "s4", name: "Nurse Rebecca Hall", email: "r.hall@mediconnect.io", role: "NURSE", speciality: "ICU Nurse", licenceNumber: "RN-2024-2001", department: "Emergency", isActive: true, joinedAt: "2024-01-05" },
    { id: "s5", name: "Dr. David Kim", email: "d.kim@mediconnect.io", role: "DOCTOR", speciality: "Orthopedic Surgeon", licenceNumber: "MD-2024-1004", department: "Orthopedics", isActive: true, joinedAt: "2024-02-18" },
    { id: "s6", name: "Nurse Lisa Patel", email: "l.patel@mediconnect.io", role: "NURSE", speciality: "OR Nurse", licenceNumber: "RN-2024-2002", department: "Orthopedics", isActive: true, joinedAt: "2024-03-01" },
    { id: "s7", name: "Dr. James Cooper", email: "j.cooper@mediconnect.io", role: "DOCTOR", speciality: "Oncologist", licenceNumber: "MD-2024-1005", department: "Oncology", isActive: true, joinedAt: "2023-11-22" },
    { id: "s8", name: "Nurse Ana Torres", email: "a.torres@mediconnect.io", role: "NURSE", speciality: "Registered Nurse", licenceNumber: "RN-2024-2003", department: "General Medicine", isActive: false, joinedAt: "2024-01-15" },
  ]);

  // ─── Handlers ──────────────────────────────────────────

  const filtered = staffList.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.speciality.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "ALL" || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  function toggleActive(id: string) {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  }

  function assignDepartment(id: string, dept: string) {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, department: dept } : s))
    );
    setDeptModalId(null);
    setDeptModalValue("");
  }

  function handleAddStaff() {
    if (!formName || !formEmail || !formSpeciality || !formLicence || !formDepartment) return;
    setSaving(true);
    setTimeout(() => {
      const newStaff: StaffMember = {
        id: `s${Date.now()}`,
        name: formRole === "DOCTOR" ? `Dr. ${formName}` : `Nurse ${formName}`,
        email: formEmail,
        role: formRole,
        speciality: formSpeciality,
        licenceNumber: formLicence,
        department: formDepartment,
        isActive: true,
        joinedAt: new Date().toISOString().slice(0, 10),
      };
      setStaffList((prev) => [newStaff, ...prev]);
      setFormName("");
      setFormEmail("");
      setFormRole("DOCTOR");
      setFormSpeciality("");
      setFormLicence("");
      setFormDepartment("");
      setShowAddForm(false);
      setSaving(false);
    }, 600);
  }

  // ─── Stats ─────────────────────────────────────────────

  const totalDoctors = staffList.filter((s) => s.role === "DOCTOR").length;
  const totalNurses = staffList.filter((s) => s.role === "NURSE").length;
  const activeCount = staffList.filter((s) => s.isActive).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/dashboard"
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Staff Management
                </h1>
                <p className="text-gray-500 text-sm">
                  {totalDoctors} doctors &middot; {totalNurses} nurses &middot;{" "}
                  {activeCount} active
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:opacity-90 text-white font-medium rounded-xl transition text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add Staff
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or speciality..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg self-start">
            {(["ALL", "DOCTOR", "NURSE"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={cn(
                  "px-4 py-2 rounded-md text-xs font-medium transition",
                  roleFilter === r
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500"
                )}
              >
                {r === "ALL" ? "All" : r === "DOCTOR" ? "Doctors" : "Nurses"}
              </button>
            ))}
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Staff Member
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Role
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Speciality
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Licence
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Department
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        No staff found matching your criteria
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((staff) => (
                    <tr key={staff.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {staff.name}
                          </p>
                          <p className="text-xs text-gray-500">{staff.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                            staff.role === "DOCTOR"
                              ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                              : "bg-purple-100 text-purple-700"
                          )}
                        >
                          {staff.role === "DOCTOR" ? (
                            <Stethoscope className="w-3 h-3" />
                          ) : (
                            <Shield className="w-3 h-3" />
                          )}
                          {staff.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {staff.speciality}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {staff.licenceNumber}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setDeptModalId(staff.id);
                            setDeptModalValue(staff.department);
                          }}
                          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[var(--primary)] transition"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          {staff.department}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {/* Toggle Switch */}
                        <button
                          onClick={() => toggleActive(staff.id)}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
                          style={{
                            backgroundColor: staff.isActive
                              ? "#3B82F6"
                              : "#D1D5DB",
                          }}
                        >
                          <span
                            className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              staff.isActive
                                ? "translate-x-6"
                                : "translate-x-1"
                            )}
                          />
                        </button>
                        <span
                          className={cn(
                            "ml-2 text-xs font-medium",
                            staff.isActive
                              ? "text-green-600"
                              : "text-gray-400"
                          )}
                        >
                          {staff.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Add Staff Modal ──────────────────────────────── */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Add New Staff Member
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. s.chen@mediconnect.io"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <div className="flex gap-2">
                  {(["DOCTOR", "NURSE"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setFormRole(r)}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-sm font-medium border transition",
                        formRole === r
                          ? "bg-[var(--primary)]/10 border-blue-300 text-[var(--primary)]"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {r === "DOCTOR" ? "Doctor" : "Nurse"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speciality */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Speciality
                </label>
                <select
                  value={formSpeciality}
                  onChange={(e) => setFormSpeciality(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
                >
                  <option value="">Select speciality...</option>
                  {SPECIALITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Licence Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Licence Number
                </label>
                <input
                  type="text"
                  value={formLicence}
                  onChange={(e) => setFormLicence(e.target.value)}
                  placeholder="e.g. MD-2024-1006"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                disabled={
                  saving ||
                  !formName ||
                  !formEmail ||
                  !formSpeciality ||
                  !formLicence ||
                  !formDepartment
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Adding..." : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Department Assignment Modal ──────────────────── */}
      {deptModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                Assign Department
              </h3>
              <button
                onClick={() => setDeptModalId(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <select
              value={deptModalValue}
              onChange={(e) => setDeptModalValue(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white mb-4"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeptModalId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => assignDepartment(deptModalId, deptModalValue)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:opacity-90 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
