export function Flash({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div className={`app-flash app-flash--${tone}`} role="status" aria-live="polite">
      {children}
    </div>
  );
}
