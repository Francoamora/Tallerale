import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  compact = false,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-800",
        compact ? "p-4" : "p-5 sm:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h2 className={cn(
            "font-bold tracking-tight text-slate-900 dark:text-white",
            compact ? "text-base" : "text-xl",
          )}>
            {title}
          </h2>
          {description && (
            <p className={cn(
              "mt-1 text-slate-600 dark:text-slate-400",
              compact ? "text-xs" : "text-sm",
            )}>
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className={compact ? "mt-4" : "mt-6"}>{children}</div>
    </section>
  );
}
