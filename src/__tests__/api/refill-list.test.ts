const auth=jest.fn();const find=jest.fn();const access=jest.fn();const visibility=jest.fn();const log=jest.fn();
jest.mock("@/lib/auth",()=>({requireApiUser:()=>auth()}));
jest.mock("@/lib/access-control",()=>({doctorHasPatientAccess:(...a:unknown[])=>access(...a)}));
jest.mock("@/lib/record-visibility",()=>({getRecordVisibility:(...a:unknown[])=>visibility(...a)}));
jest.mock("@/lib/prisma",()=>({prisma:{refillRequest:{findMany:(...a:unknown[])=>find(...a)}}}));
import {GET} from "@/app/api/refill-requests/route";
import {NextRequest} from "next/server";
beforeEach(()=>{jest.clearAllMocks();auth.mockResolvedValue({ok:true,user:{id:"du",role:"DOCTOR",doctor:{id:"d"}}});find.mockResolvedValueOnce([{id:"r",createdAt:new Date(),prescription:{patientId:"p"}}]).mockResolvedValueOnce([]);});
test("care access denied excludes request before clinical read",async()=>{
 access.mockResolvedValue(false);expect((await GET(new NextRequest("http://localhost/api/refill-requests"))).status).toBe(200);
 expect(visibility).not.toHaveBeenCalled();expect(find.mock.calls[1][0].where.AND).toContainEqual({id:{in:[]}});
});
test("authorized queue applies prescription visibility and logs returned records",async()=>{
 access.mockResolvedValue(true);visibility.mockResolvedValue({where:()=>({patientId:"p",OR:[{authoredByDoctorId:"d"}]}),log});
 await GET(new NextRequest("http://localhost/api/refill-requests"));
 expect(find.mock.calls[1][0].where.AND).toContainEqual({OR:[{id:"r",prescription:{patientId:"p",OR:[{authoredByDoctorId:"d"}]}}]});
 expect(log).toHaveBeenCalled();
});
