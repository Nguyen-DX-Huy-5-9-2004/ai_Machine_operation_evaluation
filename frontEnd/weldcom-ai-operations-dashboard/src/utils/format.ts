export function classForLevel(level: string): string {
  const key = level.toLowerCase();
  if (key.includes('critical')) return 'chip-critical';
  if (key.includes('fail') || key.includes('anomaly')) return 'chip-critical';
  if (key.includes('high')) return 'chip-high';
  if (key.includes('medium') || key.includes('review')) return 'chip-medium';
  if (key.includes('low')) return 'chip-low';
  if (key.includes('pass') || key.includes('normal')) return 'chip-normal';
  return 'chip-normal';
}

export function toneColor(tone: string): string {
  const map: Record<string, string> = {
    purple: '#8b5cf6',
    blue: '#1677ff',
    red: '#ff3648',
    orange: '#ff9800',
    green: '#00e889',
    cyan: '#00e5ff',
    yellow: '#ffd33d'
  };
  return map[tone] ?? '#1677ff';
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, notation: value >= 10000 ? 'compact' : 'standard' }).format(value);
}
