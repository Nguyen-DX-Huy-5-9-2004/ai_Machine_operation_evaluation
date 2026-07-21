import type { ContractCheck } from '../../types/aiModelMonitor';
import { Panel } from './Panel';
import { Sparkline } from './Sparkline';
import { InfoTooltip } from './InfoTooltip';

const colorForStatus = (status: ContractCheck['status']) => status === 'PASS' ? '#00e889' : status === 'WARNING' ? '#ffb21a' : '#ff3e52';

export function DataContractPanel({ checks }: { checks: ContractCheck[] }) {
  return (
    <Panel title="Data Contract & Feature Health" tooltip="Giám sát schema, feature availability, event alignment, SQL parity, freshness và chất lượng KWh." className="amm-contract-panel" action={<button type="button" className="amm-link-button">View full report →</button>}>
      <div className="amm-contract-table" role="table">
        <div className="amm-contract-table__head" role="row"><span>Check item</span><span>Status</span><span>Value</span><span>Trend</span></div>
        {checks.map((item) => (
          <div className="amm-contract-table__row" role="row" key={item.id}>
            <span>{item.check}<InfoTooltip text={item.tooltip} align="left" /></span>
            <span className={`amm-contract-status is-${item.status.toLowerCase()}`}>{item.status}</span>
            <strong>{item.value}</strong>
            <Sparkline values={item.trend} color={colorForStatus(item.status)} width={72} height={22} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
