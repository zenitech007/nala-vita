import {z} from "zod";
import {isIanaTimeZone} from "@/lib/appointment-availability";
export const dailyVitalDaySchema=z.object({
 day:z.iso.date(),timeZone:z.string().max(100).refine(isIanaTimeZone,"A valid IANA timezone is required"),
});
export const dailyVitalsSchema=dailyVitalDaySchema.extend({waterLiters:z.number().finite().min(0).max(30),steps:z.number().int().min(0).max(2000000),medsTaken:z.boolean()}).strict();
export function browserVitalDay(){
 const now=new Date();
 return {day:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
}
