import {isIanaTimeZone} from "@/lib/appointment-availability";
export default function BookingTimeSummary({instant,doctorTimeZone,locale}:{instant:Date;doctorTimeZone:string|null;locale:string}){
 if(!doctorTimeZone||!isIanaTimeZone(doctorTimeZone))return <p role="status">This doctor must configure a timezone before booking.</p>;
 const yourZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const format=(timeZone:string)=>new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",hourCycle:"h23",timeZone}).format(instant);
 return <dl className="space-y-2 text-sm"><div><dt>Your local time ({yourZone})</dt><dd>{format(yourZone)}</dd></div><div><dt>Doctor local time ({doctorTimeZone})</dt><dd>{format(doctorTimeZone)}</dd></div></dl>;
}
