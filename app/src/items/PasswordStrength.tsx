import { StrengthMeter } from "@passbox/ui";
import { CheckCircle2, Info } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";

/**
 * Strength meter with the reason and tips in plain language, for example
 * "Years are easy to guess." `context` adds words an attacker would try
 * first, such as the email typed during sign-up.
 */
export function PasswordStrength({
  password,
  context = [],
  master = false,
}: {
  password: string;
  context?: string[];
  /** Also say whether it is good enough for a master password. */
  master?: boolean;
}) {
  const client = useClient();
  const { t } = useI18n();
  const strength = client.estimateStrength(password, context.filter(Boolean));
  const tips = [
    ...(strength.warning ? [t(`strength.warning.${strength.warning}`)] : []),
    ...strength.suggestions.map((code) => t(`strength.suggestion.${code}`)),
  ];
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <StrengthMeter score={strength.score} label={t(`strength.${strength.score}`)} />
      {master && strength.acceptableMasterPassword ? (
        <p className="flex items-center gap-1.5 text-xs text-success-text">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {t("signUp.acceptable")}
        </p>
      ) : (
        tips.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-text-muted">
            {tips.slice(0, 3).map((tip) => (
              <li key={tip} className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {tip}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
