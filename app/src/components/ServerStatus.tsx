import { createClient, type ServerMeta } from "@passbox/api-client";
import { useEffect, useState } from "react";

type State = { kind: "checking" } | { kind: "online"; meta: ServerMeta } | { kind: "offline" };

const api = createClient();

export function ServerStatus() {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    api
      .meta()
      .then((meta) => setState({ kind: "online", meta }))
      .catch(() => setState({ kind: "offline" }));
  }, []);

  const text =
    state.kind === "checking"
      ? "Checking server…"
      : state.kind === "online"
        ? `Connected to ${window.location.host} · Passbox ${state.meta.version}`
        : "Server not reachable";
  const dot = state.kind === "online" ? "bg-success" : state.kind === "offline" ? "bg-danger" : "bg-warning";
  return (
    <p className="mt-4 flex items-center justify-center gap-2 text-xs text-text-muted" role="status">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </p>
  );
}
