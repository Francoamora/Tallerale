import { cn } from "@/lib/utils";

const TONE_STYLES = {
  accent:
    "border-brand-200 bg-brand-50/50 dark:border-brand-900/50 dark:bg-brand-900/10",
  success:
    "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-900/10",
  warning:
    "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10",
  neutral:
    "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
} as const;

interface KpiCardProps {
  title: string;
  value: string;
  detail: string;
  tone?: keyof typeof TONE_STYLES;
}

export function KpiCard({
  title,
  value,
  detail,
  tone = "neutral",
}: KpiCardProps) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-colors duration-200",
        TONE_STYLES[tone]
      )}
    >
      {/* Línea superior de acento más sutil y limpia */}
      {tone === "accent" && (
        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-50" />
      )}
      
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {detail}
      </p>
    </article>
  );
}