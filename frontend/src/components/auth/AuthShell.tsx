import type { ReactNode } from "react";

// The centred card shared by login, "forgot password" and "reset password".
// These three screens are the only ones a signed-out person ever sees, so they
// should look like one place rather than three.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--surface-0)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            IC
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>

        <div
          className="rounded-xl border p-6"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-strong)" }}
        >
          {children}
        </div>

        {footer && <div className="mt-4 text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
}

/** The form field used across the auth screens. */
export function AuthField({
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  required = true,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <input
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
        style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
      />
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function AuthAlert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const color = kind === "error" ? "var(--status-critical-text)" : "var(--status-good-text)";
  const bg = kind === "error" ? "var(--status-critical)" : "var(--status-good)";
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm"
      style={{ background: `color-mix(in oklab, ${bg} 14%, transparent)`, color }}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

/** The password policy, written where someone is about to choose one. */
export const PASSWORD_HINT = "Ao menos 10 caracteres, com maiúscula, minúscula e número.";
