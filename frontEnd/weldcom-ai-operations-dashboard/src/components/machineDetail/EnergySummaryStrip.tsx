import type { EnergySummary } from "../../types/machineDetail";
import { formatMachineNumber } from '../../utils/machineDetailCharts';
import { InfoDot } from "./InfoDot";

interface Props {
  summary: EnergySummary;
}

export function EnergySummaryStrip({ summary }: Props) {
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
          KWh Availability{" "}
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
                {item.label}
                <b>{formatMachineNumber(item.value)}%</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SummaryCard
        label="KWh Delta (24h)"
        value={`${summary.kwhDelta24h >= 0 ? '+' : ''}${formatMachineNumber(summary.kwhDelta24h, 2)} kWh`}
        detail={`Max ${formatMachineNumber(summary.kwhDeltaMax, 2)} | Min ${formatMachineNumber(summary.kwhDeltaMin, 2)}`}
        level="info"
      />
      <SummaryCard
        label="KWh Rate (Avg)"
        value={`${formatMachineNumber(summary.kwhRateAvg, 2)} kWh/h`}
        detail={`Peak ${formatMachineNumber(summary.kwhRatePeak, 2)} | Low ${formatMachineNumber(summary.kwhRateLow, 2)}`}
        level="info"
      />
      <SummaryCard
        label="Energy Consistency"
        value={`${formatMachineNumber(summary.energyConsistencyScore)}%`}
        detail={summary.energyConsistencyScore >= 90 ? 'No material inconsistency' : 'Review event evidence'}
        level={summary.energyConsistencyScore >= 90 ? 'info' : 'warning'}
      />
      <SummaryCard
        label="Data Quality"
        value={`${formatMachineNumber(summary.dataQualityScore)}%`}
        detail={summary.dataQualityScore >= 90 ? 'Good coverage' : 'Review data coverage'}
        level="warning"
      />
      <SummaryCard
        label="KWh Source"
        value={summary.kwhSource.replace(/_/g, ' ')}
        detail={summary.kwhSource === 'MIXED_RAW_FILL' ? 'Raw + controlled fill' : 'Event-level source'}
        level="info"
      />
      <SummaryCard
        label="Loaded Zero KWh"
        value={`${summary.loadedZeroKwhEvents} events`}
        detail="Needs validation"
        level="warning"
      />
      <SummaryCard
        label="Negative KWh"
        value={`${formatMachineNumber(summary.negativeKwhEvents, 0)} ${summary.negativeKwhEvents === 1 ? 'event' : 'events'}`}
        detail="Check meter logic"
        level="danger"
      />
      <SummaryCard
        label="Missing KWh"
        value={`${formatMachineNumber(summary.missingKwhPct)}%`}
        detail="Recent events"
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
  return (
    <div className={`md-summary-card ${level}`}>
      <div className="summary-title">{label}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-detail">{detail}</div>
    </div>
  );
}
