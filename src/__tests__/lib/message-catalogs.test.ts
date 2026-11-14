import {readFileSync} from "node:fs";
import {isValidElement,type ReactNode,Children} from "react";
const messages=JSON.parse(readFileSync("messages/en.json","utf8"));
jest.mock("next/font/local",()=>({__esModule:true,default:()=>({variable:"font"})}));
jest.mock("next-intl",()=>({NextIntlClientProvider:()=>null}));
jest.mock("next-intl/server",()=>({getLocale:async()=>"en",getMessages:async()=>messages}));
jest.mock("@/app/globals.css",()=>({}));jest.mock("@/app/appearance.css",()=>({}));
jest.mock("@/providers",()=>({__esModule:true,default:()=>null}));
jest.mock("@/components/providers/ThemeProvider",()=>({ThemeProvider:()=>null}));
jest.mock("@/components/common/RouteProgress",()=>({__esModule:true,default:()=>null}));
import RootLayout from "@/app/layout";
function serializedMessages(node:ReactNode):unknown{
 if(!isValidElement<{messages?:unknown;children?:ReactNode}>(node))return undefined;
 if(node.props.messages)return node.props.messages;
 return Children.toArray(node.props.children).map(serializedMessages).find(value=>value!==undefined);
}
function keys(value:unknown,prefix=""):string[]{return value&&typeof value==="object"?Object.entries(value).flatMap(([key,item])=>keys(item,prefix?prefix+"."+key:key)):[prefix];}
test.each(["fr","yo","ha","ig"])("%s has the same leaf keys and ICU placeholders as English",locale=>{
 const other=JSON.parse(readFileSync(`messages/${locale}.json`,"utf8"));expect(keys(other).sort()).toEqual(keys(messages).sort());
 const atPath=(value:unknown,path:string):unknown=>path.split(".").reduce<unknown>((current,key)=>current&&typeof current==="object"?(current as Record<string,unknown>)[key]:undefined,value);
 const placeholders=(value:unknown)=>(String(value).match(/\{[A-Za-z][A-Za-z0-9_]*/g)??[]).sort();
 for(const path of keys(messages)){
  expect(typeof atPath(other,path)).toBe("string");expect(String(atPath(other,path)).trim()).not.toBe("");
  expect(placeholders(atPath(other,path))).toEqual(placeholders(atPath(messages,path)));
 }
});
test("root serializes shared namespaces only",async()=>{
 const element=await RootLayout({children:null});expect(Object.keys(serializedMessages(element) as object).sort()).toEqual(["common","nav"]);
});
