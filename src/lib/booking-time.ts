/** The date/time picker is explicitly in the patient's browser timezone. */
export function bookingInstant(day:string,time:string):Date{
 const match=/^(\d{2}):(\d{2}) (AM|PM)$/.exec(time);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!match)throw new Error("Choose a valid booking date and time");
 const [year,month,date]=day.split("-").map(Number);const minute=Number(match[2]);
 const clock=Number(match[1]);if(clock<1||clock>12||minute>59)throw new Error("Choose a valid booking time");
 const hour=clock%12+(match[3]==="PM"?12:0);
 const instant=new Date(year,month-1,date,hour,minute,0,0);
 if(instant.getFullYear()!==year||instant.getMonth()!==month-1||instant.getDate()!==date||instant.getHours()!==hour||instant.getMinutes()!==minute)throw new Error("This local time does not exist. Choose another time.");
 return instant;
}
