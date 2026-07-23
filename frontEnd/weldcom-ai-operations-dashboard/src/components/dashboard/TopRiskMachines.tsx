import { useMemo, useState } from 'react';
import type { TopMachinesMode, TopRiskMachine } from '../../types/dashboard';
import { DashboardSelect } from './DashboardSelect';
import { riskColor } from './chartUtils';
import { DashboardInfoTooltip } from './DashboardInfoTooltip';

export function TopRiskMachines({ data, onSelect, compact = false }: { data: TopRiskMachine[]; onSelect?: (machineId: number) => void; compact?: boolean }) {
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
    <section className={`glass-panel panel-primary top-risk-machines-card p-5${compact ? ' top-risk-machines-card--compact' : ''}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="panel-title metric-title-with-info">Top Machines by Risk<DashboardInfoTooltip text="Ranks machines using the selected operational or data-quality measure. Use machine detail to inspect the event evidence behind a rank." /></div>
        <DashboardSelect value={modeLabel} options={Object.keys(modeMap)} onChange={setModeLabel} compact />
      </div>
      <div className={`mb-2 grid gap-3 text-[11px] uppercase tracking-wide text-slate-400${compact ? ' grid-cols-[86px_1fr_34px]' : ' grid-cols-[116px_1fr_38px]'}`}>
        <span>Machine</span>
        <span />
        <span className="text-right">Score</span>
      </div>
      <div className={compact ? 'space-y-[5px]' : 'space-y-[7px]'}>
        {sorted.map((machine) => {
          const color = riskColor(machine.riskScore);
          return (
            <button type="button" key={machine.machineId} className={`grid w-full items-center gap-3 text-left leading-none disabled:cursor-default${compact ? ' grid-cols-[86px_1fr_34px] text-[12px]' : ' grid-cols-[116px_1fr_38px] text-sm'}`} title={`${machine.machineName} | ID ${machine.machineId} | ${machine.locationName}`} disabled={!onSelect || !Number.isInteger(Number(machine.machineId))} onClick={() => onSelect?.(Number(machine.machineId))}>
              <span className="min-w-0">{compact ? <b className="block truncate font-semibold text-slate-200">{machine.machineId}</b> : <><b className="block truncate font-semibold text-slate-200">{machine.machineName}</b><small className="block pt-1 text-[10px] text-slate-500">ID {machine.machineId}</small></>}</span>
              <div className={`${compact ? 'h-[7px]' : 'h-[9px]'} rounded-full bg-slate-700/[0.55]`}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(machine.displayScore, 100)}%`, background: color, boxShadow: `0 0 18px ${color}` }} />
              </div>
              <span className="text-right font-bold" style={{ color }}>{machine.displayScore}</span>
            </button>
          );
        })}
      </div>
      <div className={`mt-3 grid gap-3 text-xs text-slate-400${compact ? ' grid-cols-[86px_1fr_34px]' : ' grid-cols-[116px_1fr_38px]'}`}>
        <span />
        <div className="flex justify-between"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        <span />
      </div>
    </section>
  );
}
