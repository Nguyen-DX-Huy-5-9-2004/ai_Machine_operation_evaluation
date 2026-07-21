import type { EnergySummary } from "../../types/machineDetail";
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
                <b>{item.value}%</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SummaryCard
        label="KWh Delta (24h)"
        value={`+${summary.kwhDelta24h} kWh`}
        detail={`Max +${summary.kwhDeltaMax} | Min ${summary.kwhDeltaMin}`}
        level="info"
      />
      <SummaryCard
        label="KWh Rate (Avg)"
        value={`${summary.kwhRateAvg} kWh/h`}
        detail={`Peak ${summary.kwhRatePeak} | Low ${summary.kwhRateLow}`}
        level="info"
      />
      <SummaryCard
        label="Energy Consistency"
        value={`${summary.energyConsistencyScore}%`}
        detail="Inconsistency detected"
        level="warning"
      />
      <SummaryCard
        label="Data Quality"
        value={`${summary.dataQualityScore}%`}
        detail="Moderate"
        level="warning"
      />
      <SummaryCard
        label="KWh Source"
        value="Mixed"
        detail="Raw + controlled fill"
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
        value={`${summary.negativeKwhEvents} event`}
        detail="Check meter logic"
        level="danger"
      />
      <SummaryCard
        label="Missing KWh"
        value={`${summary.missingKwhPct}%`}
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
