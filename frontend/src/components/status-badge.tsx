import { AssignmentStatus } from "@/types";
import { cn } from "@/lib/utils";

const styles: Record<AssignmentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  VIEWED: "bg-sky-100 text-sky-800",
  SIGNED: "bg-emerald-100 text-emerald-800",
  REVOKED: "bg-neutral-200 text-neutral-700",
};

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}
