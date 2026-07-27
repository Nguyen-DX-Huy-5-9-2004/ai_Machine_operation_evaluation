import type { EnergySummary } from "../../types/machineDetail";
import { formatMachineNumber } from '../../utils/machineDetailCharts';
import { InfoDot } from "./InfoDot";
import { useUiText } from '../../i18n/appTranslations';

interface Props {
  summary: EnergySummary;
}

export function EnergySummaryStrip({ summary }: Props) {
  const t = useUiText();
  const availability = [
    { label: "Raw", value: summary.kwhAvailability.rawPct, className: "raw" },
    {
      label: "Imputed",
      value: summary.kwhAvailability.imputedPct,
      className: "imputed",
    },
    {
      label: "Missing",
      value: summary.kwhAvailability.missingPct,
      className: "missing",
    },
  ];
  return (
    <section className="md-panel md-energy-strip">
      <div className="md-summary-card availability">
        <div className="summary-title">
          {t('KWh Availability')}{" "}
          <InfoDot text="Breakdown of KWh evidence quality for recent events: raw, imputed, or missing." />
        </div>
        <div className="availability-body">
          <div
            className="availability-ring"
            style={
              {
                "--raw": `${summary.kwhAvailability.rawPct}%`,
                "--imputed": `${summary.kwhAvailability.imputedPct}%`,
              } as React.CSSProperties
            }
          />
          <div>
            {availability.map((item) => (
              <div className="summary-line" key={item.label}>
                <i className={item.className} />
                {t(item.label)}
                <b>{formatMachineNumber(item.value)}%</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SummaryCard
        label={t('KWh Delta (24h)')}
        value={`${summary.kwhDelta24h >= 0 ? '+' : ''}${formatMachineNumber(summary.kwhDelta24h, 2)} kWh`}
        detail={`${t('Max')} ${formatMachineNumber(summary.kwhDeltaMax, 2)} | ${t('Min')} ${formatMachineNumber(summary.kwhDeltaMin, 2)}`}
        level="info"
      />
      <SummaryCard
        label={t('KWh Rate (Avg)')}
        value={`${formatMachineNumber(summary.kwhRateAvg, 2)} kWh/h`}
        detail={`${t('Peak')} ${formatMachineNumber(summary.kwhRatePeak, 2)} | ${t('Low')} ${formatMachineNumber(summary.kwhRateLow, 2)}`}
        level="info"
      />
      <SummaryCard
        label={t('Energy Consistency')}
        value={`${formatMachineNumber(summary.energyConsistencyScore)}%`}
        detail={t(summary.energyConsistencyScore >= 90 ? 'No material inconsistency' : 'Review event evidence')}
        level={summary.energyConsistencyScore >= 90 ? 'info' : 'warning'}
      />
      <SummaryCard
        label={t('Data Quality')}
        value={`${formatMachineNumber(summary.dataQualityScore)}%`}
        detail={t(summary.dataQualityScore >= 90 ? 'Good coverage' : 'Review data coverage')}
        level="warning"
      />
      <SummaryCard
        label={t('KWh Source')}
        value={t(summary.kwhSource.replace(/_/g, ' '))}
        detail={t(summary.kwhSource === 'MIXED_RAW_FILL' ? 'Raw + controlled fill' : 'Event-level source')}
        level="info"
      />
      <SummaryCard
        label={t('Loaded Zero KWh')}
        value={`${summary.loadedZeroKwhEvents} ${t('events')}`}
        detail={t('Needs validation')}
        level="warning"
      />
      <SummaryCard
        label={t('Negative KWh')}
        value={`${formatMachineNumber(summary.negativeKwhEvents, 0)} ${t(summary.negativeKwhEvents === 1 ? 'event' : 'events')}`}
        detail={t('Check meter logic')}
        level="danger"
      />
      <SummaryCard
        label={t('Missing KWh')}
        value={`${formatMachineNumber(summary.missingKwhPct)}%`}
        detail={t('Recent events')}
        level="info"
      />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  level,
}: {
  label: string;
  value: string;
  detail: string;
  level: "info" | "warning" | "danger";
}) {
  const t = useUiText();
  return (
    <div className={`md-summary-card ${level}`}>
      <div className="summary-title">{t(label)}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-detail">{t(detail)}</div>
    </div>
  );
}
