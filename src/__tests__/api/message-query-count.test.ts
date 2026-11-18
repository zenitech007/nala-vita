const many=jest.fn();const first=jest.fn();const count=jest.fn();const raw=jest.fn();const participant=jest.fn();
jest.mock("@/lib/prisma",()=>({prisma:{message:{findMany:(...a:unknown[])=>many(...a),findFirst:(...a:unknown[])=>first(...a),count:(...a:unknown[])=>count(...a)},$queryRaw:(...a:unknown[])=>raw(...a)}}));
jest.mock("@/app/api/messages/_access",()=>({getAuthenticatedMessagingUser:async()=>({id:"u",role:"PATIENT",patient:{id:"p"}}),getAuthorizedMessageParticipant:(...a:unknown[])=>participant(...a)}));
jest.mock("@/lib/realtime-publish",()=>({}));
import {GET} from "@/app/api/messages/route";
import {NextRequest} from "next/server";
beforeEach(()=>jest.clearAllMocks());
test.each([1,10,50])("conversation query count is constant for %i partners",async n=>{
 const partners=Array.from({length:n},(_,i)=>({id:`d${i}`,firstName:"Test",lastName:"Doctor",role:"DOCTOR",avatarUrl:null}));
 many.mockResolvedValueOnce(partners.map(p=>({receiverId:p.id}))).mockResolvedValueOnce([]);
 participant.mockImplementation(async(_user,id)=>partners.find(p=>p.id===id));first.mockResolvedValue({createdAt:new Date()});count.mockResolvedValue(0);
 raw.mockResolvedValue(partners.map(p=>({id:p.id,createdAt:new Date(),partner:p,lastMessage:null,unreadCount:0})));
 const response=await GET(new NextRequest("http://localhost/api/messages?limit=100"));
 expect(response.status).toBe(200);expect((await response.json()).conversations).toHaveLength(n);
 expect(many.mock.calls.length+first.mock.calls.length+count.mock.calls.length+raw.mock.calls.length).toBe(1);
 expect(participant).not.toHaveBeenCalled();
});

test("membership predicates and cursor values stay in the database query",async()=>{
 raw.mockResolvedValue([]);
 const cursor=Buffer.from(JSON.stringify({id:"partner-position",at:"2026-01-01T00:00:00.000Z"})).toString("base64url");
 await GET(new NextRequest(`http://localhost/api/messages?cursor=${cursor}`));
 const query=raw.mock.calls[0][0];
 expect(query.text).toContain("u.is_active");expect(query.text).toContain("d.is_verified");
 expect(query.text).toContain("r.status = 'ACCEPTED'");expect(query.text).toContain("FROM appointments");
 expect(query.text).toContain("r.referring_doctor_id");expect(query.text).toContain("r.referred_doctor_id");
 expect(query.text).not.toContain("partner-position");expect(query.values).toContain("partner-position");
 expect(query.values).toContain("p");expect(query.values).toContain(51);
});
