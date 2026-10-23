"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav() {
  const path = usePathname() ?? "";
  const items = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/profile", label: "Profile" },
    { href: "/dashboard/analytics", label: "Analytics" },
  ];
  return (
    <nav className="app-nav" aria-label="Primary">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(path, item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function isActive(path: string, target: string) {
  if (target === "/dashboard") return path === "/dashboard";
  return path === target || path.startsWith(target + "/");
}
