export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "brand";

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const includeDot = tone === "success" || tone === "warning" || tone === "danger";
  return (
    <span className={`perch-badge perch-badge--${tone}`}>
      {includeDot ? <span className="perch-badge__dot" aria-hidden="true" /> : null}
      <span>{label}</span>
    </span>
  );
}
