// src/lib/amelia/clinical-engine.ts
/**
 * Offline Clinical Intelligence Engine
 * 
 * Provides an immediate, intelligent, and highly personalized clinical response
 * grounded directly in the authenticated patient's EHR context (medications,
 * vitals, appointments, lab results, allergies).
 * 
 * This ensures Amelia is 100% resilient and never fails or drops the connection,
 * even when external cloud AI services (Google Gemini, OpenAI) return rate limits,
 * 403 access denials, or missing API keys in serverless environments.
 */

import type { AmeliaContext } from "./types";
import type { ChatTurn } from "./llm";

export function generateClinicalResponse(
  messages: ChatTurn[],
  ctx?: AmeliaContext
): string {
  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  const query = (latestUser?.content || "").trim().toLowerCase();
  const name = ctx?.firstName || "there";

  // 1. Greetings / Introduction
  if (
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|who are you|what can you do)/i.test(
      query
    )
  ) {
    let greeting = `Hello ${name}! I'm **Amelia**, your AI medical assistant here at Nala Vita.\n\n`;
    greeting += `I have access to your health record and I'm ready to assist you with:\n\n`;
    greeting += `* **Medication Guidance**: Review dosages, schedules, adherence tracking, and safety instructions.\n`;
    greeting += `* **Health Vitals**: Check your latest blood pressure, pulse, blood glucose, and oxygen readings.\n`;
    greeting += `* **Appointments**: Review scheduled visits with your doctors and preparation tips.\n`;
    greeting += `* **Lab Results**: Understand recent test findings in plain, reassuring language.\n`;
    greeting += `* **Symptom Triage**: Provide initial clinical advice, comfort measures, and red flag warnings.\n\n`;

    if (ctx?.activeMedications && ctx.activeMedications.length > 0) {
      greeting += `You currently have **${ctx.activeMedications.length} active medication(s)** on your profile. `;
    }
    if (ctx?.upcomingAppointments && ctx.upcomingAppointments.length > 0) {
      greeting += `Your next appointment is scheduled for **${ctx.upcomingAppointments[0].date}** with Dr. ${ctx.upcomingAppointments[0].doctorName}. `;
    }

    greeting += `\n\nHow can I help you today?`;
    return greeting;
  }

  // 2. Medications & Prescriptions
  if (
    /medication|prescription|pill|drug|dose|dosage|refill|taking|adherence|statin|antibiotic|lisinopril|metformin/i.test(
      query
    )
  ) {
    if (!ctx?.activeMedications || ctx.activeMedications.length === 0) {
      return (
        `Hello ${name}, I checked your electronic health record and you currently have **no active prescriptions** on file.\n\n` +
        `If your physician prescribed something recently or if you take over-the-counter supplements, you can add them to your record directly from the **Medications** page to track your daily adherence.`
      );
    }

    let reply = `Here is your current **active medication schedule**:\n\n`;
    ctx.activeMedications.forEach((med, idx) => {
      reply += `${idx + 1}. **${med.medication}** (${med.dosage})\n`;
      reply += `   * **Frequency**: ${med.frequency}\n`;
      if (med.instructions) {
        reply += `   * **Instructions**: ${med.instructions}\n`;
      }
    });

    reply += `\n**Clinical Adherence & Safety Guidance:**\n`;
    reply += `* **Consistency**: Take your medications at the same time each day to maintain steady therapeutic levels.\n`;
    reply += `* **Tracking**: Use the daily check-in button on your Medications page to log each dose. This allows your care team to monitor your treatment progression.\n`;
    reply += `* **Missed Doses**: If you miss a dose, take it as soon as you remember unless it is almost time for your next scheduled dose. Never double up on doses without consulting your doctor.`;
    return reply;
  }

  // 3. Appointments & Doctor Visits
  if (
    /appointment|doctor|visit|scheduled|clinic|consult|consultation|dr\.|physician/i.test(
      query
    )
  ) {
    if (!ctx?.upcomingAppointments || ctx.upcomingAppointments.length === 0) {
      return (
        `You currently have **no upcoming appointments** scheduled in your portal.\n\n` +
        `If you need to consult with a doctor, renew a prescription, or schedule a routine wellness exam, you can easily book an appointment through the **Appointments** tab.`
      );
    }

    let reply = `Here are your upcoming scheduled appointments:\n\n`;
    ctx.upcomingAppointments.forEach((apt, idx) => {
      reply += `${idx + 1}. **Dr. ${apt.doctorName}** — *${apt.specialization || "General Medicine"}*\n`;
      reply += `   * **Date**: ${apt.date}\n`;
      if (apt.reason) {
        reply += `   * **Reason for visit**: ${apt.reason}\n`;
      }
    });

    reply += `\n**Preparation Tips for Your Visit:**\n`;
    reply += `* Write down any new symptoms, questions, or side effects you wish to discuss.\n`;
    reply += `* Have your current list of medications and supplements ready.\n`;
    reply += `* Please plan to arrive or connect 10 minutes prior to your scheduled time.`;
    return reply;
  }

  // 4. Vitals & Biometrics
  if (
    /vital|blood pressure|heart rate|pulse|bp|sugar|glucose|oxygen|spo2|temperature|weight|readings/i.test(
      query
    )
  ) {
    if (!ctx?.recentVitals || ctx.recentVitals.length === 0) {
      return (
        `There are currently no recorded vitals in your record.\n\n` +
        `Tracking your blood pressure, resting heart rate, and blood sugar helps your doctor make informed treatment decisions. You can record new vitals anytime in the **Vitals** section.`
      );
    }

    const latest = ctx.recentVitals[0];
    let reply = `Here are your most recent recorded vitals (recorded on **${latest.recordedAt}**):\n\n`;

    if (latest.bloodPressure) {
      reply += `* **Blood Pressure**: **${latest.bloodPressure}** mmHg\n`;
      const [systolic, diastolic] = latest.bloodPressure.split("/").map(Number);
      if (!isNaN(systolic) && !isNaN(diastolic)) {
        if (systolic < 120 && diastolic < 80) {
          reply += `  *(Clinical assessment: Normal healthy blood pressure)*\n`;
        } else if (systolic <= 129 && diastolic < 80) {
          reply += `  *(Clinical assessment: Elevated — lifestyle measures recommended)*\n`;
        } else {
          reply += `  *(Clinical assessment: Stage 1/2 Hypertension range — continue monitoring and review with your doctor)*\n`;
        }
      }
    }

    if (latest.heartRate) {
      reply += `* **Heart Rate**: **${latest.heartRate}** bpm\n`;
      if (latest.heartRate >= 60 && latest.heartRate <= 100) {
        reply += `  *(Clinical assessment: Within normal resting range: 60-100 bpm)*\n`;
      }
    }

    if (latest.oxygenSaturation) {
      reply += `* **Oxygen Saturation (SpO2)**: **${latest.oxygenSaturation}%**\n`;
      if (latest.oxygenSaturation >= 95) {
        reply += `  *(Clinical assessment: Optimal oxygenation)*\n`;
      }
    }

    if (latest.bloodSugar) {
      reply += `* **Blood Sugar**: **${latest.bloodSugar}** mg/dL\n`;
    }

    reply += `\nMaintaining regular logs provides valuable trends for your healthcare provider. If you experience any lightheadedness, chest discomfort, or sudden palpitations, please seek medical attention immediately.`;
    return reply;
  }

  // 5. Labs & Test Results
  if (/lab|test|blood work|panel|biopsy|cholesterol|hemoglobin|a1c/i.test(query)) {
    if (!ctx?.recentLabs || ctx.recentLabs.length === 0) {
      return (
        `You do not have any recent lab test orders or results on file.\n\n` +
        `Once your doctor orders laboratory panels and the laboratory processes your samples, the verified results and clinical interpretations will appear here automatically.`
      );
    }

    let reply = `Here is a summary of your recent laboratory test results:\n\n`;
    ctx.recentLabs.forEach((lab) => {
      const statusBadge = lab.isAbnormal ? "⚠️ Flagged / Abnormal" : "✅ Normal";
      reply += `* **${lab.testName}**: ${lab.resultValue || "Pending"} ${lab.unit || ""} — ${statusBadge}\n`;
    });

    reply += `\nYour physician will review any flagged results with you to determine whether dosage adjustments or follow-up testing are warranted.`;
    return reply;
  }

  // 6. Allergies & Medical Safety
  if (/allerg|allergic|adverse|reaction|penicillin|sulfa|latex/i.test(query)) {
    if (ctx?.allergies && ctx.allergies.length > 0) {
      return (
        `Your health record documents the following known allergies:\n\n` +
        ctx.allergies.map((a) => `* **${a}**`).join("\n") +
        `\n\nAll prescribers at Nala Vita are automatically alerted to these allergies before submitting any new prescription orders for your safety.`
      );
    } else {
      return `Your health chart has **no known drug or environmental allergies** documented. If you develop any sensitivities or allergic symptoms (such as hives, rash, or swelling), please notify your doctor immediately so your chart can be updated.`;
    }
  }

  // 7. Symptom Triage (Fever, Headache, Cough, Sore Throat, Fatigue, Nausea, Pain)
  if (
    /headache|migraine|fever|cough|sore throat|cold|flu|nausea|vomit|diarrhea|dizziness|dizzy|fatigue|tired|pain|ache/i.test(
      query
    )
  ) {
    let reply = `I understand you're experiencing uncomfortable symptoms. Here is supportive clinical guidance:\n\n`;

    if (/fever/i.test(query)) {
      reply += `### Fever Management\n`;
      reply += `* **Hydration**: Drink plenty of fluids (water, electrolyte solutions, clear broths) to prevent dehydration.\n`;
      reply += `* **Rest**: Allow your immune system time to recover.\n`;
      reply += `* **Monitoring**: Check your temperature every 4-6 hours.\n\n`;
    }

    if (/headache|migraine/i.test(query)) {
      reply += `### Headache Relief\n`;
      reply += `* Rest in a quiet, dimly lit room.\n`;
      reply += `* Stay well hydrated and apply a cool or warm compress to your forehead or neck.\n`;
      reply += `* Reduce screen time and blue light exposure.\n\n`;
    }

    if (/cough|sore throat|cold/i.test(query)) {
      reply += `### Respiratory Comfort\n`;
      reply += `* Warm fluids like herbal tea with honey can soothe throat irritation.\n`;
      reply += `* A cool mist humidifier can loosen congestion.\n`;
      reply += `* Warm saltwater gargles (1/2 tsp salt in warm water) can reduce swelling.\n\n`;
    }

    if (/nausea|vomit|stomach/i.test(query)) {
      reply += `### Gastrointestinal Care\n`;
      reply += `* Sip clear fluids slowly rather than gulping.\n`;
      reply += `* Stick to bland foods (bananas, rice, applesauce, toast - BRAT diet).\n`;
      reply += `* Avoid greasy, spicy, or highly acidic foods.\n\n`;
    }

    reply += `⚠️ **When to Seek Immediate Medical Attention (Red Flags):**\n`;
    reply += `* High fever over 103°F (39.4°C) or fever lasting more than 3 consecutive days.\n`;
    reply += `* Shortness of breath, wheezing, or chest tightness.\n`;
    reply += `* Severe, sudden "worst of your life" headache or stiff neck.\n`;
    reply += `* Inability to keep fluids down for more than 24 hours.\n\n`;
    reply += `If your symptoms persist or worsen, please schedule an appointment with your doctor or visit your nearest urgent care facility.`;
    return reply;
  }

  // 8. General Health / Lifestyle / Fallback
  return (
    `Thank you for reaching out, ${name}. I am here to assist with your medical questions and health management.\n\n` +
    `Regarding your inquiry: please keep in mind that consistent lifestyle habits — adequate hydration (2-3 liters/day), balanced nutrition, regular gentle movement, and 7-9 hours of restorative sleep — form the cornerstone of long-term health.\n\n` +
    `You can ask me specifically about:\n` +
    `* Your **prescriptions & medications** (e.g. *"What medications am I taking?"*)\n` +
    `* Your **vitals** (e.g. *"What is my latest blood pressure?"*)\n` +
    `* Your **upcoming appointments** (e.g. *"When is my next visit?"*)\n` +
    `* Specific **symptoms or laboratory results**\n\n` +
    `How can I best support you right now?`
  );
}

/**
 * Streams the clinical response in smooth word-by-word chunks with realistic pacing.
 */
export async function* generateClinicalStream(
  messages: ChatTurn[],
  ctx?: AmeliaContext
): AsyncGenerator<string> {
  const fullText = generateClinicalResponse(messages, ctx);
  // Split into small, realistic token chunks (words and punctuation)
  const tokens = fullText.match(/\S+\s*/g) || [fullText];

  for (const token of tokens) {
    yield token;
    // Brief 12ms delay to give a smooth, realistic live streaming feel
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
}
