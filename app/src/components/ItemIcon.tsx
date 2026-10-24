import { cn } from "@passbox/ui";
import { CreditCard, FileText } from "lucide-react";
import type { VaultItem } from "../sampleData";

/** Letter avatar for logins, category icon otherwise. Favicons follow once fetched privately. */
export function ItemIcon({ item, size = "md" }: { item: VaultItem; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-14 text-xl rounded-2xl" : "size-9 text-sm rounded-lg";
  const icon = size === "lg" ? "size-7" : "size-4";
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center bg-accent/10 font-semibold text-accent", box)}
    >
      {item.category === "card" ? (
        <CreditCard className={icon} />
      ) : item.category === "note" ? (
        <FileText className={icon} />
      ) : (
        item.title.charAt(0).toUpperCase()
      )}
    </span>
  );
}
