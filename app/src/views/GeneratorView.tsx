import { Button, SegmentedControl, Switch, Tooltip } from "@passbox/ui";
import { Copy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { loadCore } from "../core";
import { ColoredPassword } from "../items/ColoredPassword";
import { PasswordStrength } from "../items/PasswordStrength";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { Page } from "./PageHeader";
import { AliasPanel } from "./security/AliasPanel";

/**
 * - password: random characters, the strongest per character.
 * - words: a passphrase, easy to type on a phone or TV.
 * - readable: no look-alike characters (l, 1, I, O, 0) and no symbols, for reading out loud.
 * - pin: digits only.
 */
type Mode = "password" | "words" | "readable" | "pin";

interface Options {
  length: number;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

interface WordOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  includeDigit: boolean;
}

export function GeneratorView() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("password");
  const [options, setOptions] = useState<Options>({ length: 24, digits: true, symbols: true, avoidAmbiguous: false });
  const [wordOptions, setWordOptions] = useState<WordOptions>({
    words: 5,
    separator: "-",
    capitalize: true,
    includeDigit: true,
  });
  const [readableLength, setReadableLength] = useState(16);
  const [pinLength, setPinLength] = useState(6);
  const [value, setValue] = useState("");

  const regenerate = useCallback(async () => {
    const core = await loadCore();
    switch (mode) {
      case "words":
        setValue(core.generatePassphrase(JSON.stringify(wordOptions)));
        break;
      case "readable":
        setValue(
          core.generatePassword(
            JSON.stringify({ length: readableLength, digits: true, symbols: false, avoidAmbiguous: true }),
          ),
        );
        break;
      case "pin":
        setValue(
          core.generatePassword(
            JSON.stringify({ length: pinLength, lowercase: false, uppercase: false, digits: true, symbols: false }),
          ),
        );
        break;
      default:
        setValue(core.generatePassword(JSON.stringify(options)));
    }
  }, [mode, options, wordOptions, readableLength, pinLength]);

  useEffect(() => {
    void regenerate();
  }, [regenerate]);

  const length =
    mode === "pin"
      ? { value: pinLength, min: 4, max: 12, set: setPinLength }
      : mode === "readable"
        ? { value: readableLength, min: 10, max: 40, set: setReadableLength }
        : mode === "words"
          ? {
              value: wordOptions.words,
              min: 3,
              max: 10,
              set: (words: number) => setWordOptions((o) => ({ ...o, words })),
            }
          : { value: options.length, min: 8, max: 64, set: (n: number) => setOptions((o) => ({ ...o, length: n })) };

  return (
    <Page title={t("term.generator")} description={t("generator.description")}>
      <div className="flex max-w-2xl flex-col gap-6">
        <SegmentedControl
          label={t("generator.type")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "password", label: t("generator.mode.password") },
            { value: "words", label: t("generator.mode.words") },
            { value: "readable", label: t("generator.mode.readable") },
            { value: "pin", label: t("generator.mode.pin") },
          ]}
          className="w-full sm:w-auto sm:self-start"
        />
        <p className="-mt-3 text-[0.8125rem] text-text-muted">{t(`generator.modeHint.${mode}`)}</p>
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <output
            aria-live="polite"
            className="block min-h-24 px-4 py-6 font-mono text-2xl leading-relaxed tracking-tight break-all sm:px-6"
          >
            <ColoredPassword value={value} />
          </output>
          <div className="flex flex-wrap items-center gap-4 border-t border-border bg-surface-raised px-4 py-3 sm:px-6">
            <div className="min-w-48 flex-1">
              <PasswordStrength password={value} />
            </div>
            <Tooltip content={t("generator.another")}>
              <Button variant="ghost" size="icon" aria-label={t("generator.another")} onClick={() => void regenerate()}>
                <RefreshCw />
              </Button>
            </Tooltip>
            <Button
              onClick={() => copyToClipboard(value, mode === "pin" ? t("generator.mode.pin") : t("field.password"))}
            >
              <Copy />
              {t("action.copy")}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-4 shadow-card sm:p-6">
          <label className="flex flex-col gap-3">
            <span className="flex items-center justify-between text-sm font-medium">
              {mode === "words" ? t("generator.words") : t("generator.length")}
              <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-[0.8125rem] tabular-nums">
                {length.value}
              </span>
            </span>
            <input
              type="range"
              min={length.min}
              max={length.max}
              value={length.value}
              onChange={(e) => length.set(Number(e.target.value))}
              className="accent-control coarse:h-8"
            />
          </label>
          {mode === "password" && (
            <>
              <Switch
                label={t("generator.digits")}
                description={t("generator.digitsHint")}
                checked={options.digits}
                onCheckedChange={(digits) => setOptions((o) => ({ ...o, digits }))}
              />
              <Switch
                label={t("generator.symbols")}
                description={t("generator.symbolsHint")}
                checked={options.symbols}
                onCheckedChange={(symbols) => setOptions((o) => ({ ...o, symbols }))}
              />
              <Switch
                label={t("generator.ambiguous")}
                description={t("generator.ambiguousHint")}
                checked={options.avoidAmbiguous}
                onCheckedChange={(avoidAmbiguous) => setOptions((o) => ({ ...o, avoidAmbiguous }))}
              />
            </>
          )}
          {mode === "words" && (
            <>
              <Switch
                label={t("generator.capitalize")}
                checked={wordOptions.capitalize}
                onCheckedChange={(capitalize) => setWordOptions((o) => ({ ...o, capitalize }))}
              />
              <Switch
                label={t("generator.includeDigit")}
                checked={wordOptions.includeDigit}
                onCheckedChange={(includeDigit) => setWordOptions((o) => ({ ...o, includeDigit }))}
              />
              <label className="flex items-center justify-between gap-4 text-sm font-medium">
                {t("generator.separator")}
                <select
                  value={wordOptions.separator}
                  onChange={(e) => setWordOptions((o) => ({ ...o, separator: e.target.value }))}
                  className="h-8 rounded-lg border border-border-strong bg-surface px-2.5 text-[0.8125rem] shadow-xs coarse:h-11"
                >
                  <option value="-">{t("generator.separator.dash")}</option>
                  <option value=" ">{t("generator.separator.space")}</option>
                  <option value=".">{t("generator.separator.dot")}</option>
                  <option value="_">{t("generator.separator.underscore")}</option>
                </select>
              </label>
            </>
          )}
        </div>
        <AliasPanel />
      </div>
    </Page>
  );
}
