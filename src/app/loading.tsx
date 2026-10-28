import { SkeletonLogsheet } from "@/components/SkeletonTable";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full p-2 sm:p-4 lg:p-6 animate-in fade-in duration-150">
      <SkeletonLogsheet rows={10} />
    </div>
  );
}
