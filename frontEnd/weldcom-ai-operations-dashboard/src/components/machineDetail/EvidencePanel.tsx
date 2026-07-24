import type {
  EvidenceItem,
  MachineDetailResponse,
} from "../../types/machineDetail";
import { InfoDot } from "./InfoDot";
import { useUiText } from '../../i18n/appTranslations';

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
  const t = useUiText();
  return (
    <section className="md-panel md-evidence-panel">
      <div className="md-panel-header">
        <div className="md-title-with-info">
          <h3>{t('AI Explainability & Evidence')}</h3>
          <InfoDot text="Evidence panel explains which L1/L2, status, time, KWh, and data-quality signals contributed to the final policy decision." />
        </div>
        <span className="generated-at">{t('Generated')}: {generatedAt}</span>
      </div>
      <div className="md-evidence-grid">
        <EvidenceList
          title={t('Operational Evidence')}
          items={operationalEvidence}
        />
        <EvidenceList
          title={t('Energy & Data Evidence')}
          items={energyDataEvidence}
        />
        <div className="md-final-reason-card">
          <span>{t('Final Reason (V2)')}</span>
          <strong>{finalReason.text}</strong>
          <div className="md-final-metrics">
            <div>
              <span>{t('Action Level')}</span>
              <b className={`level-${finalReason.actionLevel.toLowerCase()}`}>
                {t(finalReason.actionLevel)}
              </b>
            </div>
            <div>
              <span>{t('Confidence')}</span>
              <b>{finalReason.confidencePct == null ? t('Not available') : `${finalReason.confidencePct}%`}</b>
            </div>
            <div>
              <span>{t('L1 Score')}</span>
              <b>{finalReason.l1Score ?? t('Not available')}</b>
            </div>
            <div>
              <span>{t('L2 Confidence')}</span>
              <b>{finalReason.l2Confidence ?? t('Not available')}</b>
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
  const t = useUiText();
  return (
    <div className="md-evidence-list">
      <h4>{t(title)}</h4>
      {items.map((item) => (
        <div key={item.id} className="md-evidence-item">
          <div>
            <span>{t(item.label)}</span>
            <small>{t(item.description)}</small>
          </div>
          <b className={`level-${String(item.level).toLowerCase()}`}>
            {item.value}
          </b>
        </div>
      ))}
    </div>
  );
}
