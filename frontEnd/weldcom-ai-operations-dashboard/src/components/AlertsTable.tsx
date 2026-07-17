import { Eye, MoreVertical, TriangleAlert } from 'lucide-react';
import type { AlertRow } from '../types/dashboard';
import { classForLevel } from '../utils/format';
import { Sparkline } from './Sparkline';

interface AlertsTableProps { alerts: AlertRow[]; }

export function AlertsTable({ alerts }: AlertsTableProps) {
  return (
    <section className="glass-panel overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="panel-title flex items-center gap-2">Live Alerts <span className="rounded-full bg-red-500/80 px-2 py-0.5 text-xs text-white">12</span></div>
        <button className="text-sm font-semibold text-blue-400">View All Alerts →</button>
      </div>
      <div className="px-4 pb-4">
        <div className="overflow-hidden rounded-xl border border-blue-200/12">
          <table className="data-table">
            <thead>
              <tr>
                <th>Machine ID</th>
                <th>Operational Action Level</th>
                <th>Operational Judgment</th>
                <th>Risk Fault 30min</th>
                <th>Quality Judgment</th>
                <th>L1 Anomaly</th>
                <th>L2 Fault Confidence</th>
                <th>Alert Time</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((row) => {
                const riskColor = row.faultRisk30Min >= 80 ? '#ff3648' : row.faultRisk30Min >= 60 ? '#ff9800' : '#ffd33d';
                return (
                  <tr key={`${row.machineId}-${row.alertTime}`}>
                    <td className="font-bold text-white">{row.machineId}</td>
                    <td>
                      <div className="flex items-center gap-2"><TriangleAlert size={17} style={{ color: riskColor }} /><span className={`chip ${classForLevel(row.actionLevel)}`}>{row.actionLevel}</span></div>
                    </td>
                    <td className="font-bold" style={{ color: riskColor }}>{row.operationalJudgment}</td>
                    <td>
                      <div className="flex items-center gap-3"><Sparkline data={row.faultRiskSeries} color={riskColor} height={28} /><span className="font-black" style={{ color: riskColor }}>{row.faultRisk30Min}</span></div>
                    </td>
                    <td><span className={`font-bold ${row.qualityJudgment === 'Fail' ? 'text-red-400' : row.qualityJudgment === 'Review' ? 'text-orange-400' : 'text-emerald-400'}`}>{row.qualityJudgment}</span></td>
                    <td><span className={row.l1Anomaly === 'Anomaly' ? 'font-bold text-red-400' : 'font-bold text-emerald-400'}>{row.l1Anomaly}</span></td>
                    <td><span className="text-blue-400">◉</span> <span className="font-bold text-blue-300">{row.l2FaultConfidence}%</span></td>
                    <td className="text-slate-300">{row.alertTime}</td>
                    <td className="text-right"><div className="flex justify-end gap-2"><button className="rounded-lg p-2 text-slate-300 hover:bg-blue-500/10 hover:text-white"><Eye size={16} /></button><button className="rounded-lg p-2 text-slate-300 hover:bg-blue-500/10 hover:text-white"><MoreVertical size={16} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
