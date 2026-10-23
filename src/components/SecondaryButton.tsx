import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type Base = {
  label: string;
  tone?: "default" | "danger";
  size?: "md" | "sm";
  block?: boolean;
  children?: ReactNode;
};

type ButtonProps = Base &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { href?: undefined };
type AnchorProps = Base &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & { href: string };

export type SecondaryButtonProps = ButtonProps | AnchorProps;

export function SecondaryButton(props: SecondaryButtonProps) {
  const { label, tone = "default", size = "md", block, children, ...rest } = props;
  const cls = [
    "perch-btn",
    tone === "danger" ? "perch-btn--danger" : "perch-btn--secondary",
    size === "sm" ? "perch-btn--small" : "",
    block ? "perch-btn--block" : "",
  ]
    .filter(Boolean)
    .join(" ");
  if ("href" in rest && rest.href) {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children ?? label}
      </a>
    );
  }
  const { type = "button", ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={cls} type={type} {...buttonRest}>
      {children ?? label}
    </button>
  );
}
