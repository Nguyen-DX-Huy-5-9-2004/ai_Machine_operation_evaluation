import { useMemo, useState } from 'react';
import type { TopMachinesMode, TopRiskMachine } from '../../types/dashboard';
import { DashboardSelect } from './DashboardSelect';
import { riskColor } from './chartUtils';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';

export function TopRiskMachines({ data, onSelect }: { data: TopRiskMachine[]; onSelect?: (machineId: number) => void }) {
  const [modeLabel, setModeLabel] = useState('Top by current risk');
  const modeMap: Record<string, TopMachinesMode> = {
    'Top by current risk': 'currentRisk',
    'Top by critical count': 'criticalCount',
    'Top by maintenance risk': 'maintenanceRisk',
    'Top by data quality issue': 'dataQualityIssue'
  };

  const sorted = useMemo(() => {
    const mode = modeMap[modeLabel];
    const valueFor = (machine: TopRiskMachine) => {
      if (mode === 'criticalCount') return machine.criticalCount;
      if (mode === 'maintenanceRisk') return machine.maintenanceRisk;
      if (mode === 'dataQualityIssue') return machine.dataQualityIssueScore;
      return machine.riskScore;
    };
    return [...data].sort((a, b) => valueFor(b) - valueFor(a)).slice(0, 10).map((machine) => ({ ...machine, displayScore: valueFor(machine) }));
  }, [data, modeLabel]);

  return (
    <section className="glass-panel panel-primary p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="panel-title metric-title-with-info">Top Machines by Risk<DashboardInfoTooltip text="Ranks machines using the selected operational or data-quality measure. Use machine detail to inspect the event evidence behind a rank." /></div>
        <DashboardSelect value={modeLabel} options={Object.keys(modeMap)} onChange={setModeLabel} compact />
      </div>
      <div className="mb-2 grid grid-cols-[78px_1fr_38px] gap-3 text-[11px] uppercase tracking-wide text-slate-400">
        <span>Machine</span>
        <span />
        <span className="text-right">Score</span>
      </div>
      <div className="space-y-[7px]">
        {sorted.map((machine) => {
          const color = riskColor(machine.riskScore);
          return (
            <button type="button" key={machine.machineId} className="grid w-full grid-cols-[78px_1fr_38px] items-center gap-3 text-left text-sm leading-none disabled:cursor-default" title={`${machine.machineName} | ${machine.locationName}`} disabled={!onSelect || !Number.isInteger(Number(machine.machineId))} onClick={() => onSelect?.(Number(machine.machineId))}>
              <span className="font-semibold text-slate-300">{machine.machineId}</span>
              <div className="h-[9px] rounded-full bg-slate-700/[0.55]">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(machine.displayScore, 100)}%`, background: color, boxShadow: `0 0 18px ${color}` }} />
              </div>
              <span className="text-right font-bold" style={{ color }}>{machine.displayScore}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-[78px_1fr_38px] gap-3 text-xs text-slate-400">
        <span />
        <div className="flex justify-between"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        <span />
      </div>
    </section>
  );
}
