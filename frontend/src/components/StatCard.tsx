interface Props {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "brand" | "warning" | "success";
}

const TONES = {
  default: "text-ink-900",
  brand: "text-brand-600",
  warning: "text-amber-600",
  success: "text-emerald-600",
};

export default function StatCard({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
