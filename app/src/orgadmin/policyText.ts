import type { PolicyRules } from "@passbox/api-client";
import type { Translate } from "@passbox/i18n";

/**
 * One plain-language line per rule, always in the same order (so two rule
 * sets can be compared line by line).
 */
export function describeRules(rules: PolicyRules, t: Translate): string[] {
  return [
    rules.requireTwoFactor ? t("orgAdmin.rule.twoFactor.on") : t("orgAdmin.rule.twoFactor.off"),
    rules.minPasswordScore > 0
      ? t("orgAdmin.rule.minScore.on", { level: t(`strength.${rules.minPasswordScore}`) })
      : t("orgAdmin.rule.minScore.off"),
    rules.maxAutoLockMinutes > 0
      ? t("orgAdmin.rule.autoLock.on", { count: rules.maxAutoLockMinutes })
      : t("orgAdmin.rule.autoLock.off"),
    rules.forbidExport ? t("orgAdmin.rule.export.on") : t("orgAdmin.rule.export.off"),
    rules.forbidExternalSharing ? t("orgAdmin.rule.external.on") : t("orgAdmin.rule.external.off"),
    rules.allowPersonalVault ? t("orgAdmin.rule.personal.on") : t("orgAdmin.rule.personal.off"),
    rules.shareLinks === "forbidden"
      ? t("orgAdmin.rule.links.forbidden")
      : rules.shareLinks === "restricted"
        ? rules.shareLinkMaxViews > 0
          ? t("orgAdmin.rule.links.restrictedViews", { days: rules.shareLinkMaxDays, views: rules.shareLinkMaxViews })
          : t("orgAdmin.rule.links.restricted", { days: rules.shareLinkMaxDays })
        : t("orgAdmin.rule.links.allowed"),
    rules.requireRecoveryEnrollment ? t("orgAdmin.rule.recovery.on") : t("orgAdmin.rule.recovery.off"),
    rules.reportItemUsage ? t("orgAdmin.rule.usage.on") : t("orgAdmin.rule.usage.off"),
  ];
}

/** Only the lines of rules that restrict something, for members. */
export function activeRules(rules: PolicyRules, t: Translate): string[] {
  const lines = describeRules(rules, t);
  const restricting = [
    rules.requireTwoFactor,
    rules.minPasswordScore > 0,
    rules.maxAutoLockMinutes > 0,
    rules.forbidExport,
    rules.forbidExternalSharing,
    !rules.allowPersonalVault,
    rules.shareLinks !== "allowed",
    rules.requireRecoveryEnrollment,
    rules.reportItemUsage,
  ];
  return lines.filter((_, index) => restricting[index]);
}
