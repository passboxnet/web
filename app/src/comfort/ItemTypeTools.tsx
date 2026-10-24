import { FIELD, type Item, type ItemData, type ItemField, wifiQrPayload } from "@passbox/client";
import { Button, ConfirmDialog, toast } from "@passbox/ui";
import { KeyRound, QrCode as QrIcon } from "lucide-react";
import { useState } from "react";
import { loadCore } from "../core";
import { useI18n } from "../lib/i18n";
import { QrCode } from "../views/settings/TwoFactorPanel";

/**
 * "Join Wi-Fi" for Wi-Fi items (G3): a QR code that phone cameras offer
 * to join. It contains the password, so it is shown on request only.
 */
export function WifiJoinCard({ item }: { item: Item }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const payload = wifiQrPayload(item.data);
  if (!payload) return null;
  return (
    <div className="mt-4 rounded-card border border-border bg-surface px-4 py-3 shadow-card" data-testid="wifi-qr">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.8125rem] font-medium">{t("wifi.join.title")}</p>
          <p className="text-xs text-text-muted">{t("wifi.join.text")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShown(!shown)} aria-expanded={shown}>
          <QrIcon />
          {shown ? t("wifi.join.hide") : t("wifi.join.show")}
        </Button>
      </div>
      {shown && (
        <div className="mt-3 flex justify-center">
          <QrCode
            text={payload}
            label={t("wifi.join.qrLabel", { name: item.data.fields.find((f) => f.id === FIELD.wifiSsid)?.value ?? "" })}
          />
        </div>
      )}
    </div>
  );
}

function withValues(data: ItemData, values: Record<string, string>): ItemData {
  return {
    ...data,
    fields: data.fields.map((f: ItemField) => (values[f.id] !== undefined ? { ...f, value: values[f.id] ?? "" } : f)),
  };
}

/** Fills the public key and fingerprint of an SSH key item from its private key, if they are empty. */
export async function completeSshKey(data: ItemData): Promise<ItemData> {
  if (data.category !== "sshKey") return data;
  const get = (id: string) => data.fields.find((f) => f.id === id)?.value.trim() ?? "";
  const privateKey = get(FIELD.privateKey);
  if (!privateKey || (get(FIELD.publicKey) && get(FIELD.fingerprint))) return data;
  try {
    const core = await loadCore();
    const derived = JSON.parse(core.sshPublicKey(privateKey)) as { publicKey: string; fingerprint: string };
    return withValues(data, {
      [FIELD.publicKey]: get(FIELD.publicKey) || derived.publicKey,
      [FIELD.fingerprint]: get(FIELD.fingerprint) || derived.fingerprint,
    });
  } catch {
    // Other key types or passphrase-protected keys: kept as entered.
    return data;
  }
}

/** "Generate key" in the editor of SSH key items: a new Ed25519 key pair made on this device. */
export function SshKeyGenerator({
  data,
  onChange,
}: {
  data: ItemData;
  onChange: (update: (data: ItemData) => ItemData) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (data.category !== "sshKey") return null;
  const hasKey = Boolean(data.fields.find((f) => f.id === FIELD.privateKey)?.value.trim());

  async function generate() {
    setBusy(true);
    try {
      const core = await loadCore();
      const pair = JSON.parse(core.sshGenerateEd25519(data.title.trim())) as {
        privateKey: string;
        publicKey: string;
        fingerprint: string;
      };
      onChange((d) =>
        withValues(d, {
          [FIELD.privateKey]: pair.privateKey,
          [FIELD.publicKey]: pair.publicKey,
          [FIELD.fingerprint]: pair.fingerprint,
        }),
      );
      toast.success(t("ssh.generated"), { description: t("ssh.generatedHint") });
    } catch (error) {
      toast.error(t("ssh.generateFailed"), { description: String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card">
      <KeyRound className="size-4 shrink-0 text-accent" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[0.8125rem]">{hasKey ? t("ssh.replaceText") : t("ssh.generateText")}</p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => (hasKey ? setConfirm(true) : void generate())}
        loading={busy}
        data-testid="ssh-generate"
      >
        {hasKey ? t("ssh.replace") : t("ssh.generate")}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("ssh.replaceTitle")}
        description={t("ssh.replaceConfirm")}
        confirmLabel={t("ssh.replace")}
        tone="danger"
        onConfirm={() => void generate()}
      />
    </div>
  );
}
