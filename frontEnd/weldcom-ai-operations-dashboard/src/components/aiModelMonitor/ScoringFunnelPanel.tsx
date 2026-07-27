import { useState } from "react";
import type { CSSProperties } from "react";
import type { MonitorProvenance, ScoringFunnelStage } from '../../types/aiModelMonitor';
import { Panel } from './Panel';
import { useUiText } from '../../i18n/appTranslations';

const colors = ['#1677ff', '#20a4ff', '#14cdb1', '#16d47d', '#d6cb18', '#ff9f1a', '#ff3e52'];

export function ScoringFunnelPanel({ stages, notScoredEvents, source }: { stages: ScoringFunnelStage[]; notScoredEvents: number | null; source?: MonitorProvenance }) {
  const t = useUiText();
  const [activeStage, setActiveStage] = useState<number | null>(null);

  return (
    <Panel title={t('Scoring Funnel')} subtitle={t('Selected time range')} tooltip="Shows how many events pass each scoring gate and the conversion or drop-off between stages." className="amm-funnel-panel" source={source}>
      <div className="amm-funnel">
        <div className="amm-funnel__shape" aria-label={t('Scoring funnel stages')}>
          {stages.map((stage, index) => {
            const width = Math.max(18, 100 - index * 11.5);
            const active = activeStage === index;
            return (
              <button
                type="button"
                key={stage.id}
                className={`amm-funnel__segment ${active ? "is-active" : ""}`}
                style={{
                  width: `${width}%`,
                  "--amm-funnel-color": colors[index],
                } as CSSProperties}
                onMouseEnter={() => setActiveStage(index)}
                onFocus={() => setActiveStage(index)}
                onMouseLeave={() => setActiveStage(null)}
                onBlur={() => setActiveStage(null)}
                aria-label={`${t(stage.label)}: ${stage.events == null ? t('Not calculated') : stage.events.toLocaleString("en-US")} ${t('events')}, ${stage.conversion == null ? t('Not calculated') : `${stage.conversion.toFixed(1)}% ${t('conversion')}`}`}
              >
                {active ? (
                  <span className="amm-funnel__tooltip" role="tooltip">
                    <b>{t(stage.label)}</b>
                    <span>{stage.events == null ? t('Not calculated') : `${stage.events.toLocaleString("en-US")} ${t('events')}`}</span>
                    <strong>{stage.conversion == null ? t('Not calculated') : `${stage.conversion.toFixed(1)}% ${t('conversion')}`}</strong>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="amm-funnel__rows">
          <div className="amm-funnel__head"><span>{t('Stage')}</span><span>{t('Events')}</span><span>{t('Conversion')}</span></div>
          {stages.map((stage, index) => (
            <div
              className={`amm-funnel__row ${activeStage === index ? "is-active" : ""}`}
              key={stage.id}
              onMouseEnter={() => setActiveStage(index)}
              onMouseLeave={() => setActiveStage(null)}
            >
              <span><i style={{ background: colors[index] }} />{t(stage.label)}</span>
              <strong>{stage.events == null ? t('Not calculated') : stage.events.toLocaleString('en-US')}</strong>
              <b>{stage.conversion == null ? t('Not calculated') : `${stage.conversion.toFixed(1)}%`}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="amm-funnel__footer"><span>{t('Not scored events')}: <strong>{notScoredEvents == null ? t('Not calculated') : notScoredEvents.toLocaleString('en-US')}</strong></span><button type="button">{t('View reasons')} →</button></div>
    </Panel>
  );
}
