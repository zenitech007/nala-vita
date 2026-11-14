import ScopedMessages from "@/i18n/ScopedMessages";
export default function AuthLayout({children}:{children:React.ReactNode}){
 return <ScopedMessages namespaces={["auth"]}>{children}</ScopedMessages>;
}
