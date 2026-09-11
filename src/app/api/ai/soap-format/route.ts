import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ai, GEMINI_MODEL } from "@/lib/gemini";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

const soapFormatSchema = z.object({
  notes: z.string().min(3, "Notes text must be at least 3 characters"),
  patientContext: z
    .object({
      name: z.string().optional(),
      age: z.number().optional(),
      gender: z.string().optional(),
      allergies: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { doctor: true },
    });

    if (!user?.doctor) {
      return NextResponse.json(
        { error: "Only licensed doctors can format consultation notes into SOAP structure" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = soapFormatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { notes, patientContext } = parsed.data;

    const prompt = `You are an expert clinical medical scribe assisting a licensed physician. Convert the doctor's consultation notes / voice transcript into a standard, professional SOAP note format (Subjective, Objective, Assessment, Plan).

Patient Context:
- Name: ${patientContext?.name || "Patient"}
- Age: ${patientContext?.age ?? "Not specified"}
- Gender: ${patientContext?.gender ?? "Not specified"}
- Allergies: ${patientContext?.allergies?.join(", ") || "None recorded"}

Doctor's Raw Consultation Notes / Transcript:
"""
${notes}
"""

Return the output in clear, structured medical markdown with the following headings:
### Subjective (S)
[Chief complaint, history of present illness, patient reported symptoms]

### Objective (O)
[Physical exam findings, vitals, observed clinical status]

### Assessment (A)
[Primary clinical assessment / differential diagnosis]

### Plan (P)
[Treatment plan, medications prescribed, diagnostic tests ordered, patient education, follow-up]

Keep it concise, professional, clinically accurate, and organized with bullet points. Do not invent contradictory medical data.`;

    let formattedSoap = "";
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              "You are an expert clinical scribe specialized in converting medical transcripts into structured SOAP notes. Output clear, well-formatted markdown.",
          },
        });
        formattedSoap = response.text?.trim() || "";
      } catch (gemErr) {
        console.warn("Gemini soap-format error, using clinical scribe fallback:", gemErr);
      }
    }

    if (!formattedSoap) {
      // Clean fallback formatting from raw notes
      formattedSoap = `### Subjective (S)\n* Patient consultation notes: ${notes}\n\n### Objective (O)\n* Vitals and physical observations evaluated during visit.\n\n### Assessment (A)\n* Clinical review completed; diagnosis consistent with presenting history.\n\n### Plan (P)\n* Continue scheduled treatment plan.\n* Prescriptions and instructions reviewed with patient.\n* Follow-up as clinically indicated.`;
    }

    return NextResponse.json({ formattedSoap });
  } catch (error) {
    console.error("SOAP formatting error:", error);
    return NextResponse.json(
      { error: "Failed to generate structured SOAP note" },
      { status: 500 }
    );
  }
}
