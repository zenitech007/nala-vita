import {NextRequest} from "next/server";
export function apiRequest(url:string,init?:ConstructorParameters<typeof NextRequest>[1]){return new NextRequest(url,init);}
export function routeContext<Params extends Record<string,string>>(params:Params){return {params:Promise.resolve(params)};}
