"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-fetch";
interface RequestRow {id:string;status:string;reason:string|null;prescription:{medication:string;patientId?:string}}
export default function RefillRequests({review=false,revision=0}:{review?:boolean;revision?:number}) {
 const [page,setPage]=useState<{requests:RequestRow[];nextCursor:string|null}>({requests:[],nextCursor:null});
 const [cursor,setCursor]=useState("");const [refresh,setRefresh]=useState(0);
 const [reasons,setReasons]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [message,setMessage]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  fetchJson<{requests:RequestRow[];nextCursor:string|null}>("/api/refill-requests?cursor="+encodeURIComponent(cursor),{signal:controller.signal})
   .then(data=>{setPage(data);setError("");}).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Unable to load refill requests");});
  return ()=>controller.abort();
 },[cursor,refresh,revision]);
 async function decide(id:string,status:"APPROVED"|"DENIED") {
  setBusy(true);setError("");setMessage("");
  try {
   await fetchJson("/api/refill-requests/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status,reason:reasons[id]})});
   setMessage("Review saved. The patient has been notified.");setRefresh(value=>value+1);
  } catch(error){setError(error instanceof Error?error.message:"Unable to save review");}
  finally{setBusy(false);}
 }
 return <section aria-labelledby="refill-heading" className="space-y-4">
  <h2 id="refill-heading" className="text-lg font-semibold">{review?"Pending refill reviews":"Refill requests"}</h2>
  <p className="text-sm">Approval is a review decision. Pharmacy dispensing is not recorded here.</p>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {!page.requests.length&&!error&&<p>No refill requests on this page.</p>}
  <ul className="divide-y divide-gray-200">{page.requests.map(row=><li key={row.id} className="space-y-2 py-4">
   <h3 className="font-medium">{row.prescription.medication}</h3>{review&&row.prescription.patientId&&<a className="underline" href={"/doctor/patients/"+encodeURIComponent(row.prescription.patientId)}>Open patient record</a>}<p>{row.status}</p>{row.reason&&<p>{row.reason}</p>}
   {review&&row.status==="PENDING"&&<>
    <label htmlFor={"refill-reason-"+row.id} className="block">Review reason</label>
    <textarea id={"refill-reason-"+row.id} required minLength={3} maxLength={1000} value={reasons[row.id]??""} onChange={event=>setReasons(prev=>({...prev,[row.id]:event.target.value}))} className="w-full rounded-lg border border-gray-300 p-3"/>
    <div className="flex flex-wrap gap-3">{(["APPROVED","DENIED"] as const).map(status=><button key={status} type="button" className="brand-action rounded-lg px-4 py-2" disabled={busy||(reasons[row.id]?.trim().length??0)<3} onClick={()=>void decide(row.id,status)}>{status==="APPROVED"?"Approve review":"Deny request"}</button>)}</div>
   </>}
  </li>)}</ul>
  <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>{setCursor("");setRefresh(value=>value+1);}}>Refresh requests</button>
  {page.nextCursor&&<button type="button" onClick={()=>setCursor(page.nextCursor!)}>Older requests</button>}</div>
 </section>;
}
