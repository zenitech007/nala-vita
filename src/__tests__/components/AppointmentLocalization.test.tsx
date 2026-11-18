import {jest} from "@jest/globals";
import {render,screen,cleanup} from "@testing-library/react";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import ha from "../../../messages/ha.json";
import ig from "../../../messages/ig.json";
import yo from "../../../messages/yo.json";
const catalogs={en,fr,ha,ig,yo};
let locale:keyof typeof catalogs="en";
jest.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams()}));
jest.mock("next-intl",()=>({
 useLocale:()=>locale,
 useTranslations:(namespace:string)=>(key:string)=>{
  const messages=catalogs[locale] as Record<string,Record<string,string>>;
  if(!messages[namespace]?.[key])throw new Error(`Missing message ${locale}.${namespace}.${key}`);
  return messages[namespace][key];
 },
 useFormatter:()=>({dateTime:(value:Date,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(locale,options).format(value)}),
}));
import PatientAppointments from "@/app/(patient)/patient/appointments/page";
import DoctorAppointments from "@/app/(doctor)/doctor/appointments/page";
const originalFetch=global.fetch;
afterEach(()=>{cleanup();global.fetch=originalFetch;});
const scheduledAt="2030-11-15T12:00:00Z";
const shared={id:"appointment",scheduledAt,duration:30,status:"CONFIRMED",consultationType:"VIDEO",urgencyLevel:"LOW",reason:null,notes:null};
const doctor={id:"doctor",specialization:"Synthetic specialty",consultationFee:100,user:{firstName:"SyntheticDoctor",lastName:"Test",avatarUrl:null}};
const patient={id:"patient",dateOfBirth:"1980-01-01",gender:"female",bloodType:null,allergies:[],user:{firstName:"SyntheticPatient",lastName:"Test",avatarUrl:null,email:"synthetic@example.test",phone:null},vitals:[],prescriptions:[],medicalNotes:[]};
describe.each(["en","fr","ha","ig","yo"] as const)("appointment locale %s",language=>{
 test.each(["patient","doctor"] as const)("%s displays translated navigation and locale-aware dates",async role=>{
  locale=language;
  global.fetch=jest.fn<typeof fetch>().mockResolvedValue({ok:true,json:async()=>({appointments:[{...shared,doctor,patient}]})} as Response);
  render(role==="patient"?<PatientAppointments/>:<DoctorAppointments/>);
  await screen.findByText(role==="patient"?/SyntheticDoctor/:/SyntheticPatient/);
  expect(screen.getByRole("heading",{level:1})).toHaveTextContent(catalogs[language].appointments.title);
  expect(screen.getByRole("button",{name:new RegExp(catalogs[language].appointments.upcoming)})).toBeInTheDocument();
  const expected=new Intl.DateTimeFormat(language,{year:"numeric",month:"short",day:"numeric"}).format(new Date(scheduledAt));
  expect(screen.getByText(expected)).toBeInTheDocument();
 });
});
