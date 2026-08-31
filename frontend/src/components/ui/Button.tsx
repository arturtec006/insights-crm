import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "var(--accent-ink)" },
    secondary: { background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--text-secondary)" },
    danger: { background: "var(--status-critical)", color: "#fff" },
  };

  return <button className={clsx(base, className)} style={styles[variant]} {...rest} />;
}
