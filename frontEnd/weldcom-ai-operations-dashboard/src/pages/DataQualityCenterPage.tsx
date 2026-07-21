import { PageSection } from './PageSection';

export function DataQualityCenterPage() {
  return (
    <PageSection
      title="Data Quality Center"
      purpose="Makes data issues transparent so users do not mistake quality issues for machine faults."
      items={[
        'CHECK_DATA / CHECK_ENERGY distribution and trends.',
        'Time quality issue trend, KWh quality issue trend, missing/imputed KWh by machine.',
        'Overlap/gap by machine, open event / invalid duration table.',
        'Top machines with data quality issues using quality_action_level and quality_risk_score.'
      ]}
    />
  );
}
