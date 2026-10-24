import { useState } from "react";
import { UnlockScreen } from "./screens/UnlockScreen";
import { VaultScreen } from "./screens/VaultScreen";

export function App() {
  const [unlocked, setUnlocked] = useState(false);
  return unlocked ? (
    <VaultScreen onLock={() => setUnlocked(false)} />
  ) : (
    <UnlockScreen onUnlock={() => setUnlocked(true)} />
  );
}
