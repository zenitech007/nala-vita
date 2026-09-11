export default function AdminLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-60 bg-gray-200 rounded-lg" />
          <div className="h-4 w-80 bg-gray-100 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-gray-200 rounded-xl" />
          <div className="h-10 w-36 bg-blue-200 rounded-xl" />
        </div>
      </div>

      {/* Admin KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-9 w-9 bg-gray-100 rounded-xl" />
            </div>
            <div className="h-8 w-24 bg-gray-200 rounded-lg" />
            <div className="h-3 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Admin Table / Activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-9 w-32 bg-gray-100 rounded-lg" />
        </div>
        <div className="divide-y divide-gray-100">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="py-3.5 flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-48 bg-gray-200 rounded" />
                <div className="h-3 w-36 bg-gray-100 rounded" />
              </div>
              <div className="h-6 w-20 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
