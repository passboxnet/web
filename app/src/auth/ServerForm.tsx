import { Button, Input } from "@passbox/ui";
import { Server } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useI18n } from "../lib/i18n";
import {
  canUseOwnOrigin,
  changeServer,
  parseServerUrl,
  ServerUrlError,
  serverApi,
  serverLabel,
  storedServerUrl,
} from "../lib/server";
import { FormError } from "./AuthLayout";

/** Chooses the Passbox server. Only shown while signed out; saving reloads the app. */
export function ServerForm({ onCancel }: { onCancel?: (() => void) | undefined }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const stored = storedServerUrl();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    let url: string;
    try {
      url = parseServerUrl(String(new FormData(event.currentTarget).get("server")));
    } catch (e) {
      setError(e instanceof ServerUrlError ? t(`server.error.${e.code}`) : t("server.error.invalid"));
      return;
    }
    setBusy(true);
    try {
      const meta = await serverApi(url).meta();
      if (meta.name !== "passbox") throw new Error("not a Passbox server");
    } catch {
      setError(t("server.error.unreachable", { server: serverLabel(url) }));
      setBusy(false);
      return;
    }
    changeServer(url);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-title text-text">{onCancel ? t("server.title.change") : t("server.title.connect")}</h1>
        <p className="mt-1.5 text-sm text-text-muted">{t("server.description")}</p>
      </div>
      <Input
        label={t("server.label")}
        name="server"
        type="text"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        placeholder={t("server.placeholder")}
        defaultValue={stored ?? ""}
        leading={<Server />}
        autoFocus
        required
      />
      <FormError message={error} />
      <Button type="submit" size="lg" shape="pill" loading={busy}>
        {busy ? t("server.checking") : t("server.connect")}
      </Button>
      {(onCancel || (canUseOwnOrigin && stored)) && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className={linkClass}>
              {t("action.cancel")}
            </button>
          )}
          {canUseOwnOrigin && stored && (
            <button type="button" onClick={() => changeServer(undefined)} className={linkClass}>
              {t("server.useOwn", { host: window.location.host })}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

export const linkClass =
  "rounded text-[0.8125rem] text-text-muted underline-offset-4 hover:text-text hover:underline coarse:py-2.5";
