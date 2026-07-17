import type { DashboardPayload } from '../types/dashboard';

export const dashboardMock: DashboardPayload = {
  metrics: [
    {
      id: 'overall-risk',
      title: 'Overall Risk Score',
      value: 68,
      suffix: '/100',
      subtitle: 'High Risk',
      trend: 6.2,
      trendLabel: 'vs last 7 days',
      tone: 'purple',
      icon: 'ShieldAlert',
      series: [31, 34, 33, 41, 38, 47, 43, 52, 50, 58, 55, 62]
    },
    {
      id: 'total-machines',
      title: 'Total Machines',
      value: 128,
      subtitle: 'All Locations',
      trend: 3,
      trendLabel: 'active machines',
      tone: 'blue',
      icon: 'Bot',
      series: [12, 20, 16, 31, 42, 37, 56, 49, 62, 51, 74, 68]
    },
    {
      id: 'high-risk-machines',
      title: 'High Risk Machines',
      value: 23,
      subtitle: '18% of total',
      trend: -3,
      trendLabel: 'vs yesterday',
      tone: 'red',
      icon: 'TriangleAlert',
      series: [12, 17, 15, 24, 19, 31, 27, 35, 29, 41, 33, 47]
    },
    {
      id: 'quality-alerts',
      title: 'Quality Alerts',
      value: 37,
      subtitle: 'Requires Attention',
      trend: 8,
      trendLabel: 'vs yesterday',
      tone: 'orange',
      icon: 'BadgeCheck',
      series: [12, 14, 17, 13, 26, 22, 29, 24, 31, 28, 37, 33]
    },
    {
      id: 'maintenance-risk',
      title: 'Maintenance Risk',
      value: 64,
      subtitle: 'Machines at Risk',
      trend: 4,
      trendLabel: 'vs yesterday',
      tone: 'green',
      icon: 'Wrench',
      series: [19, 21, 20, 27, 24, 32, 29, 41, 33, 35, 44, 39]
    }
  ],
  riskDistribution: [
    { name: 'High Risk', value: 23, percent: 18, tone: '#ff3648' },
    { name: 'Medium Risk', value: 45, percent: 35, tone: '#ff9800' },
    { name: 'Low Risk', value: 42, percent: 33, tone: '#1677ff' },
    { name: 'Healthy', value: 18, percent: 14, tone: '#00e889' }
  ],
  operationalRiskTrend: [
    { label: 'May 12', risk: 16 },
    { label: 'May 13', risk: 28 },
    { label: 'May 14', risk: 62 },
    { label: 'May 15', risk: 47 },
    { label: 'May 16', risk: 41 },
    { label: 'May 17', risk: 49 },
    { label: 'May 18', risk: 68 }
  ],
  qualityIssueTrend: [
    { label: 'May 12', critical: 14, major: 28, minor: 25 },
    { label: 'May 13', critical: 22, major: 32, minor: 31 },
    { label: 'May 14', critical: 18, major: 35, minor: 34 },
    { label: 'May 15', critical: 29, major: 42, minor: 38 },
    { label: 'May 16', critical: 17, major: 31, minor: 34 },
    { label: 'May 17', critical: 20, major: 33, minor: 29 },
    { label: 'May 18', critical: 26, major: 38, minor: 27 }
  ],
  topMachines: [
    { machineId: 'WLD-077', riskScore: 92, highRiskEvents: 18 },
    { machineId: 'WLD-032', riskScore: 85, highRiskEvents: 16 },
    { machineId: 'WLD-019', riskScore: 74, highRiskEvents: 14 },
    { machineId: 'WLD-041', riskScore: 62, highRiskEvents: 12 },
    { machineId: 'WLD-088', riskScore: 58, highRiskEvents: 10 },
    { machineId: 'WLD-012', riskScore: 49, highRiskEvents: 8 },
    { machineId: 'WLD-063', riskScore: 44, highRiskEvents: 7 },
    { machineId: 'WLD-005', riskScore: 38, highRiskEvents: 6 },
    { machineId: 'WLD-090', riskScore: 33, highRiskEvents: 5 },
    { machineId: 'WLD-021', riskScore: 28, highRiskEvents: 4 }
  ],
  l1Status: {
    normal: 119,
    anomaly: 4,
    noData: 1,
    total: 124,
    spark: [20, 28, 18, 24, 31, 23, 35, 30, 48, 23, 42, 29]
  },
  l2Confidence: {
    high: 84,
    medium: 28,
    low: 12,
    total: 124,
    spark: [18, 32, 24, 41, 35, 55, 45, 70, 49, 85, 54, 76]
  },
  dataQuality: {
    completeness: 98.2,
    timeliness: 95.1,
    consistency: 97.3,
    accuracy: 94.6
  },
  liveAlerts: [
    { machineId: 'WLD-077', actionLevel: 'Critical', operationalJudgment: 'Stop Production', faultRisk30Min: 92, faultRiskSeries: [37, 48, 42, 61, 56, 72, 65, 83, 70], qualityJudgment: 'Fail', l1Anomaly: 'Anomaly', l2FaultConfidence: 92, alertTime: '10:24:10 AM' },
    { machineId: 'WLD-032', actionLevel: 'Critical', operationalJudgment: 'Stop Production', faultRisk30Min: 88, faultRiskSeries: [35, 41, 52, 44, 63, 51, 77, 68, 82], qualityJudgment: 'Fail', l1Anomaly: 'Anomaly', l2FaultConfidence: 89, alertTime: '10:23:45 AM' },
    { machineId: 'WLD-019', actionLevel: 'High', operationalJudgment: 'Reduce Speed', faultRisk30Min: 76, faultRiskSeries: [31, 34, 49, 37, 55, 44, 61, 52, 71], qualityJudgment: 'Review', l1Anomaly: 'Normal', l2FaultConfidence: 78, alertTime: '10:23:12 AM' },
    { machineId: 'WLD-041', actionLevel: 'High', operationalJudgment: 'Reduce Speed', faultRisk30Min: 71, faultRiskSeries: [28, 35, 42, 39, 53, 47, 59, 50, 64], qualityJudgment: 'Review', l1Anomaly: 'Normal', l2FaultConfidence: 74, alertTime: '10:22:47 AM' },
    { machineId: 'WLD-088', actionLevel: 'Medium', operationalJudgment: 'Monitor Closely', faultRisk30Min: 68, faultRiskSeries: [21, 29, 33, 30, 42, 37, 49, 43, 56], qualityJudgment: 'Pass', l1Anomaly: 'Normal', l2FaultConfidence: 65, alertTime: '10:22:15 AM' },
    { machineId: 'WLD-012', actionLevel: 'Medium', operationalJudgment: 'Monitor Closely', faultRisk30Min: 58, faultRiskSeries: [18, 22, 27, 23, 31, 29, 38, 35, 44], qualityJudgment: 'Pass', l1Anomaly: 'Normal', l2FaultConfidence: 63, alertTime: '10:21:54 AM' }
  ]
};
