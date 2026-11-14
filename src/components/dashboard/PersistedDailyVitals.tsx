"use client";
import {useEffect,useRef,useState} from "react";
import HealthDashboard,{type DailyVitals} from "@/components/dashboard/HealthDashboard";
import {fetchJson} from "@/lib/api-fetch";
import {browserVitalDay} from "@/lib/daily-vitals";
export default function PersistedDailyVitals(){
 const [loaded,setLoaded]=useState<{context:ReturnType<typeof browserVitalDay>;snapshot:DailyVitals|null}|null>(null);
 const [error,setError]=useState("");const [revision,setRevision]=useState(0);
 const queue=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{
  const controller=new AbortController();const context=browserVitalDay();
  fetchJson<{dailyVitals:DailyVitals|null}>("/api/vitals?dailyVitals=1&"+new URLSearchParams(context),{signal:controller.signal})
   .then(data=>{setLoaded({context,snapshot:data.dailyVitals});setError("");})
   .catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Unable to load daily vitals");});
  return ()=>controller.abort();
 },[revision]);
 async function save(vitals:DailyVitals){
  if(!loaded)throw new Error("Daily vitals have not loaded");
  const now=browserVitalDay();
  if(now.day!==loaded.context.day||now.timeZone!==loaded.context.timeZone)throw new Error("Your day or timezone changed. Refresh before saving this draft.");
  const write=queue.current.catch(()=>{}).then(async()=>{
   await fetchJson("/api/vitals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dailyVitals:{...vitals,...loaded.context}})});
  });
  queue.current=write;await write;
 }
 if(error)return <section><p role="alert">{error}</p><button type="button" onClick={()=>setRevision(value=>value+1)}>Retry loading daily vitals</button></section>;
 if(!loaded)return <p role="status">Loading daily vitals…</p>;
 return <div><p className="mb-2 text-sm">Tracker day: {loaded.context.day} ({loaded.context.timeZone})</p><HealthDashboard initialVitals={loaded.snapshot??undefined} onUpdate={save}/></div>;
}
