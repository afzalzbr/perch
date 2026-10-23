"use client";

import { useActionState } from "react";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Flash } from "@/components/Flash";
import { createProfileAction, type SetupState } from "./actions";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(createProfileAction, {});
  return (
    <form action={action} className="app-stack" aria-busy={pending}>
      {state.message && !state.fieldErrors ? <Flash tone="danger">{state.message}</Flash> : null}
      <Field
        label="Display name"
        name="displayName"
        required
        maxLength={60}
        hint="Shown at the top of your public page."
        error={state.fieldErrors?.displayName}
      />
      <Field
        label="Handle"
        name="slug"
        required
        maxLength={32}
        prefix="perch.app/"
        hint="Lowercase letters, numbers, and hyphens."
        error={state.fieldErrors?.slug}
      />
      <PrimaryButton
        type="submit"
        disabled={pending}
        label={pending ? "Reserving…" : "Save and continue"}
        block
      />
    </form>
  );
}
