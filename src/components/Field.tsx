import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type CommonProps = {
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
  required?: boolean;
};

export type InputFieldProps = CommonProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "prefix"> & {
    type?: InputHTMLAttributes<HTMLInputElement>["type"];
    multiline?: false;
  };

export type TextareaFieldProps = CommonProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "prefix"> & {
    multiline: true;
  };

export type FieldProps = InputFieldProps | TextareaFieldProps;

export const Field = forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldProps>(
  function FieldImpl(props, ref) {
    const { label, hint, error, prefix, required, ...rest } = props;
    const id = (rest.id as string | undefined) ?? `field-${(rest.name as string | undefined) ?? label}`;
    const errId = error ? `${id}-error` : undefined;
    const hintId = hint ? `${id}-hint` : undefined;
    const describedBy = [errId, hintId].filter(Boolean).join(" ") || undefined;
    const multiline = (rest as TextareaFieldProps).multiline === true;
    // Keep the `multiline` prop from leaking onto the actual DOM element.
    const { multiline: _m, ...passthrough } = rest as { multiline?: boolean };
    void _m;
    const classes = ["perch-field", error ? "is-error" : "", multiline ? "perch-field--multiline" : ""]
      .filter(Boolean)
      .join(" ");
    return (
      <div className={classes}>
        <label className="perch-field__label" htmlFor={id}>
          <span>{label}</span>
          {required ? (
            <span className="perch-field__required" aria-hidden="true">
              ·
            </span>
          ) : null}
          {required ? <span className="visually-hidden">required</span> : null}
        </label>
        <div className="perch-field__input-wrap">
          {prefix ? <span className="perch-field__prefix">{prefix}</span> : null}
          {multiline ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              id={id}
              className="perch-field__input"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              aria-required={required ? true : undefined}
              {...(passthrough as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              id={id}
              className="perch-field__input"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              aria-required={required ? true : undefined}
              {...(passthrough as InputHTMLAttributes<HTMLInputElement>)}
            />
          )}
        </div>
        {error ? (
          <div className="perch-field__error" id={errId} role="alert">
            {error}
          </div>
        ) : hint ? (
          <div className="perch-field__hint" id={hintId}>
            {hint}
          </div>
        ) : (
          <div className="perch-field__hint" aria-hidden="true" />
        )}
      </div>
    );
  }
);
