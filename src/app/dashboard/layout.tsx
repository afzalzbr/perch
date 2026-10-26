import { redirect } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/domain/auth";
import { signOutAction } from "../sign-in/actions";
import { AppNav } from "./nav.client";
import { Mark } from "@/components/Mark";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOwner().catch(() => null);
  if (!ctx) redirect("/sign-in");
  if (!ctx.profile) redirect("/setup");
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/dashboard" className="app-brand" aria-label="Perch dashboard">
          <Mark size="sm" />
          <span>Perch</span>
        </Link>
        <AppNav />
        <form action={signOutAction}>
          <button
            type="submit"
            className="perch-btn perch-btn--secondary perch-btn--small"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </form>
      </header>
      {children}
      <footer className="app-footer">
        <span>
          Signed in as <strong>{ctx.user.email}</strong>
        </span>
        <span>Perch · one calm bio page</span>
      </footer>
    </div>
  );
}
