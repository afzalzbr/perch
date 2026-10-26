type MarkSize = "sm" | "md" | "lg";

const SIZES: Record<MarkSize, number> = { sm: 20, md: 28, lg: 44 };

/**
 * The Perch mark — a bird perched on a branch, drawn as a single confident
 * stroke so it reads as a maker's wordmark not a tech logo. 24-grid, 1.5px
 * stroke, round joins.
 */
export function Mark({ size = "md", title = "Perch" }: { size?: MarkSize; title?: string }) {
  const px = SIZES[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Body curve */}
      <path d="M4 14c3 .4 5-.4 6.5-2.2 1.3-1.6 2-3 3.2-3.6 1.6-.8 3.3-.5 4.3.5" />
      {/* Head + beak */}
      <path d="M18 8.7l2.3-.8-1.7 1.8" />
      {/* Branch */}
      <path d="M3 17h14" />
      {/* Eye */}
      <circle cx="17" cy="9.4" r="0.5" fill="currentColor" stroke="none" />
      {/* Tail */}
      <path d="M4.5 14l-2.1 1.8" />
    </svg>
  );
}
