import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
// Execute the actual date-button key expression under opposite UTC offsets.
const source=readFileSync("src/app/(patient)/patient/appointments/page.tsx","utf8");
const expression=/const dateStr = (.+);/.exec(source)?.[1];
const confirmation=/selectedDate \? (.+?) : ""/.exec(source)?.[1];
test.each([["Pacific/Kiritimati",0,30],["America/Phoenix",23,30],["UTC",12,0]] as const)("picker keeps its visible local day in %s",(zone,hour,minute)=>{
 expect(expression).toBeDefined();
 expect(confirmation).toBeDefined();
 const script=`const {format}=require("date-fns");const date=new Date(2026,10,15,${hour},${minute});process.stdout.write(JSON.stringify([new Function("date","format", "return "+${JSON.stringify(expression)})(date,format),new Function("selectedDate","format","return "+${JSON.stringify(confirmation)})("2026-11-15",format)]));`;
 const selected=execFileSync(process.execPath,["-e",script],{cwd:process.cwd(),env:{...process.env,TZ:zone},encoding:"utf8",timeout:20000});
 expect(JSON.parse(selected)).toEqual(["2026-11-15","November 15, 2026"]);
});
