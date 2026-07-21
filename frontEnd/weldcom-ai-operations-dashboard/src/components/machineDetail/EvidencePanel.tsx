import type {
  EvidenceItem,
  MachineDetailResponse,
} from "../../types/machineDetail";
import { InfoDot } from "./InfoDot";

interface Props {
  operationalEvidence: EvidenceItem[];
  energyDataEvidence: EvidenceItem[];
  finalReason: MachineDetailResponse["finalReason"];
  generatedAt: string;
}

export function EvidencePanel({
  operationalEvidence,
  energyDataEvidence,
  finalReason,
  generatedAt,
}: Props) {
  return (
    <section className="md-panel md-evidence-panel">
      <div className="md-panel-header">
        <div className="md-title-with-info">
          <h3>AI Explainability & Evidence</h3>
          <InfoDot text="Evidence panel explains which L1/L2, status, time, KWh, and data-quality signals contributed to the final policy decision." />
        </div>
        <span className="generated-at">Generated: {generatedAt}</span>
      </div>
      <div className="md-evidence-grid">
        <EvidenceList
          title="Operational Evidence"
          items={operationalEvidence}
        />
        <EvidenceList
          title="Energy & Data Evidence"
          items={energyDataEvidence}
        />
        <div className="md-final-reason-card">
          <span>Final Reason (V2)</span>
          <strong>{finalReason.text}</strong>
          <div className="md-final-metrics">
            <div>
              <span>Action Level</span>
              <b className={`level-${finalReason.actionLevel.toLowerCase()}`}>
                {finalReason.actionLevel}
              </b>
            </div>
            <div>
              <span>Confidence</span>
              <b>{finalReason.confidencePct}%</b>
            </div>
            <div>
              <span>L1 Score</span>
              <b>{finalReason.l1Score}</b>
            </div>
            <div>
              <span>L2 Confidence</span>
              <b>{finalReason.l2Confidence}</b>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EvidenceList({
  title,
  items,
}: {
  title: string;
  items: EvidenceItem[];
}) {
  return (
    <div className="md-evidence-list">
      <h4>{title}</h4>
      {items.map((item) => (
        <div key={item.id} className="md-evidence-item">
          <div>
            <span>{item.label}</span>
            <small>{item.description}</small>
          </div>
          <b className={`level-${String(item.level).toLowerCase()}`}>
            {item.value}
          </b>
        </div>
      ))}
    </div>
  );
}
