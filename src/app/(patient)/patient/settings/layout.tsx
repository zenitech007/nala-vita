import ScopedMessages from "@/i18n/ScopedMessages";
export default function SettingsLayout({children}:{children:React.ReactNode}){
 return <ScopedMessages namespaces={["settings"]}>{children}</ScopedMessages>;
}
