import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type Base = {
  label: string;
  size?: "md" | "sm";
  block?: boolean;
  children?: ReactNode;
};

type ButtonProps = Base &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { href?: undefined };
type AnchorProps = Base &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & { href: string };

export type PrimaryButtonProps = ButtonProps | AnchorProps;

export function PrimaryButton(props: PrimaryButtonProps) {
  const { label, size = "md", block, children, ...rest } = props;
  const cls = [
    "perch-btn",
    "perch-btn--primary",
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
  const { type = "submit", ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={cls} type={type} {...buttonRest}>
      {children ?? label}
    </button>
  );
}
