import type { SsoProvider } from "@passbox/api-client";
import { cn, type MonogramSize, monogramSizes } from "@passbox/ui";
import { BrandIcon } from "@passbox/ui/brand-icon";
import { KeyRound } from "lucide-react";
import { preset } from "./providers";

/**
 * The identity provider's own icon (bundled, see `@passbox/brand-icons`), or
 * a key for a generic OpenID Connect provider. Decorative: the provider's
 * name is written next to it.
 */
export function ProviderIcon({ provider, size = "md" }: { provider: SsoProvider; size?: MonogramSize }) {
  if (provider === "generic") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center bg-surface-sunken text-text-muted",
          monogramSizes[size],
        )}
      >
        <KeyRound />
      </span>
    );
  }
  return <BrandIcon service={provider} name={preset(provider).label} size={size} decorative />;
}
