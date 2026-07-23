import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ContributionItem,
  MachineDetailResponse,
} from "../../types/machineDetail";
import { EvidencePanel } from "./EvidencePanel";
import { InfoDot } from "./InfoDot";
import { L1AnomalyChart } from "./L1AnomalyChart";
import { L2RisksChart } from "./L2RisksChart";
import { ChartTooltip } from "./ChartTooltip";

interface Props {
  data: MachineDetailResponse;
}

const contributionColor = (item: ContributionItem) => {
  if (item.direction === "risk_down") return "#19d982";
  if (item.direction === "neutral") return "#f6c343";
  return "#ff3657";
};

export function AiAnalysisTab({ data }: Props) {
  return (
    <div className="md-tab-workspace ai-analysis-tab">
      <section className="md-tab-grid two-one">
        <div className="md-decision-stack md-panel">
          <div className="md-panel-header compact">
            <div className="md-title-with-info">
              <h3>AI Decision Stack</h3>
              <InfoDot text="Step-by-step view of how L1 anomaly, L2 confidence, quality policy, and final policy gate combine into the final decision." />
            </div>
            <span className="generated-at">{data.apiMeta.policyVersion}</span>
          </div>
          <div className="md-decision-flow">
            {data.aiDecisionSteps.map((step, index) => (
              <article
                className={`md-decision-step level-${String(step.level).toLowerCase()}`}
                key={step.id}
              >
                <div className="step-index">{index + 1}</div>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                  <small>{step.sourceFields.join(" • ")}</small>
                </div>
                <strong>{step.value}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="md-panel md-contribution-card">
          <div className="md-panel-header compact">
            <div className="md-title-with-info">
              <h3>Risk Contribution</h3>
              <InfoDot text="Evidence-weighted view derived from the current L1, L2, quality, and energy fields. It is not a SHAP attribution or a substitute for the final policy explanation." />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={276}>
            <BarChart
              data={data.aiContributions}
              layout="vertical"
              margin={{ top: 6, right: 18, bottom: 6, left: 36 }}
            >
              <CartesianGrid
                stroke="#183555"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: "#87a3c5", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="label"
                type="category"
                tick={{ fill: "#b9cae1", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={118}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={false}
                offset={16}
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 400, pointerEvents: "none" }}
              />
              <Bar dataKey="value" name="Contribution" radius={[0, 7, 7, 0]}>
                {data.aiContributions.map((item) => (
                  <Cell key={item.label} fill={contributionColor(item)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="md-main-chart-grid compact-charts">
        <L1AnomalyChart data={data.l1Series} />
        <L2RisksChart data={data.riskSeries} />
      </section>

      <EvidencePanel
        operationalEvidence={data.operationalEvidence}
        energyDataEvidence={data.energyDataEvidence}
        finalReason={data.finalReason}
        generatedAt={data.apiMeta.generatedAt}
      />
    </div>
  );
}
