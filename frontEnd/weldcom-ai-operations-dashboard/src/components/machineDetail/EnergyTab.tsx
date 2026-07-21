import type { MachineDetailResponse } from '../../types/machineDetail';
import { EnergySummaryStrip } from './EnergySummaryStrip';
import { EventKwhDeltaChart, LoadedKwhEvidenceChart } from './KwhCharts';
import { InfoDot } from './InfoDot';

interface Props { data: MachineDetailResponse; }

export function EnergyTab({ data }: Props) {
  return (
    <div className="md-tab-workspace energy-tab">
      <section className="md-context-banner energy-note">
        <div>
          <h3>Machine-level energy evidence</h3>
          <p>Event KWh values are used as evidence for this machine. Cabinet/global KWh must stay at coarse location/day level unless backend supplies a validated machine-cabinet bridge.</p>
        </div>
        <span>Ready for SQL/API mapping</span>
      </section>

      <section className="md-main-chart-grid two-wide">
        <EventKwhDeltaChart data={data.kwhDeltaSeries} />
        <LoadedKwhEvidenceChart data={data.loadedKwhSeries} />
      </section>

      <EnergySummaryStrip summary={data.energySummary} />

      <section className="md-tab-grid two-one">
        <div className="md-panel md-energy-rules-card">
          <div className="md-panel-header compact">
            <div className="md-title-with-info"><h3>Energy Rule Checks</h3><InfoDot text="Rules that should later be computed by backend from L1 event sequence and policy v2 output." /></div>
          </div>
          <div className="md-rule-list">
            <Rule label="Loaded but zero KWh" value={`${data.energySummary.loadedZeroKwhEvents} events`} level="warning" source="loaded_zero_kwh_flag" />
            <Rule label="Loaded without KWh" value={`${data.energySummary.missingKwhPct}%`} level="warning" source="loaded_without_kwh_flag / kwh_missing_flag" />
            <Rule label="Negative KWh delta" value={`${data.energySummary.negativeKwhEvents} event`} level="critical" source="kwh_negative_delta_flag" />
            <Rule label="Mixed source" value={data.energySummary.kwhSource} level="info" source="kwh_start_source / kwh_end_source" />
          </div>
        </div>
        <div className="md-panel md-energy-rules-card">
          <div className="md-panel-header compact">
            <div className="md-title-with-info"><h3>Energy Interpretation</h3><InfoDot text="Short operator-facing interpretation of the selected machine energy evidence." /></div>
          </div>
          <div className="md-energy-interpretation">
            <strong className="level-high">Energy consistency is weak but not standalone proof of machine failure.</strong>
            <p>KWh inconsistency supports the L1/L2 warning, but data quality and KWh source must be reviewed before treating energy as a hard fault signal.</p>
            <div className="md-source-tags"><span>kwh_delta_model_value</span><span>energy_inconsistency_flag</span><span>kwh_missing_flag</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Rule({ label, value, level, source }: { label: string; value: string; level: 'critical' | 'warning' | 'info'; source: string }) {
  return <div className={`md-rule-row ${level}`}><span>{label}<small>{source}</small></span><b>{value}</b></div>;
}
