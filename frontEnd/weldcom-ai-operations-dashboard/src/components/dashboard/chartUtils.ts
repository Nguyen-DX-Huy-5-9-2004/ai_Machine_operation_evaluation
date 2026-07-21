export const tooltipStyle = {
  background: 'rgba(5, 16, 30, .96)',
  border: '1px solid rgba(0, 229, 255, .58)',
  borderRadius: 10,
  color: '#f7fbff',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45,
  padding: '10px 12px',
  boxShadow: '0 12px 32px rgba(0,0,0,.56), 0 0 18px rgba(0,229,255,.18)'
};

export function riskColor(score: number) {
  if (score >= 80) return '#ff3648';
  if (score >= 65) return '#ff9800';
  if (score >= 45) return '#ffd33d';
  return '#00e889';
}
