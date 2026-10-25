import { redirect } from "next/navigation";
import Link from "next/link";
import { allowSignUp } from "@/domain/auth";
import { getSession } from "@/lib/session";
import { SignInForm } from "../sign-in/form.client";

export const metadata = { title: "Sign up" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const session = await getSession();
  if (session) redirect("/");
  const canSignUp = await allowSignUp();
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="app-brand__dot" aria-hidden="true" />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.015em" }}>
            Perch
          </span>
        </div>
        {canSignUp ? (
          <>
            <h1 className="app-panel__title">Set up your Perch</h1>
            <p className="app-panel__subtitle">
              One profile, one public URL, a short list of links. You can change everything later.
            </p>
            <SignInForm mode="signup" canSignUp />
          </>
        ) : (
          <>
            <h1 className="app-panel__title">Sign-up is closed</h1>
            <p className="app-panel__subtitle">
              Perch is a single-creator product — this instance already belongs to someone. If that someone is you,
              sign in below. If you want your own Perch, deploy a fresh instance from the repo.
            </p>
            <Link href="/sign-in" className="perch-btn perch-btn--primary perch-btn--block" style={{ textAlign: "center" }}>
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
