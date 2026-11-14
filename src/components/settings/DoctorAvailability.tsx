"use client";
import {useEffect,useState} from "react";
import {fetchJson} from "@/lib/api-fetch";
import TimezoneSelect,{useBrowserTimeZone} from "@/components/settings/TimezoneSelect";
interface Availability {timeZone:string|null;availableDays:string[];availableFrom:string|null;availableTo:string|null}
const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
export default function DoctorAvailability(){
 const browserZone=useBrowserTimeZone();const[draft,setDraft]=useState<Availability|null>(null);const[revision,setRevision]=useState(0);
 const[error,setError]=useState("");const[busy,setBusy]=useState(false);const[saved,setSaved]=useState(false);
 useEffect(()=>{const controller=new AbortController();
  fetchJson<{availability:Availability}>("/api/doctors/availability",{signal:controller.signal}).then(data=>setDraft(data.availability)).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Unable to load availability");});
  return ()=>controller.abort();
 },[revision]);
 async function save(event:React.FormEvent){event.preventDefault();if(!draft)return;setBusy(true);setError("");setSaved(false);
  try{await fetchJson("/api/doctors/availability",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,timeZone:draft.timeZone||browserZone})});setSaved(true);}
  catch(error){setError(error instanceof Error?error.message:"Unable to save availability");}finally{setBusy(false);}
 }
 return <section aria-labelledby="availability-heading" className="mx-auto max-w-4xl space-y-4 px-4 py-6">
 <h2 id="availability-heading" className="text-xl font-semibold">Doctor availability</h2>
 <p>These hours use your doctor timezone. This is separate from your reminder timezone. A valid timezone is required before patients can book.</p>
 {error&&<p role="alert">{error}</p>}{saved&&<p role="status">Availability saved</p>}
 {!draft?<><p role="status">Loading availability…</p><button type="button" onClick={()=>{setError("");setRevision(value=>value+1);}}>Retry loading availability</button></>:<form onSubmit={save} className="space-y-4">
 <label htmlFor="doctor-availability-timezone" className="block">Doctor availability timezone</label>
 <TimezoneSelect id="doctor-availability-timezone" value={draft.timeZone||browserZone} disabled={busy} onChange={timeZone=>{setDraft({...draft,timeZone});setSaved(false);}}/>
 <fieldset className="flex flex-wrap gap-4"><legend className="mb-2">Available days</legend>{days.map(day=><label key={day} className="flex items-center gap-2"><input type="checkbox" checked={draft.availableDays.includes(day)} disabled={busy} onChange={event=>{setDraft({...draft,availableDays:event.target.checked?[...draft.availableDays,day]:draft.availableDays.filter(value=>value!==day)});setSaved(false);}}/>{day}</label>)}</fieldset>
 <div className="flex flex-wrap gap-4"><label htmlFor="doctor-availability-from">From<input id="doctor-availability-from" type="time" required disabled={busy} value={draft.availableFrom??""} onChange={event=>{setDraft({...draft,availableFrom:event.target.value});setSaved(false);}} className="block rounded-lg border p-2"/></label>
 <label htmlFor="doctor-availability-to">Until<input id="doctor-availability-to" type="time" required disabled={busy} value={draft.availableTo??""} onChange={event=>{setDraft({...draft,availableTo:event.target.value});setSaved(false);}} className="block rounded-lg border p-2"/></label></div>
 <button type="submit" className="brand-action rounded-lg px-4 py-2" disabled={busy||!draft.availableDays.length||!(draft.timeZone||browserZone)}>Save availability</button>
 </form>}
 </section>;
}
