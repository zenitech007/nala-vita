import {jest} from "@jest/globals";
import {mockQuery} from "../helpers/mock";
import {apiRequest} from "../helpers/requests";
const generate = mockQuery<{text?:string}>();
jest.mock("@/lib/gemini",()=>({GEMINI_MODEL:"synthetic-model",ai:{models:{generateContent:(...args:unknown[])=>generate(...args)}}}));
jest.mock("@/lib/auth",()=>({requireApiUser:async()=>({ok:true,user:{id:"user",doctor:{id:"doctor"},patient:{id:"patient"}}})}));
jest.mock("@/lib/access-control",()=>({doctorHasPatientAccess:async()=>true}));
jest.mock("@/lib/visible-patient-record",()=>({loadVisiblePatientRecord:async()=>({profileAvailable:true,patient:{dateOfBirth:null,gender:"unknown",bloodType:null,allergies:[],user:{firstName:"Synthetic",lastName:"Patient"}},vitals:[{recordedAt:new Date("2026-11-15T12:00:00Z"),bloodPressure:"120/80"}],prescriptions:[]})}));
jest.mock("@/lib/rate-limit",()=>({checkRateLimitAsync:async()=>({allowed:true,remaining:9,resetAt:Date.now()+60000})}));
import {POST as symptom} from "@/app/api/ai/symptom-check/route";
import {POST as risk} from "@/app/api/ai/risk-score/route";
import {POST as diagnosis} from "@/app/api/ai/diagnosis-support/route";
const routes=[
 {name:"symptom-check",handler:symptom,input:{symptoms:["headache"],duration:"one day",severity:3},result:{urgency:"Low",possibleConditions:[{name:"Synthetic condition",probability:"Low",description:"Synthetic description"}],recommendation:"Synthetic recommendation",seekCareIn:"Synthetic timeframe",selfCareAdvice:["Synthetic advice"]}},
 {name:"risk-score",handler:risk,input:{patientId:"patient"},result:{riskScore:42,riskLevel:"High",riskFactors:[],recommendedActions:[],summary:"Synthetic assessment"}},
 {name:"diagnosis-support",handler:diagnosis,input:{symptoms:["headache"]},result:{differentialDiagnosis:[{condition:"Synthetic condition",probability:"Low",reasoning:"Synthetic reasoning"}],drugInteractions:[],suggestedTests:[],treatmentOptions:[],redFlags:[]}},
];
const originalKeys={gemini:process.env.GEMINI_API_KEY,google:process.env.GOOGLE_API_KEY};
beforeEach(()=>{generate.mockReset();process.env.GEMINI_API_KEY="synthetic-test-key";delete process.env.GOOGLE_API_KEY;jest.spyOn(console,"warn").mockImplementation(()=>{});});
afterEach(()=>{jest.restoreAllMocks();for(const [name,value] of [["GEMINI_API_KEY",originalKeys.gemini],["GOOGLE_API_KEY",originalKeys.google]] as const){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
describe.each(routes)("$name unavailable contract",({name,handler,input,result})=>{
 test.each(["missing key","provider error","empty response","invalid JSON","wrong shape"])("%s produces no fabricated assessment",async failure=>{
  if(failure==="missing key")delete process.env.GEMINI_API_KEY;
  else if(failure==="provider error")generate.mockRejectedValueOnce(new Error("synthetic provider failure"));
  else generate.mockResolvedValueOnce({text:failure==="empty response"?"":failure==="invalid JSON"?"invalid":"{\"unrelated\":true}"});
  const response=await handler(apiRequest(`http://localhost/api/ai/${name}`,{method:"POST",body:JSON.stringify(input)}));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({status:"unavailable",error:expect.stringMatching(/unavailable/i)});
  if(failure==="missing key")expect(generate).not.toHaveBeenCalled();
 });
 test("a schema-valid provider assessment remains available",async()=>{
  generate.mockResolvedValueOnce({text:JSON.stringify(result)});
  const response=await handler(apiRequest(`http://localhost/api/ai/${name}`,{method:"POST",body:JSON.stringify(input)}));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({...result,status:"available"});
 });
});
