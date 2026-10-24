import { useEffect, useState } from "react";
import { loadCore } from "../core";

type Core = Awaited<ReturnType<typeof loadCore>>;

/** Returns the loaded Passbox core, or undefined while it is still loading. */
export function useCore(): Core | undefined {
  const [core, setCore] = useState<Core>();
  useEffect(() => {
    let active = true;
    loadCore().then((loaded) => {
      if (active) setCore(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return core;
}
