import { ApiError } from "@passbox/api-client";
import { errorMessage } from "../core";
import type { Translator } from "../lib/i18n";

/** Messages for moves, attachments, share links and access requests: what happened and what to do. */
export function comfortError(error: unknown, t: Translator["t"]): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "policy_violation":
        return error.path.includes("share-links") ? t("shareLink.error.policy") : t("move.error.policy");
      case "quota_exceeded":
        return t("attachments.error.quota");
      case "file_too_large":
        return t("attachments.error.tooLarge", { message: error.message });
      case "rate_limited":
        return t("comfort.error.rateLimited");
      case "not_found":
        if (error.path.includes("access-request")) return t("accessRequest.error.notFound");
        break;
      case "conflict":
        if (error.path.includes("access-request")) {
          return /share the vault/.test(error.message)
            ? t("accessRequest.error.shareFirst")
            : /already asked/.test(error.message)
              ? t("accessRequest.error.pending")
              : t("accessRequest.error.decided");
        }
        break;
    }
  }
  return errorMessage(error);
}
