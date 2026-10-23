import { redirect } from "next/navigation";
import { requireOwner } from "@/domain/auth";
import { SetupForm } from "./form.client";

export const metadata = { title: "Set up your Perch" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const ctx = await requireOwner().catch(() => null);
  if (!ctx) redirect("/sign-in");
  if (ctx.profile) redirect("/dashboard");
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="app-panel__title">Reserve your handle</h1>
        <p className="app-panel__subtitle">
          Your public page will live at <code className="app-url">perch.app/your-handle</code>. You can change your
          display name later, but the handle is yours from here on.
        </p>
        <SetupForm />
      </div>
    </div>
  );
}
