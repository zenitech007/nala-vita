"use client";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};
const stack: {host:HTMLElement;dialog:HTMLElement}[] = [];
const originalInert = new Map<HTMLElement,string|null>();
let originalOverflow = "";
function updateBackground() {
 const active=stack.at(-1);
 if(active) {
  for(const child of Array.from(document.body.children)) if(child instanceof HTMLElement) {
   if(!originalInert.has(child)) originalInert.set(child,child.getAttribute("inert"));
   if(child===active.host) child.removeAttribute("inert"); else child.setAttribute("inert","");
  }
 } else {
  for(const [child,value] of originalInert) {if(value===null)child.removeAttribute("inert");else child.setAttribute("inert",value);}
  originalInert.clear();document.body.style.overflow=originalOverflow;
 }
}
function focusable(root:HTMLElement) {
 return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'))
  .filter(element=>element.tabIndex>=0&&!element.closest('[hidden], [inert], [aria-hidden="true"]')&&getComputedStyle(element).display!=="none"&&getComputedStyle(element).visibility!=="hidden");
}
export default function AccessibleDialog({isOpen,onClose,labelledBy,label,children,className=""}:{isOpen:boolean;onClose:()=>void;labelledBy?:string;label?:string;children:ReactNode;className?:string}) {
 const mounted=useSyncExternalStore(subscribe,()=>true,()=>false);
 const host=useRef<HTMLDivElement>(null);const dialog=useRef<HTMLDivElement>(null);const close=useRef(onClose);
 useEffect(()=>{close.current=onClose;},[onClose]);
 useEffect(()=>{
  if(!isOpen||!mounted||!host.current||!dialog.current)return;
  const entry={host:host.current,dialog:dialog.current};const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  if(!stack.length)originalOverflow=document.body.style.overflow;
  stack.push(entry);document.body.style.overflow="hidden";updateBackground();
  const first=()=>focusable(entry.dialog)[0]??entry.dialog;
  first().focus();
  const observer=new MutationObserver(updateBackground);observer.observe(document.body,{childList:true});
  const keys=(event:KeyboardEvent)=>{
   if(stack.at(-1)!==entry)return;
   if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close.current();}
   if(event.key==="Tab"){
    const items=focusable(entry.dialog);const start=items[0]??entry.dialog;const end=items.at(-1)??entry.dialog;
    if(!items.length||!items.includes(document.activeElement as HTMLElement)||(event.shiftKey&&document.activeElement===start)||(!event.shiftKey&&document.activeElement===end)) {event.preventDefault();(event.shiftKey?end:start).focus();}
   }
  };
  const focus=(event:FocusEvent)=>{if(stack.at(-1)===entry&&!entry.dialog.contains(event.target as Node))first().focus();};
  document.addEventListener("keydown",keys,true);document.addEventListener("focusin",focus,true);
  return ()=>{
   observer.disconnect();document.removeEventListener("keydown",keys,true);document.removeEventListener("focusin",focus,true);
   const index=stack.indexOf(entry);if(index>=0)stack.splice(index,1);updateBackground();
   if(previous?.isConnected&&!previous.closest("[inert]"))previous.focus();
  };
 },[isOpen,mounted]);
 if(!mounted||!isOpen)return null;
 return createPortal(<div ref={host} className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div aria-hidden="true" className="absolute inset-0 bg-black/50" onClick={()=>close.current()}/>
  <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={label} tabIndex={-1} className={className}>{children}</div>
 </div>,document.body);
}
