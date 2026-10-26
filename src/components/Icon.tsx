import type { SVGProps } from "react";

const PATHS = {
  edit: "M12 20h9  M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
  trash: "M3 6h18  M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2  M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  "arrow-up": "M12 19V5  M5 12l7-7 7 7",
  "arrow-down": "M12 5v14  M19 12l-7 7-7-7",
  "arrow-right": "M5 12h14  M13 5l7 7-7 7",
  check: "M20 6L9 17l-5-5",
  plus: "M12 5v14  M5 12h14",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18 M12 3a14 14 0 010 18 M12 3a14 14 0 000 18",
  external: "M14 3h7v7  M10 14L21 3  M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5",
  dot: "M12 12v.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const parts = PATHS[name].split("  ");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {parts.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
