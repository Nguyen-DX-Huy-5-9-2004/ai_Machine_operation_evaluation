import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faEye } from '@fortawesome/free-solid-svg-icons';
import type { OperationalAlertRow } from '../types/dashboard';
import { classForLevel } from '../utils/format';
import { Sparkline } from './Sparkline';
import { DashboardInfoTooltip } from './dashboard/DashboardInfoTooltip';

interface AlertsTableProps { alerts: OperationalAlertRow[]; }

function riskTone(value: number) {
  if (value >= 80) return '#ff3648';
  if (value >= 65) return '#ff9800';
  if (value >= 45) return '#ffd33d';
  return '#00e889';
}

function Badge({ value }: { value: string }) {
  return <span className={`chip ${classForLevel(value)}`}>{value}</span>;
}

function RiskCell({ value, series }: { value: number; series: number[] }) {
  const color = riskTone(value);
  return (
    <div className="flex items-center gap-2">
      <Sparkline data={series} color={color} height={24} />
      <span className="min-w-7 text-right font-black" style={{ color }}>{value}</span>
    </div>
  );
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  const handleAction = (action: string, row: OperationalAlertRow) => {
    console.log(`${action}: ${row.machineId}`, row);
  };

  return (
    <section className="glass-panel overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="panel-title operational-alerts-title flex items-center gap-2">({alerts.length}) Live Operational Alerts <DashboardInfoTooltip text="Operational alerts combine action level, near-term fault risk, maintenance and repair risk, L1 behavior signal, quality judgment, and the final policy reason." /><span className="rounded-full bg-red-500/80 px-2 py-0.5 text-xs text-white"></span></div>
        <button className="view-all-alerts">View All Alerts <FontAwesomeIcon icon={faArrowRight} /></button>
      </div>
      <div className="px-4 pb-4">
        <div className="alert-table-wrap">
          <table className="data-table alert-table">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Location</th>
                <th>Action Level</th>
                <th>Operational Judgment</th>
                <th>Fault Risk 30min</th>
                <th>Maintenance Risk</th>
                <th>Repair Risk</th>
                <th className="quality-judgment-cell">Quality Judgment</th>
                <th>L1 Anomaly</th>
                <th>Final Reason</th>
                <th>Event Time</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((row) => {
                const eventTime = new Date(row.eventStartTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const warningColor = riskTone(row.riskFault30Min);
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="font-bold text-white">{row.machineId}</div>
                      <div className="text-[11px] text-slate-500">{row.machineName}</div>
                    </td>
                    <td className="text-slate-300">{row.locationName}</td>
                    <td>
                      <Badge value={row.operationalActionLevel} />
                    </td>
                    <td className="font-bold" style={{ color: warningColor }}>{row.operationalJudgment}</td>
                    <td><RiskCell value={row.riskFault30Min} series={row.faultRiskSeries} /></td>
                    <td><RiskCell value={row.riskMaintenance30Events} series={row.maintenanceRiskSeries} /></td>
                    <td><RiskCell value={row.riskRepair30Events} series={row.repairRiskSeries} /></td>
                    <td className="quality-judgment-cell"><Badge value={row.qualityJudgment} /></td>
                    <td><Badge value={row.l1Anomaly} /></td>
                    <td><div className="final-reason" title={row.finalReasonV2}>{row.finalReasonV2}</div></td>
                    <td className="text-slate-300">{eventTime}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button className="action-icon" title="View Detail" onClick={() => handleAction('View Detail', row)}><FontAwesomeIcon icon={faEye} /></button>
                        {/* <button className="action-icon" title="Open Timeline" onClick={() => handleAction('Open Timeline', row)}><FontAwesomeIcon icon={faTimeline} /></button>
                        <button className="action-icon" title="Explain AI" onClick={() => handleAction('Explain AI', row)}><FontAwesomeIcon icon={faBrain} /></button> */}
                      </div>
                    </td>
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
