import { Toaster, TooltipProvider, UiStringsProvider } from "@passbox/ui";
import { type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyLocale, useI18n } from "./lib/i18n";
import { applyTheme, getPreferences, subscribePreferences } from "./lib/preferences";
import { captureOrgInvite } from "./lib/sharing";
import "./styles.css";

applyTheme(getPreferences().theme);
applyLocale();
// An invitation link (`/invite/{token}#org=…`) is kept for this tab before routing starts.
captureOrgInvite();
subscribePreferences(() => applyLocale());

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

/** Passes translated labels to the shared components (dialogs, password fields). */
function Localized({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <UiStringsProvider
      strings={{
        close: t("action.close"),
        cancel: t("action.cancel"),
        showPassword: t("ui.showPassword"),
        hidePassword: t("ui.hidePassword"),
        capsLockOn: t("error.capsLock"),
      }}
    >
      {children}
    </UiStringsProvider>
  );
}

createRoot(root).render(
  <StrictMode>
    <Localized>
      <TooltipProvider>
        <App />
        {/* Bottom center keeps toasts away from the sidebar and the controls at the right edge. */}
        <Toaster position="bottom-center" duration={4000} />
      </TooltipProvider>
    </Localized>
  </StrictMode>,
);
