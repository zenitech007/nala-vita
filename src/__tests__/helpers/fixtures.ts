import type {Notification} from "@prisma/client";
export function notificationFixture(overrides:Partial<Notification>={}):Notification{
 return {id:"synthetic-notification",userId:"synthetic-user",title:"Synthetic notification",message:"Synthetic body",type:"TEST",isRead:false,link:null,createdAt:new Date("2030-01-01T00:00:00Z"),...overrides};
}
