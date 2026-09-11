export default function PatientLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Top Banner / Greeting Skeleton */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2.5">
          <div className="h-7 w-64 bg-gray-200 rounded-lg" />
          <div className="h-4 w-96 bg-gray-100 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-gray-200 rounded-xl" />
          <div className="h-10 w-36 bg-blue-100 rounded-xl" />
        </div>
      </div>

      {/* 4 Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-10 w-10 bg-gray-100 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-20 bg-gray-200 rounded-lg" />
              <div className="h-3.5 w-32 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Appointments & Medications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointments Column (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="h-5 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/60"
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-full bg-gray-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-36 bg-gray-200 rounded" />
                    <div className="h-3 w-28 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-8 w-24 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Medications / Vitals */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="h-5 w-36 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
          </div>
          <div className="space-y-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100"
              >
                <div className="space-y-1.5">
                  <div className="h-4 w-28 bg-gray-200 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
                <div className="h-6 w-16 bg-emerald-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
