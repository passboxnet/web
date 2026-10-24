import { Button } from "@passbox/ui";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "./CopyButton";
import { ColoredPassword } from "./ItemDetail";
import { useCore } from "./useCore";

interface Options {
  length: number;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

export function GeneratorPanel() {
  const core = useCore();
  const [options, setOptions] = useState<Options>({
    length: 20,
    digits: true,
    symbols: true,
    avoidAmbiguous: false,
  });
  const [password, setPassword] = useState("");

  const regenerate = useCallback(() => {
    if (core) setPassword(core.generatePassword(JSON.stringify(options)));
  }, [core, options]);

  useEffect(regenerate, [regenerate]);

  const toggle = (key: "digits" | "symbols" | "avoidAmbiguous") => setOptions((o) => ({ ...o, [key]: !o[key] }));

  return (
    <section aria-label="Password generator" className="flex-1 overflow-y-auto p-8">
      <h1 className="mb-6 text-2xl font-semibold">Password generator</h1>
      <div className="max-w-xl rounded-card border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-4 py-3">
          <output className="break-all font-mono text-lg" aria-live="polite">
            <ColoredPassword value={password} />
          </output>
          <span className="flex shrink-0">
            <Button variant="ghost" size="sm" onClick={regenerate} aria-label="Generate new password">
              <RefreshCw className="size-4" />
            </Button>
            <CopyButton value={password} label="password" />
          </span>
        </div>
        <label className="mt-6 flex flex-col gap-2 text-sm">
          <span className="flex justify-between">
            Length <span className="font-mono">{options.length}</span>
          </span>
          <input
            type="range"
            min={8}
            max={64}
            value={options.length}
            onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) }))}
            className="accent-accent"
          />
        </label>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <Toggle label="Digits (0-9)" checked={options.digits} onChange={() => toggle("digits")} />
          <Toggle label="Symbols (!@#…)" checked={options.symbols} onChange={() => toggle("symbols")} />
          <Toggle
            label="Avoid ambiguous characters (l, 1, O, 0)"
            checked={options.avoidAmbiguous}
            onChange={() => toggle("avoidAmbiguous")}
          />
        </div>
      </div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 accent-accent" />
      {label}
    </label>
  );
}
