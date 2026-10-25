import { Button, cn } from "@passbox/ui";
import { BrandIcon } from "@passbox/ui/brand-icon";
import { Copy } from "lucide-react";
import { useId, useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";

type ClientId = "claudeCode" | "claudeDesktop" | "cursor" | "vscode" | "codex";

interface AgentClient {
  id: ClientId;
  name: string;
  /** Bundled icon (`@passbox/brand-icons`). */
  icon: string;
  snippet: (server: string) => string;
}

const json = (server: string) =>
  JSON.stringify(
    {
      mcpServers: {
        passbox: {
          command: "pbx",
          args: ["mcp"],
          env: { PASSBOX_SERVER: server, PASSBOX_SERVICE_ACCOUNT_TOKEN: "pbx_sa_…" },
        },
      },
    },
    null,
    2,
  );

/** The setups of docs/architecture/ai-agents.md, with this server's address filled in. */
export const AGENT_CLIENTS: readonly AgentClient[] = [
  {
    id: "claudeCode",
    name: "Claude Code",
    icon: "claude",
    snippet: (server) => `claude mcp add passbox \\
  --env PASSBOX_SERVER=${server} \\
  --env PASSBOX_SERVICE_ACCOUNT_TOKEN=pbx_sa_… \\
  -- pbx mcp`,
  },
  { id: "claudeDesktop", name: "Claude Desktop", icon: "claude", snippet: json },
  { id: "cursor", name: "Cursor", icon: "cursor", snippet: json },
  {
    id: "vscode",
    name: "VS Code",
    icon: "vscode",
    snippet: (server) =>
      JSON.stringify(
        {
          inputs: [
            {
              type: "promptString",
              id: "passbox-token",
              description: "Passbox service account token",
              password: true,
            },
          ],
          servers: {
            passbox: {
              type: "stdio",
              command: "pbx",
              args: ["mcp"],
              // VS Code's own input syntax, not a template string.
              // biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${input:…} for VS Code
              env: { PASSBOX_SERVER: server, PASSBOX_SERVICE_ACCOUNT_TOKEN: "${input:passbox-token}" },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "codex",
    name: "Codex",
    icon: "openai",
    snippet: (server) => `[mcp_servers.passbox]
command = "pbx"
args = ["mcp"]
env = { PASSBOX_SERVER = "${server}", PASSBOX_SERVICE_ACCOUNT_TOKEN = "pbx_sa_…" }`,
  },
];

/** "Connect an agent": pick the agent, see where the configuration goes, copy it. */
export function AgentSetupSnippets({ server }: { server: string }) {
  const { t } = useI18n();
  const name = useId();
  const [selected, setSelected] = useState<ClientId>("claudeCode");
  const client = AGENT_CLIENTS.find((c) => c.id === selected) ?? AGENT_CLIENTS[0];
  if (!client) return null;
  const snippet = client.snippet(server);
  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">{t("agent.setup.client")}</legend>
        {AGENT_CLIENTS.map((c) => (
          <label
            key={c.id}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2 rounded-lg border py-1 pr-3 pl-1.5 text-[0.8125rem] font-medium transition-colors coarse:h-11",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
              selected === c.id
                ? "border-accent bg-accent-soft text-text"
                : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
            )}
          >
            <input
              type="radio"
              name={name}
              value={c.id}
              checked={selected === c.id}
              onChange={() => setSelected(c.id)}
              className="sr-only"
            />
            <BrandIcon service={c.icon} name={c.name} size="sm" decorative />
            {c.name}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-text-muted">{t(`agent.setup.where.${client.id}`)}</p>
      <div className="relative">
        <pre
          className="overflow-x-auto rounded-md bg-surface-sunken px-3 py-2 pr-12 font-mono text-xs"
          data-testid="agent-snippet"
        >
          {snippet}
        </pre>
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-1 right-1"
          aria-label={t("agent.setup.copy")}
          onClick={() => void copyToClipboard(snippet, t("agent.setup.configuration"))}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}
