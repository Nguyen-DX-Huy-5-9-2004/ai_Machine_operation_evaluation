import { PageSection } from './PageSection';

export function RiskFaultAnalyticsPage() {
  return (
    <PageSection
      title="Risk & Fault Analytics"
      purpose="Deep L2 analysis for technical managers and model investigators."
      items={[
        'Risk fault 10 events / 30 events / 30min / 60min.',
        'Maintenance risk distribution and repair risk distribution.',
        'Target activation chart, reason breakdown, Top-K risky events.',
        'Risk by machine/location/status and policy threshold diagnostics.'
      ]}
    />
  );
}
