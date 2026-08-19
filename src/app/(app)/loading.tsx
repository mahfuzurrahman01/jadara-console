import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="border-b border-border px-4 py-6 sm:px-8 sm:py-7">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full rounded-xl" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
