import type { ItemCategory } from "@passbox/client";
import { cn } from "@passbox/ui";
import { CreditCard, FileText, IdCard, KeyRound, type LucideIcon } from "lucide-react";

const icons: Partial<Record<ItemCategory, LucideIcon>> = {
  card: CreditCard,
  note: FileText,
  identity: IdCard,
  other: KeyRound,
};

/** Letter avatar for logins, category icon otherwise. Favicons follow once fetched privately. */
export function ItemIcon({
  title,
  category,
  size = "md",
}: {
  title: string;
  category: ItemCategory;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "size-14 text-xl rounded-2xl" : "size-9 text-sm rounded-lg";
  const iconSize = size === "lg" ? "size-7" : "size-4";
  const Icon = icons[category];
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center bg-accent/10 font-semibold text-accent", box)}
    >
      {Icon ? <Icon className={iconSize} /> : (title.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}
