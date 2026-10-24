import type { ClientAuditAction } from "@passbox/client";
import { createContext, useContext } from "react";

/**
 * Reports what the user does with the open item (D3) when its
 * organization's policy asks for item usage. `ItemDetail` provides it; the
 * field components call it when a secret is revealed or a value copied.
 * Outside an item (or for personal vaults) it does nothing.
 */
export type ReportUsage = (action: ClientAuditAction, field?: string) => void;

export const ItemUsageContext = createContext<ReportUsage>(() => undefined);

export function useItemUsage(): ReportUsage {
  return useContext(ItemUsageContext);
}
