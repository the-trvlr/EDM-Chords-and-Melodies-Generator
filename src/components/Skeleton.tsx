export function StaffSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <span className="h-3 w-28 rounded bg-gray-800" />
      <div className="flex h-40 animate-pulse items-center justify-center rounded-xl border border-gray-800 bg-gray-900/40">
        <div className="flex w-4/5 flex-col gap-2">
          <div className="h-px w-full bg-gray-700" />
          <div className="h-px w-full bg-gray-700" />
          <div className="h-px w-full bg-gray-700" />
          <div className="h-px w-full bg-gray-700" />
          <div className="h-px w-full bg-gray-700" />
        </div>
      </div>
    </div>
  );
}
