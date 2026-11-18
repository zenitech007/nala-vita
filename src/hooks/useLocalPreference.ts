"use client";
import {useCallback,useSyncExternalStore,type Dispatch,type SetStateAction} from "react";
const changed="nala-local-preference-changed";
const memory=new Map<string,string>();
function read(key:string){try{return localStorage.getItem(key);}catch{return memory.get(key)??null;}}
function subscribe(callback:()=>void){window.addEventListener("storage",callback);window.addEventListener(changed,callback);return()=>{window.removeEventListener("storage",callback);window.removeEventListener(changed,callback);};}
export const readBoolean=(raw:string|null)=>raw==="true"?true:raw==="false"?false:undefined;
/** Local storage is an external store; server snapshots never read browser state. */
export function useLocalPreference<T extends string|boolean>(key:string,fallback:T,parse:(raw:string|null)=>T|undefined):[T,Dispatch<SetStateAction<T>>]{
 const raw=useSyncExternalStore(subscribe,()=>read(key),()=>null);
 const value=parse(raw)??fallback;
 const setValue=useCallback<Dispatch<SetStateAction<T>>>(next=>{
  const current=parse(read(key))??fallback;
  const resolved=typeof next==="function"?next(current):next;
  try{localStorage.setItem(key,String(resolved));memory.delete(key);}catch{memory.set(key,String(resolved));}
  window.dispatchEvent(new Event(changed));
 },[key,fallback,parse]);
 return [value,setValue];
}
