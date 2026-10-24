import { SegmentedControl } from "@passbox/ui";
import { useI18n } from "../lib/i18n";
import { Page } from "../views/PageHeader";
import { AgentsSection } from "./AgentsSection";
import { ServiceAccountsSection } from "./ServiceAccountsSection";

export type DeveloperSection = "agents" | "service-accounts";

/**
 * Developer tools (wave F): AI agent requests and activity (F7), and
 * service accounts for CI, servers and agents (F2).
 */
export function DeveloperView({
  section,
  onSection,
}: {
  section: DeveloperSection;
  onSection: (section: DeveloperSection) => void;
}) {
  const { t } = useI18n();
  return (
    <Page
      title={t("developer.title")}
      description={t("developer.description")}
      actions={
        <SegmentedControl
          label={t("developer.sections")}
          value={section}
          onChange={onSection}
          options={[
            { value: "agents", label: t("developer.agents") },
            { value: "service-accounts", label: t("developer.serviceAccounts") },
          ]}
        />
      }
    >
      {section === "agents" ? <AgentsSection onShowServiceAccounts={() => onSection("service-accounts")} /> : <ServiceAccountsSection />}
    </Page>
  );
}
