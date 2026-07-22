import { useState } from "react";
import type { CSSProperties } from "react";
import type { MonitorProvenance, ScoringFunnelStage } from '../../types/aiModelMonitor';
import { Panel } from './Panel';

const colors = ['#1677ff', '#20a4ff', '#14cdb1', '#16d47d', '#d6cb18', '#ff9f1a', '#ff3e52'];

export function ScoringFunnelPanel({ stages, notScoredEvents, source }: { stages: ScoringFunnelStage[]; notScoredEvents: number | null; source?: MonitorProvenance }) {
  const [activeStage, setActiveStage] = useState<number | null>(null);

  return (
    <Panel title="Scoring Funnel" subtitle="Selected time range" tooltip="Cho biết số event đi qua từng tầng và tỷ lệ chuyển đổi/rơi rụng." className="amm-funnel-panel" source={source}>
      <div className="amm-funnel">
        <div className="amm-funnel__shape" aria-label="Scoring funnel stages">
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
                aria-label={`${stage.label}: ${stage.events == null ? 'Not calculated' : stage.events.toLocaleString("en-US")} events, ${stage.conversion == null ? 'Not calculated' : `${stage.conversion.toFixed(1)}%`} conversion`}
              >
                {active ? (
                  <span className="amm-funnel__tooltip" role="tooltip">
                    <b>{stage.label}</b>
                    <span>{stage.events == null ? 'Not calculated' : `${stage.events.toLocaleString("en-US")} events`}</span>
                    <strong>{stage.conversion == null ? 'Not calculated' : `${stage.conversion.toFixed(1)}% conversion`}</strong>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="amm-funnel__rows">
          <div className="amm-funnel__head"><span>Stage</span><span>Events</span><span>Conv.</span></div>
          {stages.map((stage, index) => (
            <div
              className={`amm-funnel__row ${activeStage === index ? "is-active" : ""}`}
              key={stage.id}
              onMouseEnter={() => setActiveStage(index)}
              onMouseLeave={() => setActiveStage(null)}
            >
              <span><i style={{ background: colors[index] }} />{stage.label}</span>
              <strong>{stage.events == null ? 'Not calculated' : stage.events.toLocaleString('en-US')}</strong>
              <b>{stage.conversion == null ? 'Not calculated' : `${stage.conversion.toFixed(1)}%`}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="amm-funnel__footer"><span>Not scored events: <strong>{notScoredEvents == null ? 'Not calculated' : notScoredEvents.toLocaleString('en-US')}</strong></span><button type="button">View reasons →</button></div>
    </Panel>
  );
}
