import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faBrain, faEye, faTimeline } from '@fortawesome/free-solid-svg-icons';
import type { MachineEventRow, MachineStatusType } from '../../types/machineDetail';
import { InfoDot } from './InfoDot';
import { formatMachineNumber } from '../../utils/machineDetailCharts';
import { useUiText } from '../../i18n/appTranslations';

interface Props { rows: MachineEventRow[]; }
function statusLabel(status: MachineStatusType) { return status.replace(/_/g, ' '); }

export function RecentEventsTable({ rows }: Props) {
  const t = useUiText();
  return (
    <section className="md-panel md-events-panel">
      <div className="md-panel-header"><div className="md-title-with-info"><h3>{t('Recent Events')} <span>({t('Last 50')})</span></h3><InfoDot text="Most recent machine events with KWh source, L1 result, action level, and final reason." /></div><button type="button" className="md-link-button">{t('View All Events')} <FontAwesomeIcon icon={faArrowRight} /></button></div>
      <div className="md-table-wrap"><table className="md-table"><thead><tr>{['Event time', 'Status', 'Duration', 'KWh delta', 'KWh source', 'Gap from prev', 'Action level', 'L1 result', 'Quality', 'Final reason', 'Actions'].map((label) => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>
        {rows.map(row => <tr key={row.eventId}><td>{row.eventTime}</td><td><span className={`badge status-${row.status.toLowerCase()}`}>{t(statusLabel(row.status))}</span></td><td>{row.duration}</td><td className={row.kwhDelta !== null && row.kwhDelta < 0 ? 'negative' : 'positive'}>{row.kwhDelta === null ? 'N/A' : `${row.kwhDelta > 0 ? '+' : ''}${formatMachineNumber(row.kwhDelta, 3)}`}</td><td><span className={`badge source-${row.kwhSource.toLowerCase()}`}>{row.kwhSource}</span></td><td>{row.gapFromPrev}</td><td><span className={`badge level-${row.actionLevel.toLowerCase()}`}>{t(row.actionLevel)}</span></td><td>{t(row.l1Result)}</td><td>{row.quality}%</td><td className="ellipsis" title={row.finalReason}>{t(row.finalReason)}</td><td><div className="md-action-group"><button type="button" title={t('View Detail')}><FontAwesomeIcon icon={faEye} /></button><button type="button" title={t('Open Timeline')}><FontAwesomeIcon icon={faTimeline} /></button><button type="button" title={t('Explain AI')}><FontAwesomeIcon icon={faBrain} /></button></div></td></tr>)}
      </tbody></table></div>
    </section>
  );
}
