"use client";

import {z} from "zod";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  Stethoscope,
  Calendar,
  Pill,
  Activity,
  Sparkles,
  ArrowRight,
  X,
  Loader2,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { PATIENT_NAV, DOCTOR_NAV, ADMIN_NAV, NavItem } from "@/lib/nav-config";
import type { SidebarRole } from "@/components/layout/SidebarShell";

interface Props {
  role: SidebarRole;
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Pages" | "Patients" | "Doctors" | "Actions";
  href: string;
  icon?: LucideIcon;
}

export function CommandPalette(props:Props){return props.isOpen?<CommandPaletteContent {...props}/>:null;}

function CommandPaletteContent({ role, isOpen, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [remote,setRemote]=useState<{query:string;items:SearchItem[]}|null>(null);
  const [selection,setSelection]=useState({key:"",index:0});
  const queryKey=query.trim();
  const remoteResults=useMemo(()=>remote?.query===queryKey?remote.items:[],[remote,queryKey]);
  const loadingRemote=queryKey.length>=2&&remote?.query!==queryKey;
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Global key listener for Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Static items based on active role
  const staticItems: SearchItem[] = useMemo(() => {
    const nav: readonly NavItem[] =
      role === "patient"
        ? PATIENT_NAV
        : role === "doctor"
        ? DOCTOR_NAV
        : ADMIN_NAV;

    const pageItems: SearchItem[] = nav.map((item) => ({
      id: `nav-${item.href}`,
      title: item.label,
      subtitle: `Go to ${item.label}`,
      category: "Pages",
      href: item.href,
      icon: item.icon,
    }));

    const actionItems: SearchItem[] = [];
    if (role === "doctor") {
      actionItems.push(
        {
          id: "act-prescription",
          title: "Write Prescription",
          subtitle: "Create e-prescription with drug safety verification",
          category: "Actions",
          href: "/doctor/prescriptions",
          icon: Pill,
        },
        {
          id: "act-lab",
          title: "Order Lab Requisition",
          subtitle: "Requisition new lab panels for patient",
          category: "Actions",
          href: "/doctor/lab-orders",
          icon: FlaskConical,
        },
        {
          id: "act-referral",
          title: "Create Patient Referral",
          subtitle: "Refer patient to internal or external specialist",
          category: "Actions",
          href: "/doctor/referrals",
          icon: Users,
        }
      );
    } else if (role === "patient") {
      actionItems.push(
        {
          id: "act-book",
          title: "Book Consultation",
          subtitle: "Schedule appointment with licensed specialist",
          category: "Actions",
          href: "/patient/appointments",
          icon: Calendar,
        },
        {
          id: "act-symptom",
          title: "Check Symptoms with AI",
          subtitle: "Run triage and clinical guidance with Amelia",
          category: "Actions",
          href: "/patient/symptom-checker",
          icon: Stethoscope,
        },
        {
          id: "act-vitals",
          title: "Record New Vitals",
          subtitle: "Log blood pressure, glucose, or pulse",
          category: "Actions",
          href: "/patient/vitals",
          icon: Activity,
        }
      );
    }

    return [...pageItems, ...actionItems];
  }, [role]);

  // The result carries its query key; stale results are never shown for a new query.
  useEffect(() => {
    if(queryKey.length<2)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch(`/api/search?q=${encodeURIComponent(queryKey)}`,{signal:controller.signal});
        if(!response.ok)throw new Error("Search unavailable");
        const data=z.object({results:z.array(z.object({id:z.string(),title:z.string(),subtitle:z.string().optional(),category:z.enum(["patients","doctors","actions"]),href:z.string()}))}).parse(await response.json());
        const items:SearchItem[]=data.results.map(result=>({...result,category:result.category==="patients"?"Patients":result.category==="doctors"?"Doctors":"Actions",icon:result.category==="patients"?Users:result.category==="doctors"?Stethoscope:Sparkles}));
        if(!controller.signal.aborted)setRemote({query:queryKey,items});
      }catch{if(!controller.signal.aborted)setRemote({query:queryKey,items:[]});}
    },200);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[queryKey]);

 // Filter static items by query
 const filteredItems = useMemo(() => {
 const q = query.toLowerCase().trim();
 const matchedStatic = q
 ? staticItems.filter(
 (item) =>
 item.title.toLowerCase().includes(q) ||
 (item.subtitle && item.subtitle.toLowerCase().includes(q))
 )
 : staticItems;

 return [...remoteResults, ...matchedStatic];
 }, [query, staticItems, remoteResults]);

 const selectionKey=query+":"+filteredItems.map(item=>item.id).join("|");
 const selectedIndex=selection.key===selectionKey?Math.min(selection.index,Math.max(0,filteredItems.length-1)):0;
 const setSelectedIndex=(next:number|((current:number)=>number))=>setSelection({key:selectionKey,index:typeof next==="function"?next(selectedIndex):next});

  const handleSelect = (item: SearchItem) => {
    onClose();
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? Math.max(0, filteredItems.length - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative w-full max-w-2xl bg-white dark:bg-[#1E1F22] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col z-10"
        >
          {/* Search Header Input */}
          <div className="flex items-center px-4 py-3.5 border-b border-gray-200 dark:border-gray-800">
            <Search className="w-5 h-5 text-gray-400 shrink-0 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                role === "doctor"
                  ? "Search patients, navigation, prescriptions, or clinical actions..."
                  : "Search pages, doctors, vitals, or health tools..."
              }
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-base outline-none"
            />
            {loadingRemote && (
              <Loader2 className="w-4 h-4 text-[var(--primary)] animate-spin mr-2" />
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No matching results found for &ldquo;{query}&rdquo;
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                const IconComponent = item.icon || ArrowRight;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[var(--primary)] text-white"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800/60 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isSelected ? "text-white" : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p
                            className={`text-xs truncate ${
                              isSelected ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ml-3 shrink-0 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Shortcuts */}
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-mono text-[10px]">
                  ↑↓
                </kbd>
                {" Navigate"}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-mono text-[10px]">
                  ↵
                </kbd>
                {" Select"}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-mono text-[10px]">
                  esc
                </kbd>
                {" Close"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[var(--primary)] font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Nala Vita Spotlight
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
