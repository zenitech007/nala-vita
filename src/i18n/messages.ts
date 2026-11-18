import type {AbstractIntlMessages} from "next-intl";
export function selectMessages(messages:AbstractIntlMessages,namespaces:readonly string[]){
 return Object.fromEntries(namespaces.filter(key=>key in messages).map(key=>[key,messages[key]]));
}
