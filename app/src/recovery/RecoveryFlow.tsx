import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useClient } from "../useClient";

/**
 * The signed-out and locked flows that replace the sign-in or unlock screen
 * for a while: recovery with the recovery code, recovery through the
 * organization, setting the new master password, and signing in with a code
 * from another device.
 */
export type RecoveryScreen = "code" | "org" | "newPassword" | "linkDevice";

interface RecoveryFlowState {
  screen: RecoveryScreen | undefined;
  start: (screen: RecoveryScreen) => void;
  close: () => void;
}

const RecoveryFlowContext = createContext<RecoveryFlowState | undefined>(undefined);

export function useRecoveryFlow(): RecoveryFlowState {
  const flow = useContext(RecoveryFlowContext);
  if (!flow) throw new Error("useRecoveryFlow must be used inside RecoveryFlowProvider");
  return flow;
}

export function RecoveryFlowProvider({ children }: { children: ReactNode }) {
  const client = useClient();
  const [screen, setScreen] = useState<RecoveryScreen>();
  const start = useCallback((next: RecoveryScreen) => setScreen(next), []);
  const close = useCallback(() => {
    client.cancelRecovery();
    client.cancelDeviceLinkClaim();
    setScreen(undefined);
  }, [client]);
  const value = useMemo(() => ({ screen, start, close }), [screen, start, close]);
  return <RecoveryFlowContext.Provider value={value}>{children}</RecoveryFlowContext.Provider>;
}
