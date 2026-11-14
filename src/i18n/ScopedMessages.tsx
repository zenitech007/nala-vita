import {NextIntlClientProvider} from "next-intl";
import {getLocale,getMessages} from "next-intl/server";
import {selectMessages} from "@/i18n/messages";
export default async function ScopedMessages({namespaces,children}:{namespaces:readonly string[];children:React.ReactNode}){
 const [locale,messages]=await Promise.all([getLocale(),getMessages()]);
 return <NextIntlClientProvider locale={locale} messages={selectMessages(messages,["common","nav",...namespaces])}>{children}</NextIntlClientProvider>;
}
