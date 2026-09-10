import AmeliaTabs from "@/components/amelia/AmeliaTabs";

export const metadata = { title: "Amelia" };

export default function PatientAmeliaPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-2rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Amelia</h1>
        <p className="text-gray-500 text-sm">Your AI health assistant — ask anything, anytime.</p>
      </div>
      <div className="h-[calc(100%-4rem)]">
        <AmeliaTabs />
      </div>
    </div>
  );
}
