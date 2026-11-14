import DoctorAvailability from "@/components/settings/DoctorAvailability";
import SettingsPanel from "@/components/settings/SettingsPanel";

export default function DoctorSettingsPage() {
  return <><DoctorAvailability/><SettingsPanel backHref="/doctor/dashboard" backLabel="Back to Doctor Dashboard" /></>;
}
