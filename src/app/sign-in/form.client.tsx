"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Flash } from "@/components/Flash";
import { signInAction, signUpAction, type SignInState } from "./actions";

export function SignInForm({ mode, canSignUp }: { mode: "signin" | "signup"; canSignUp: boolean }) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<SignInState, FormData>(action, {});
  return (
    <form action={formAction} className="app-stack" aria-busy={pending}>
      {state.message && !state.fieldErrors ? <Flash tone="danger">{state.message}</Flash> : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
        hint={mode === "signup" ? "This is the only account for your Perch." : undefined}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
        error={state.fieldErrors?.password}
        hint={mode === "signup" ? "At least 8 characters." : undefined}
      />
      <PrimaryButton
        type="submit"
        disabled={pending}
        label={mode === "signup" ? (pending ? "Creating…" : "Create account") : pending ? "Signing in…" : "Sign in"}
        block
      />
      {mode === "signin" && canSignUp ? (
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-ink-secondary)" }}>
          First time here? <Link href="/sign-in?signup=1">Set up Perch</Link>.
        </p>
      ) : null}
      {mode === "signup" ? (
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-ink-secondary)" }}>
          Already have an account? <Link href="/sign-in">Sign in</Link>.
        </p>
      ) : null}
    </form>
  );
}
