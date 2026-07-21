import type { ScoringFunnelStage } from '../../types/aiModelMonitor';
import { Panel } from './Panel';

const colors = ['#1677ff', '#20a4ff', '#14cdb1', '#16d47d', '#d6cb18', '#ff9f1a', '#ff3e52'];

export function ScoringFunnelPanel({ stages, notScoredEvents }: { stages: ScoringFunnelStage[]; notScoredEvents: number }) {
  return (
    <Panel title="Scoring Funnel" subtitle="Selected time range" tooltip="Cho biết số event đi qua từng tầng và tỷ lệ chuyển đổi/rơi rụng." className="amm-funnel-panel">
      <div className="amm-funnel">
        <div className="amm-funnel__shape" aria-hidden="true">
          {stages.map((stage, index) => {
            const width = Math.max(18, 100 - index * 11.5);
            return <div key={stage.id} style={{ width: `${width}%`, background: colors[index] }} />;
          })}
        </div>
        <div className="amm-funnel__rows">
          <div className="amm-funnel__head"><span>Stage</span><span>Events</span><span>Conv.</span></div>
          {stages.map((stage, index) => (
            <div className="amm-funnel__row" key={stage.id}>
              <span><i style={{ background: colors[index] }} />{stage.label}</span>
              <strong>{stage.events.toLocaleString('en-US')}</strong>
              <b>{stage.conversion.toFixed(1)}%</b>
            </div>
          ))}
        </div>
      </div>
      <div className="amm-funnel__footer"><span>Not scored events: <strong>{notScoredEvents.toLocaleString('en-US')}</strong></span><button type="button">View reasons →</button></div>
    </Panel>
  );
}
