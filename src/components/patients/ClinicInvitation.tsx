"use client";
import {useEffect,useState} from "react";
import {useLocale} from "next-intl";
import {fetchJson} from "@/lib/api-fetch";
export default function ClinicInvitation({patientId}:{patientId:string}){
 const locale=useLocale();const[eligible,setEligible]=useState<boolean|null>(null);const[revision,setRevision]=useState(0);
 const[invitation,setInvitation]=useState<{invitationCode:string;expiresAt:string}|null>(null);
 const[error,setError]=useState("");const[busy,setBusy]=useState(false);
 const url="/api/patients/"+encodeURIComponent(patientId)+"/invitation";
 useEffect(()=>{const controller=new AbortController();
  fetchJson<{eligible:boolean}>(url,{signal:controller.signal}).then(data=>setEligible(data.eligible)).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Unable to check invitation eligibility");});
  return ()=>controller.abort();
 },[url,revision]);
 async function issue(){setBusy(true);setError("");setInvitation(null);
  try{setInvitation(await fetchJson<{invitationCode:string;expiresAt:string}>(url,{method:"POST"}));}
  catch(error){setError(error instanceof Error?error.message:"Could not issue a clinic invitation");}finally{setBusy(false);}
 }
 if(eligible===false)return null;
 return <section aria-labelledby="clinic-invitation-heading" className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
 <h2 id="clinic-invitation-heading" className="text-lg font-semibold">Clinic record invitation</h2>
 <p className="text-sm">Only the creating clinician can invite a patient to an unbound clinic record. The patient must verify their chosen email before claiming it.</p>
 {error&&<div><p role="alert">{error}</p>{eligible===null&&<button type="button" onClick={()=>{setError("");setRevision(value=>value+1);}}>Retry invitation check</button>}</div>}
 {eligible===null&&!error&&<p role="status">Checking invitation eligibility…</p>}
 <button type="button" disabled={!eligible||busy} onClick={()=>void issue()} className="brand-action rounded-lg px-4 py-2">{busy?"Issuing invitation…":"Issue clinic invitation"}</button>
 {invitation&&<div className="space-y-2">
 <p role="status">Invitation created. Share this code privately with the patient. A new invitation replaces earlier unused codes.</p>
 <label htmlFor="clinic-invitation-code" className="block text-sm font-medium">Single-use invitation code</label>
 <input id="clinic-invitation-code" readOnly value={invitation.invitationCode} className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm"/>
 <p className="text-sm">Expires {new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short"}).format(new Date(invitation.expiresAt))}. Ask the patient to open <a href="/claim" className="underline">Claim clinic record</a> and enter the code.</p>
 </div>}
 </section>;
}
