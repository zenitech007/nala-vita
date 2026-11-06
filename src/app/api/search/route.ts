import { requireApiUser } from "@/lib/auth";
import { workspacePatientWhere } from "@/lib/record-visibility";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiUser({ roles: ["DOCTOR", "PATIENT"] });
    if (!auth.ok) return auth.response;
    const user = auth.user;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      category: "patients" | "doctors" | "actions";
      href: string;
    }> = [];

    // If Doctor or Admin, search patients
    if (user.role === "DOCTOR" && user.doctor) {
      const patients = await prisma.patient.findMany({
        where: {
          AND: [workspacePatientWhere(user.doctor!.id)],
          user: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        },
        select: { id: true,
          user: {
            select: { firstName: true, lastName: true },
          },
        },
        take: 6,
      });

      patients.forEach((p) => {
        results.push({
          id: p.id,
          title: `${p.user.firstName} ${p.user.lastName}`,
          subtitle: "Care workspace",
          category: "patients",
          href: `/doctor/patients/${p.id}`,
        });
      });
    }

    // If Patient or Admin, search doctors
    if (user.role === "PATIENT" || user.role === "ADMIN") {
      const doctors = await prisma.doctor.findMany({
        where: {
          OR: [
            { specialization: { contains: q, mode: "insensitive" } },
            {
              user: {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          ],
        },
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
        take: 6,
      });

      doctors.forEach((d) => {
        results.push({
          id: d.id,
          title: `Dr. ${d.user.firstName} ${d.user.lastName}`,
          subtitle: d.specialization,
          category: "doctors",
          href: `/patient/appointments?doctor=${d.id}`,
        });
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
