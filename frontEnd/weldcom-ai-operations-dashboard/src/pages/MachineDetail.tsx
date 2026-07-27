import React from 'react';
import { dataProvider } from '@data-provider';
import type { MachineDetailResponse } from '../types/machineDetail';
import { MachineDetailPresentation } from '../components/machineDetail/MachineDetailPresentation';
import '../styles/machine-detail.css';
import { useUiText } from '../i18n/appTranslations';

export default function MachineDetail() {
  const t = useUiText();
  const [data, setData] = React.useState<MachineDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [timeRange, setTimeRange] = React.useState('Last 24 Hours');

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    dataProvider.legacyMachineDetail()
      .then(result => { if (mounted) { setData(result); setError(null); } })
      .catch((err: unknown) => { if (mounted) setError(err instanceof Error ? err.message : 'Failed to load machine detail'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="machine-detail-page"><div className="md-loading">{t('Loading machine detail...')}</div></div>;
  if (error || !data) return <div className="machine-detail-page"><div className="md-error">{error ? t(error) : t('No data available')}</div></div>;

  return <MachineDetailPresentation data={data} timeRange={timeRange} onTimeRangeChange={setTimeRange} />;
}
