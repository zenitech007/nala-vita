import DoctorRecordRequests from "@/components/records/DoctorRecordRequests";
export default async function RecordRequestsPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const query = await searchParams;
  return <DoctorRecordRequests patientId={typeof query.patientId === "string" ? query.patientId.slice(0, 200) : undefined} />;
}
