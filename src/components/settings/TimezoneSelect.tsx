"use client";
import {useSyncExternalStore} from "react";
const subscribe=()=>()=>{};
export function useBrowserTimeZone(){return useSyncExternalStore(subscribe,()=>Intl.DateTimeFormat().resolvedOptions().timeZone,()=>"");}
export default function TimezoneSelect({id,value,onChange,disabled=false,describedBy}:{id:string;value:string;onChange:(value:string)=>void;disabled?:boolean;describedBy?:string}){
 const supported=typeof Intl.supportedValuesOf==="function"?Intl.supportedValuesOf("timeZone"): ["Africa/Lagos","Europe/London","America/New_York","America/Phoenix"];
 const options=Array.from(new Set(["UTC",...(value?[value]:[]),...supported])).sort();
 return <select id={id} required disabled={disabled} value={value} onChange={event=>onChange(event.target.value)} aria-describedby={describedBy} className="w-full rounded-lg border border-gray-300 bg-white p-3">
 <option value="" disabled>Choose an IANA timezone</option>{options.map(zone=><option key={zone} value={zone}>{zone}</option>)}
 </select>;
}
