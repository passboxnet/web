import type { ItemCategory } from "@passbox/client";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@passbox/ui";
import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import { CATEGORY_META, CREATABLE_GROUPS } from "../lib/items";

/** The menu of item types behind "Neuer Eintrag" and the round "+" in the list. */
export function NewItemMenu({
  children,
  onCreate,
  align = "start",
  side,
}: {
  /** The trigger (a button). */
  children: ReactNode;
  onCreate: (category: ItemCategory) => void;
  align?: "start" | "end" | "center";
  side?: "top" | "bottom";
}) {
  const { t } = useI18n();
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align={align} {...(side ? { side } : {})} className="max-h-[min(32rem,70vh)] w-56 overflow-y-auto">
        {CREATABLE_GROUPS.map((group, index) => (
          <div key={group[0]}>
            {index > 0 && <MenuSeparator />}
            {group.map((category) => {
              const { label, icon: Icon } = CATEGORY_META[category];
              return (
                <MenuItem key={category} icon={<Icon />} onSelect={() => onCreate(category)}>
                  {t(label)}
                </MenuItem>
              );
            })}
          </div>
        ))}
      </MenuContent>
    </Menu>
  );
}
