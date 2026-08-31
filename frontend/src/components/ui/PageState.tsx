export function PageState({ kind, message }: { kind: "loading" | "error"; message?: string }) {
  if (kind === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border"
            style={{ background: "var(--surface-1)", borderColor: "var(--border-strong)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border p-10 text-center"
      style={{ background: "var(--surface-1)", borderColor: "var(--border-strong)" }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--status-critical)" }}>
        Não foi possível carregar os dados
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {message ?? "Tente novamente em instantes."}
      </p>
    </div>
  );
}
