import { Skeleton } from "@/components/ui/skeleton";

interface DataTableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function DataTableSkeleton({ rows = 6, columns = 6 }: DataTableSkeletonProps) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="px-4 py-3 whitespace-nowrap">
              {c === 1 ? (
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ) : (
                <Skeleton className="h-3 w-20" style={{ opacity: 1 - r * 0.08 }} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
