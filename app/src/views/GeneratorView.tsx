import { Button, SegmentedControl, StrengthMeter, Switch, Tooltip } from "@passbox/ui";
import { Copy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { loadCore } from "../core";
import { ColoredPassword } from "../items/ItemDetail";
import { copyToClipboard } from "../lib/clipboard";
import { useClient } from "../useClient";
import { Page } from "./PageHeader";

type Mode = "password" | "pin";

interface Options {
  length: number;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

export function GeneratorView() {
  const client = useClient();
  const [mode, setMode] = useState<Mode>("password");
  const [options, setOptions] = useState<Options>({ length: 24, digits: true, symbols: true, avoidAmbiguous: false });
  const [pinLength, setPinLength] = useState(6);
  const [value, setValue] = useState("");

  const regenerate = useCallback(async () => {
    const core = await loadCore();
    const json =
      mode === "pin"
        ? { length: pinLength, lowercase: false, uppercase: false, digits: true, symbols: false }
        : options;
    setValue(core.generatePassword(JSON.stringify(json)));
  }, [mode, options, pinLength]);

  useEffect(() => {
    void regenerate();
  }, [regenerate]);

  const strength = client.estimateStrength(value);

  return (
    <Page
      title="Password generator"
      description="Generated on this device with a cryptographically secure random number generator."
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <SegmentedControl
          label="Type"
          value={mode}
          onChange={setMode}
          options={[
            { value: "password", label: "Password" },
            { value: "pin", label: "PIN" },
          ]}
          className="self-start"
        />
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <output
            aria-live="polite"
            className="block min-h-24 break-all px-6 py-6 font-mono text-2xl leading-relaxed tracking-tight"
          >
            <ColoredPassword value={value} />
          </output>
          <div className="flex items-center gap-4 border-t border-border bg-surface-raised px-6 py-3">
            <StrengthMeter score={strength.score} label={strength.label} className="flex-1" />
            <Tooltip content="Generate another">
              <Button variant="ghost" size="icon" aria-label="Generate another" onClick={() => void regenerate()}>
                <RefreshCw />
              </Button>
            </Tooltip>
            <Button onClick={() => copyToClipboard(value, mode === "pin" ? "PIN" : "Password")}>
              <Copy />
              Copy
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-6 shadow-card">
          <label className="flex flex-col gap-3">
            <span className="flex items-center justify-between text-sm font-medium">
              Length
              <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-[13px] tabular-nums">
                {mode === "pin" ? pinLength : options.length}
              </span>
            </span>
            <input
              type="range"
              min={mode === "pin" ? 4 : 8}
              max={mode === "pin" ? 12 : 64}
              value={mode === "pin" ? pinLength : options.length}
              onChange={(e) =>
                mode === "pin"
                  ? setPinLength(Number(e.target.value))
                  : setOptions((o) => ({ ...o, length: Number(e.target.value) }))
              }
              className="accent-accent"
            />
          </label>
          {mode === "password" && (
            <>
              <Switch
                label="Numbers"
                description="Include 0–9"
                checked={options.digits}
                onCheckedChange={(digits) => setOptions((o) => ({ ...o, digits }))}
              />
              <Switch
                label="Symbols"
                description="Include characters like ! @ # $ %"
                checked={options.symbols}
                onCheckedChange={(symbols) => setOptions((o) => ({ ...o, symbols }))}
              />
              <Switch
                label="Avoid ambiguous characters"
                description="Leave out l, 1, I, O and 0, which are easy to confuse"
                checked={options.avoidAmbiguous}
                onCheckedChange={(avoidAmbiguous) => setOptions((o) => ({ ...o, avoidAmbiguous }))}
              />
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
