import { PageSection } from './PageSection';

export function EnergyConsistencyPage() {
  return (
    <PageSection
      title="Energy Consistency"
      purpose="Checks contradictions between loaded state and KWh behavior."
      items={[
        'Loaded but zero KWh, loaded but missing KWh, negative KWh delta.',
        'KWh rate outlier, energy issue by machine, energy issue by location.',
        'UX note: cabinet daily KWh is location/cabinet-level context, not a direct machine-level bridge.'
      ]}
    />
  );
}
