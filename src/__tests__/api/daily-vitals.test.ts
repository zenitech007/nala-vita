const auth=jest.fn();const read=jest.fn();const save=jest.fn();
jest.mock("@/lib/auth",()=>({requireApiUser:()=>auth()}));
jest.mock("@/lib/prisma",()=>({prisma:{dailyVitalSnapshot:{findUnique:(...a:unknown[])=>read(...a),upsert:(...a:unknown[])=>save(...a)},vital:{findMany:async()=>[]}}}));
jest.mock("@/lib/supabase-server",()=>({}));
jest.mock("@/lib/record-visibility",()=>({getRecordVisibility:async()=>({where:()=>({patientId:"own"}),log:async()=>{}})}));
import {GET,POST} from "@/app/api/vitals/route";
import {NextRequest} from "next/server";
const snapshot={day:"2026-11-13",timeZone:"America/Phoenix",waterLiters:1,steps:8000,medsTaken:true};
beforeEach(()=>{jest.clearAllMocks();auth.mockResolvedValue({ok:true,user:{id:"u",role:"PATIENT",patient:{id:"own"}}});read.mockResolvedValue(snapshot);save.mockResolvedValue(snapshot);});
test("daily snapshot reads only the authenticated patient",async()=>{
 const response=await GET(new NextRequest("http://localhost/api/vitals?dailyVitals=1&day=2026-11-13&timeZone=America%2FPhoenix&patientId=victim"));
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({dailyVitals:snapshot});expect(read).toHaveBeenCalledWith(expect.objectContaining({where:{patientId_day_timeZone:{patientId:"own",day:snapshot.day,timeZone:snapshot.timeZone}}}));
});
test("daily snapshot persists through vitals API",async()=>{
 const response=await POST(new NextRequest("http://localhost/api/vitals",{method:"POST",body:JSON.stringify({dailyVitals:snapshot})}));expect(response.status).toBe(200);expect(save).toHaveBeenCalledWith(expect.objectContaining({create:{patientId:"own",...snapshot}}));
});
test("invalid daily units or values do not write",async()=>{
 expect((await POST(new NextRequest("http://localhost/api/vitals",{method:"POST",body:JSON.stringify({dailyVitals:{...snapshot,steps:-1}})}))).status).toBe(422);expect(save).not.toHaveBeenCalled();
});

test("clinicians cannot write patient self-report snapshots",async()=>{
 auth.mockResolvedValue({ok:true,user:{id:"d",role:"DOCTOR",doctor:{id:"d"}}});
 expect((await POST(new NextRequest("http://localhost/api/vitals",{method:"POST",body:JSON.stringify({dailyVitals:snapshot})}))).status).toBe(403);expect(save).not.toHaveBeenCalled();
});
test("invalid date and forged target are rejected",async()=>{
 expect((await GET(new NextRequest("http://localhost/api/vitals?dailyVitals=1&day=2026-02-31&timeZone=UTC"))).status).toBe(422);
 expect((await POST(new NextRequest("http://localhost/api/vitals",{method:"POST",body:JSON.stringify({patientId:"victim",dailyVitals:snapshot})}))).status).toBe(422);expect(save).not.toHaveBeenCalled();
});
