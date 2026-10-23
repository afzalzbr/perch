import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Perch",
    template: "%s · Perch",
  },
  description: "A calm bio page for one creator.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="perch-root">{children}</body>
    </html>
  );
}
