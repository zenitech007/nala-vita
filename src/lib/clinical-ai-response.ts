import {NextResponse} from "next/server";
import {z} from "zod";
const text = z.string().trim().min(1);
export const symptomAssessmentSchema = z.object({
  urgency:z.enum(["Low","Medium","High","Emergency"]),
  possibleConditions:z.array(z.object({name:text,probability:z.enum(["High","Medium","Low"]),description:text})).min(1),
  recommendation:text,seekCareIn:text,selfCareAdvice:z.array(text),
});
export const riskAssessmentSchema = z.object({
  riskScore:z.number().min(0).max(100),riskLevel:z.enum(["Low","Moderate","High","Critical"]),
  riskFactors:z.array(z.object({factor:text,severity:z.enum(["Low","Moderate","High"]),detail:text})),
  recommendedActions:z.array(z.object({action:text,priority:z.enum(["Immediate","Short-term","Long-term"]),reason:text})),summary:text,
});
export const diagnosisAssessmentSchema = z.object({
  differentialDiagnosis:z.array(z.object({condition:text,probability:z.enum(["High","Medium","Low"]),reasoning:text})).min(1),
  drugInteractions:z.array(z.object({drugs:z.array(text).min(2),severity:z.enum(["Major","Moderate","Minor"]),description:text})),
  suggestedTests:z.array(z.object({test:text,reason:text,urgency:z.enum(["Stat","Urgent","Routine"])})),
  treatmentOptions:z.array(z.object({treatment:text,type:z.enum(["Pharmacological","Non-pharmacological","Surgical","Referral"]),details:text,considerations:text})),
  redFlags:z.array(z.object({flag:text,action:text})),
});
export function parseClinicalAssessment<T extends z.ZodType>(responseText:string,schema:T):z.output<T>|null {
  try {
    const cleaned=responseText.trim().replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"").trim();
    const parsed=schema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
export function clinicalAssessmentUnavailable() {
  return NextResponse.json({status:"unavailable",error:"AI assessment is unavailable. No assessment was generated. Please consult a qualified healthcare professional."},{status:503});
}
