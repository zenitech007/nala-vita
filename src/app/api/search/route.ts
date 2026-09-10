import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: session.user.id },
      select: { id: true, role: true },
    });

    if (!user) {
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
    if (user.role === "DOCTOR" || user.role === "ADMIN") {
      const patients = await prisma.patient.findMany({
        where: {
          user: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        take: 6,
      });

      patients.forEach((p) => {
        results.push({
          id: p.id,
          title: `${p.user.firstName} ${p.user.lastName}`,
          subtitle: p.user.email,
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
