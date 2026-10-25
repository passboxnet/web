import type { Org, VaultRole } from "@passbox/client";
import { cn } from "@passbox/ui";
import { useId } from "react";
import { useI18n } from "../lib/i18n";
import { type AssignableOrgRole, orgRoleKey, VAULT_ROLES, vaultRoleKey } from "../lib/sharing";

interface Option<T extends string> {
  value: T;
  label: string;
  description: string;
}

/** Radio cards with a one-line explanation per choice. */
export function RadioCards<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[0.8125rem] font-medium">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors coarse:py-3.5",
            value === option.value
              ? "border-accent bg-accent-soft"
              : "border-border bg-surface hover:border-border-strong",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-0.5 size-4 accent-accent"
          />
          <span className="min-w-0">
            <span className="block text-[0.8125rem] font-medium">{option.label}</span>
            <span className="block text-xs text-text-muted">{option.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function OrgRoleChoice({
  org,
  roles,
  value,
  onChange,
}: {
  org: Pick<Org, "kind">;
  roles: AssignableOrgRole[];
  value: AssignableOrgRole;
  onChange: (role: AssignableOrgRole) => void;
}) {
  const { t } = useI18n();
  return (
    <RadioCards
      legend={t("sharing.roleLabel")}
      value={value}
      onChange={onChange}
      options={roles.map((role) => ({
        value: role,
        label: t(orgRoleKey(org, role)),
        description: t(`${orgRoleKey(org, role)}.description`),
      }))}
    />
  );
}

/** Vault roles with an honest note: "view" is enforced by the server, not by encryption. */
export function VaultRoleChoice({ value, onChange }: { value: VaultRole; onChange: (role: VaultRole) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <RadioCards
        legend={t("sharing.vaultRoleLabel")}
        value={value}
        onChange={onChange}
        options={VAULT_ROLES.map((role) => ({
          value: role,
          label: t(vaultRoleKey(role)),
          description: t(`${vaultRoleKey(role)}.description`),
        }))}
      />
      <ViewRoleNote />
    </div>
  );
}

export function ViewRoleNote() {
  const { t } = useI18n();
  return (
    <details className="group text-xs text-text-muted">
      <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-2 hover:text-text">
        {t("sharing.viewNote.summary")}
      </summary>
      <p className="mt-1.5 leading-relaxed">{t("sharing.viewNote.text")}</p>
    </details>
  );
}
