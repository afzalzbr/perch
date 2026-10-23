import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { allowSignUp } from "@/domain/auth";
import { SignInForm } from "./form.client";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");
  const canSignUp = await allowSignUp();
  const params = await searchParams;
  const mode = params.signup === "1" && canSignUp ? "signup" : "signin";
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="app-brand__dot" aria-hidden="true" />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500 }}>
            Perch
          </span>
        </div>
        <h1 className="app-panel__title" style={{ marginTop: 8 }}>
          {mode === "signup" ? "Set up your Perch" : "Welcome back"}
        </h1>
        <p className="app-panel__subtitle">
          {mode === "signup"
            ? "One profile, one public URL, a short list of links. You can change everything later."
            : "Sign in to edit and publish your page."}
        </p>
        <SignInForm mode={mode} canSignUp={canSignUp} />
      </div>
    </div>
  );
}
