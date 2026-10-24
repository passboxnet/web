import { Button, Dialog, PasswordInput } from "@passbox/ui";
import { createContext, type FormEvent, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { errorMessage, nextFrame } from "../core";
import { useI18n } from "../lib/i18n";
import { isKitPending, setKitPending } from "../lib/kit";
import { useClient, useSnapshot } from "../useClient";
import { FormError } from "./AuthLayout";

/**
 * Where the Emergency Kit is shown from. "onboarding" right after sign-up (and
 * after every unlock until the kit is confirmed), "review" from Settings, the
 * reminder banner or the sign-out dialog.
 */
export type KitMode = "onboarding" | "review";

interface KitState {
  /** Whether the kit screen is showing. */
  open: boolean;
  mode: KitMode;
  /** The kit has not been confirmed yet on this device. */
  pending: boolean;
  /** The user chose "Do this later" in this session; the reminder banner shows instead. */
  deferred: boolean;
  /** Set when the kit should open as soon as the vault is unlocked. */
  afterUnlock: boolean;
  /** Shows the kit right after sign-up, without asking for the password again. */
  startOnboarding: (accountId: string) => void;
  /** Asks for the master password (or to unlock first), then shows the kit. */
  requestKit: () => void;
  /** Kit confirmed: clears the pending flag. */
  confirm: () => void;
  close: () => void;
  later: () => void;
}

const KitContext = createContext<KitState | undefined>(undefined);

export function useKit(): KitState {
  const kit = useContext(KitContext);
  if (!kit) throw new Error("useKit must be used inside KitProvider");
  return kit;
}

export function KitProvider({ children }: { children: ReactNode }) {
  const client = useClient();
  const { status } = useSnapshot();
  const accountId = client.deviceAccount?.accountId;
  const [pending, setPending] = useState(() => isKitPending(accountId));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<KitMode>("onboarding");
  const [deferred, setDeferred] = useState(false);
  const [afterUnlock, setAfterUnlock] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);

  // The flag belongs to one account on this device; re-read it when that changes.
  useEffect(() => {
    setPending(isKitPending(accountId));
  }, [accountId]);

  // Each unlock shows a pending kit again (unless postponed in this session),
  // and a kit requested on the unlock screen opens right after unlocking.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only runs when the vault locks or unlocks
  useEffect(() => {
    if (status !== "unlocked") {
      setOpen(false);
      return;
    }
    if (afterUnlock) {
      setAfterUnlock(false);
      setMode("review");
      setOpen(true);
    } else if (isKitPending(accountId) && !deferred) {
      setMode("onboarding");
      setOpen(true);
    }
  }, [status]);

  const startOnboarding = useCallback((id: string) => {
    setKitPending(id);
    setPending(true);
    setDeferred(false);
    setMode("onboarding");
    setOpen(true);
  }, []);

  const requestKit = useCallback(() => {
    if (client.getSnapshot().status === "unlocked") setReauthOpen(true);
    else setAfterUnlock(true);
  }, [client]);

  const value: KitState = {
    open,
    mode,
    pending,
    deferred,
    afterUnlock,
    startOnboarding,
    requestKit,
    confirm: () => {
      setKitPending(undefined);
      setPending(false);
    },
    close: () => setOpen(false),
    later: () => {
      setDeferred(true);
      setOpen(false);
    },
  };

  return (
    <KitContext.Provider value={value}>
      {children}
      <ReauthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        onVerified={() => {
          setReauthOpen(false);
          setMode("review");
          setOpen(true);
        }}
      />
    </KitContext.Provider>
  );
}

/** Asks for the master password again and checks it on this device. */
export function ReauthDialog({
  open,
  onOpenChange,
  onVerified,
  title,
  description,
  submitLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password"));
    setBusy(true);
    setError(undefined);
    await nextFrame();
    try {
      if (await client.verifyMasterPassword(password)) {
        form.reset();
        onVerified();
      } else {
        setError(t("error.wrongMasterPassword"));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setError(undefined);
        onOpenChange(next);
      }}
      title={title ?? t("reauth.title")}
      description={description ?? t("reauth.description")}
      size="sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordInput
          label={t("term.masterPassword")}
          name="password"
          autoComplete="current-password"
          autoFocus
          required
        />
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {busy ? t("reauth.checking") : (submitLabel ?? t("reauth.submit"))}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
