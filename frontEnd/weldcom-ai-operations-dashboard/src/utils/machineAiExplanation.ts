type ExplanationInput = {
  l1Score: number | null;
  l2Risk: number | null;
  actionLevel: string;
  operationalJudgment: string;
  qualityJudgment: string;
  qualityIssue: boolean;
  energyIssue: boolean;
  readyReason: string;
  rawReason: string;
};

const humanize = (value: string) => value.replace(/_/g, ' ').toLowerCase();

export function explainRawPolicyReasonVietnamese(value: string): string {
  if (!value || value === 'Not available') return 'Chưa có lý do chính sách được ghi nhận.';
  const tokens = value.split('|').reduce<Record<string, string>>((result, token) => {
    const [key, raw] = token.split('=');
    if (key && raw) result[key.trim()] = raw.trim();
    return result;
  }, {});
  if (tokens.op || tokens.op_action || tokens.quality) {
    const operation = tokens.op_action ? `mức hành động ${tokens.op_action}` : 'mức hành động hiện tại';
    const quality = tokens.quality ? `; chất lượng dữ liệu: ${humanize(tokens.quality)}` : '';
    return `Policy v2 xác định ${operation}${quality}.`;
  }
  return humanize(value);
}

export function explainL1Vietnamese(score: number | null, anomaly: boolean, sensitive: boolean, readyReason: string): string {
  if (score == null) return `L1 chưa đánh giá được: ${humanize(readyReason)}.`;
  if (anomaly) return `L1 phát hiện bất thường ${score.toFixed(1)}%, vượt ngưỡng vận hành 76%.`;
  if (sensitive) return `L1 ghi nhận cảnh báo nhạy cảm ${score.toFixed(1)}%; chưa phải cảnh báo vận hành.`;
  return `L1 đã đánh giá ${score.toFixed(1)}%, nằm trong ngưỡng vận hành.`;
}

export function explainL2Vietnamese(risk: number | null): string {
  if (risk == null) return 'L2 chưa có dữ liệu sẵn sàng để đánh giá sáu rủi ro.';
  if (risk >= 80) return `L2 cho thấy rủi ro cao nhất ${risk.toFixed(1)}%; cần ưu tiên kiểm tra theo bằng chứng sự kiện.`;
  if (risk >= 50) return `L2 ghi nhận rủi ro mức trung bình ${risk.toFixed(1)}%; cần theo dõi sát trong các sự kiện tiếp theo.`;
  return `L2 đánh giá rủi ro cao nhất ${risk.toFixed(1)}%, hiện chưa vượt mức cảnh báo cao.`;
}

export function explainPolicyVietnamese(input: ExplanationInput): string {
  const action = input.actionLevel === 'NORMAL' ? 'không có mức hành động vận hành' : `mức hành động ${input.actionLevel}`;
  const evidence = [
    input.l1Score == null ? null : `L1 ${input.l1Score.toFixed(1)}%`,
    input.l2Risk == null ? null : `L2 ${input.l2Risk.toFixed(1)}%`,
    input.qualityIssue ? 'cần xác minh chất lượng dữ liệu' : null,
    input.energyIssue ? 'cần kiểm tra bằng chứng KWh' : null,
  ].filter((value): value is string => Boolean(value));
  return `Policy v2 đưa ra ${action}. ${evidence.join('; ')}.`;
}
