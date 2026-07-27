import { ArrowRight, BellRing, BrainCircuit, Database, GitBranch, ShieldCheck, SlidersHorizontal, Waves } from 'lucide-react';
import type { DecisionFlowStage, MonitorProvenance } from '../../types/aiModelMonitor';
import { Panel } from './Panel';
import { InfoTooltip } from './InfoTooltip';
import { useUiText } from '../../i18n/appTranslations';

const icons = [Database, SlidersHorizontal, BrainCircuit, Waves, GitBranch, ShieldCheck, BellRing];

export function DecisionFlowPanel({ stages, source }: { stages: DecisionFlowStage[]; source?: MonitorProvenance }) {
  const t = useUiText();
  return (
    <Panel title={t('AI 2-Layer Decision Flow')} tooltip="Shows the data path from SQL/event stream through feature builder, L1, L2, Policy v2, and dashboard output." className="amm-flow-panel" source={source}>
      <div className="amm-flow">
        {stages.map((stage, index) => {
          const Icon = icons[index] ?? BrainCircuit;
          return (
            <div className="amm-flow__group" key={stage.id}>
              <article className={`amm-flow__stage amm-tone-${stage.tone}`} tabIndex={0}>
                <div className="amm-flow__icon"><Icon size={24} /></div>
                <span className="amm-flow__step">{stage.step}</span>
                <h3>{t(stage.title)}</h3>
                <p>{t(stage.subtitle)}</p>
                <strong>{t(stage.value)}</strong>
                <span className={`amm-contract-status is-${stage.status.toLowerCase()}`}>{t(stage.status)}</span>
                <span className="amm-flow__source" title={stage.provenance?.tooltip ?? t('Source not available')}>{stage.provenance?.sourceType === 'SQL_RUNTIME' || stage.provenance?.sourceType === 'BOUNDED_AUDIT' ? t('LIVE') : stage.provenance?.isValidated ? t('ART') : t('REF')}</span>
                <InfoTooltip
                  text={stage.tooltip}
                  align={index > stages.length - 3 ? "right" : "left"}
                  className="amm-flow__tooltip"
                />
              </article>
              {index < stages.length - 1 ? <ArrowRight className="amm-flow__arrow" size={22} /> : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
