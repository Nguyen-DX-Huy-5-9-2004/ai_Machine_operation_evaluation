import sidebarTranslationsXml from "./sidebar-translations.xml?raw";
import { createContext, useContext } from "react";

export type AppLanguage = "en" | "vi";

export type SidebarMenuKey =
  | "dashboard"
  | "controlRoom"
  | "machines"
  | "machineDetail"
  | "alerts"
  | "riskAnalytics"
  | "dataQuality"
  | "energyConsistency"
  | "maintenance"
  | "aiModelMonitor"
  | "reports"
  | "settings";

type StatusKey = "Operational" | "Degraded" | "Offline" | "Healthy" | "Delayed";

type SidebarCopy = {
  menu: Record<SidebarMenuKey, string>;
  tooltips: Record<SidebarMenuKey, string>;
  plantSystemStatus: string;
  activeMachines: string;
  dataPipeline: string;
  lastUpdated: string;
  statuses: Record<StatusKey, string>;
};

export const AppLanguageContext = createContext<AppLanguage>("en");

export function useAppLanguage() {
  return useContext(AppLanguageContext);
}

const menuKeys: SidebarMenuKey[] = [
  "dashboard", "controlRoom", "machines", "machineDetail", "alerts", "riskAnalytics",
  "dataQuality", "energyConsistency", "maintenance", "aiModelMonitor", "reports", "settings",
];
const statusKeys: StatusKey[] = ["Operational", "Degraded", "Offline", "Healthy", "Delayed"];

function text(element: Element | null, fallback = "") {
  return element?.textContent?.trim() || fallback;
}

function itemMap(root: Element, section: "menu" | "tooltips") {
  return Object.fromEntries(
    menuKeys.map((key) => [key, text(root.querySelector(`${section} > item[key="${key}"]`), key)]),
  ) as Record<SidebarMenuKey, string>;
}

function parseLanguage(document: XMLDocument, language: AppLanguage): SidebarCopy {
  const root = document.querySelector(`language[code="${language}"]`);
  if (!root) throw new Error(`Missing sidebar translation for ${language}`);

  return {
    menu: itemMap(root, "menu"),
    tooltips: itemMap(root, "tooltips"),
    plantSystemStatus: text(root.querySelector("labels > plantSystemStatus")),
    activeMachines: text(root.querySelector("labels > activeMachines")),
    dataPipeline: text(root.querySelector("labels > dataPipeline")),
    lastUpdated: text(root.querySelector("labels > lastUpdated")),
    statuses: Object.fromEntries(
      statusKeys.map((key) => [key, text(root.querySelector(`statuses > status[key="${key}"]`), key)]),
    ) as Record<StatusKey, string>,
  };
}

const xmlDocument = new DOMParser().parseFromString(sidebarTranslationsXml, "application/xml");

// Local XML keeps UI copy concise, domain-specific, and independent of machine translation.
export const sidebarCopy: Record<AppLanguage, SidebarCopy> = {
  en: parseLanguage(xmlDocument, "en"),
  vi: parseLanguage(xmlDocument, "vi"),
};

const infoTooltipCopy = new Map(
  Array.from(xmlDocument.querySelectorAll("tooltipTranslations > tooltip")).map((tooltip) => [
    text(tooltip.querySelector("source")),
    { en: text(tooltip.querySelector("en")), vi: text(tooltip.querySelector("vi")) },
  ]),
);

type TooltipCopy = Record<AppLanguage, string>;

// Static panel copy lives in sidebar-translations.xml. These entries cover
// runtime/hybrid messages assembled by mappers, where the exact source string
// can be selected by backend state rather than declared in JSX.
const runtimeTooltipCopy: Record<string, TooltipCopy> = {
  'Evidence-weighted view derived from the current L1, L2, quality, and energy fields. It is not a SHAP attribution or a substitute for the final policy explanation.': {
    en: 'Evidence-weighted view derived from current L1, L2, quality, and energy fields. It is not a SHAP attribution and does not replace the final policy explanation.',
    vi: 'Góc nhìn theo trọng số bằng chứng từ L1, L2, chất lượng dữ liệu và năng lượng hiện tại. Đây không phải SHAP và không thay thế phần giải thích cuối của Policy.',
  },
  'Most recent SQL-backed events for the selected machine. Filters will narrow this evidence without replacing the rest of the page.': {
    en: 'Most recent SQL-backed events for the selected machine. Filters narrow this evidence without replacing the rest of the page.',
    vi: 'Các event SQL gần nhất của máy đang chọn. Bộ lọc chỉ thu hẹp tập bằng chứng này, không thay thế dữ liệu ở các phần khác của trang.',
  },
  'Event-level KWh difference after the energy preparation used by AI. It is not voltage or a cabinet total; a negative value means the processed delta is below its reference.': {
    en: 'Event-level KWh difference after the energy preparation used by AI. It is not voltage or a cabinet total; a negative value is below the processed reference.',
    vi: 'Chênh lệch KWh theo event sau bước chuẩn bị năng lượng cho AI. Đây không phải điện áp hay tổng KWh của tủ điện; giá trị âm nghĩa là delta đã xử lý thấp hơn mốc tham chiếu.',
  },
  'Compares event KWh with loaded status joined from the machine timeline. It is supporting evidence, not a hard diagnosis alone.': {
    en: 'Compares event KWh with loaded status from the machine timeline. It is supporting evidence, not a standalone diagnosis.',
    vi: 'So sánh KWh của event với trạng thái có tải từ timeline máy. Đây là bằng chứng hỗ trợ, không phải chẩn đoán độc lập.',
  },
  'Mock mode is intentionally marked as demo data.': {
    en: 'Mock mode uses a fixed historical model-evaluation dataset so every panel can be reviewed consistently without a backend request.',
    vi: 'Chế độ mock dùng bộ dữ liệu đánh giá lịch sử cố định để mọi panel được kiểm tra nhất quán mà không cần gọi backend.',
  },
  'API mode is operational only when backend readiness, runtime environment, artifact integrity and required monitor data are all verified.': {
    en: 'API mode is operational only when backend readiness, runtime environment, artifact integrity, and required monitor data are verified.',
    vi: 'API chỉ được xem là sẵn sàng vận hành khi backend, môi trường runtime, tính toàn vẹn artifact và dữ liệu monitor bắt buộc đều đã được xác thực.',
  },
  'The API is loading, a required endpoint is unavailable, or readiness checks have not passed.': {
    en: 'The API is loading, a required endpoint is unavailable, or readiness checks have not passed.',
    vi: 'API đang tải, một endpoint bắt buộc chưa sẵn sàng hoặc các kiểm tra readiness chưa đạt.',
  },
  'Backend readiness and runtime gates. HTTP success alone does not make this operational.': {
    en: 'Backend readiness and runtime gates. HTTP success alone does not make this operational.',
    vi: 'Trạng thái sẵn sàng của backend và các gate runtime. HTTP trả về thành công không tự động có nghĩa hệ thống đã sẵn sàng vận hành.',
  },
  'Share of audited input events with an L1 scoring window.': {
    en: 'Share of audited input events with an L1 scoring window.',
    vi: 'Tỷ lệ event đầu vào đã audit có đủ cửa sổ ngữ cảnh để chấm điểm L1.',
  },
  'Rates from the latest bounded inference audit; not a machine-fault count.': {
    en: 'Rates from the latest bounded inference audit; not a machine-fault count.',
    vi: 'Tỷ lệ từ bounded inference audit gần nhất; không phải số lượng máy bị lỗi.',
  },
  'Requires a real per-target prediction-rate series for the selected range.': {
    en: 'Requires a real per-target prediction-rate series for the selected range.',
    vi: 'Cần chuỗi tỷ lệ dự đoán dương tính thực tế theo từng target trong phạm vi đã chọn.',
  },
  'Threshold coverage from the validated model metadata JSON.': {
    en: 'Threshold coverage from the validated model metadata JSON.',
    vi: 'Mức độ đầy đủ của threshold lấy từ JSON metadata mô hình đã xác thực.',
  },
  'Drift is intentionally not inferred from unrelated runtime counts.': {
    en: 'Drift is intentionally not inferred from unrelated runtime counts.',
    vi: 'Drift được chủ động không suy diễn từ các số đếm runtime không liên quan.',
  },
  'Success is based on the latest completed bounded inference audit.': {
    en: 'Success is based on the latest completed bounded inference audit.',
    vi: 'Trạng thái thành công dựa trên bounded inference audit hoàn tất gần nhất.',
  },
  'Static validated model reference. It is not a live runtime metric.': {
    en: 'Static validated model reference. It is not a live runtime metric.',
    vi: 'Thông tin tham chiếu tĩnh từ artifact mô hình đã xác thực, không phải chỉ số runtime trực tiếp.',
  },
  'Read-only runtime evidence from the API/SQL monitor path.': {
    en: 'Read-only runtime evidence from the API/SQL monitor path.',
    vi: 'Bằng chứng runtime chỉ đọc từ luồng monitor API/SQL.',
  },
  'Demo KWh quality reference; no runtime endpoint is currently connected.': {
    en: 'Historical KWh data-quality assessment. This check evaluates energy consistency and source completeness; a dedicated runtime endpoint is not connected yet.',
    vi: 'Kết quả đánh giá lịch sử về chất lượng KWh. Chỉ số kiểm tra tính nhất quán năng lượng và độ đầy đủ nguồn KWh; hiện chưa có endpoint runtime riêng cho phép đo này.',
  },
  'Bounded dry-run reference only; this is not realtime production.': {
    en: 'Bounded inference-audit result. It verifies the pipeline on a fixed input scope and is distinct from a continuous realtime production run.',
    vi: 'Kết quả bounded inference audit. Nó kiểm chứng pipeline trên một phạm vi đầu vào cố định và khác với lần chạy production realtime liên tục.',
  },
};

function contextualTooltipFallback(source: string, language: AppLanguage) {
  if (language === 'en') return source;
  const normalized = source.toLowerCase();
  if (normalized.includes('historical model-evaluation data')) {
    return 'Dữ liệu đánh giá lịch sử của mô hình cho chỉ số này. Dữ liệu mô tả hành vi, mức độ bao phủ hoặc chất lượng của mô hình trong giai đoạn đánh giá; không làm thay đổi suy luận runtime, Policy v2 hay dữ liệu SQL.';
  }
  if (normalized.includes('historical evaluation trend')) {
    return 'Xu hướng đánh giá lịch sử của mô hình. Biểu đồ giúp quan sát biến thiên của chỉ số trong giai đoạn đánh giá, không phải tín hiệu điều khiển runtime.';
  }
  if (normalized.includes('historical model-assessment check')) {
    return 'Kết quả kiểm tra trong bộ dữ liệu đánh giá mô hình. Chỉ số này phản ánh mức độ sẵn sàng của dữ liệu hoặc đặc trưng trước khi mô hình được đánh giá.';
  }
  if (normalized.includes('decision-flow node')) {
    return 'Nút trong luồng ra quyết định L1 - L2. Nó mô tả vai trò của lớp xử lý tương ứng từ dữ liệu đầu vào, điểm L1, rủi ro L2 đến quyết định của Policy v2.';
  }
  if (normalized.includes('historical scoring funnel')) {
    return 'Phễu chấm điểm lịch sử: mỗi tầng cho biết số event còn đủ điều kiện sau một gate xử lý trong cùng phạm vi đánh giá.';
  }
  if (normalized.includes('historical assessment explanation')) {
    return 'Giải thích lịch sử cho đường đi đã chọn qua L1, sáu mô hình L2 và Policy v2. Nội dung cho biết bằng chứng nào dẫn đến kết luận vận hành.';
  }
  if (normalized.includes('demo') || normalized.includes('presentation') || normalized.includes('simulated')) {
    if (normalized.includes('kwh') || normalized.includes('energy')) return 'Chuỗi đánh giá lịch sử về KWh và tính nhất quán năng lượng. Chỉ số cho biết mức độ khớp giữa trạng thái vận hành, KWh và các quy tắc chất lượng dữ liệu.';
    if (normalized.includes('feature') || normalized.includes('contract')) return 'Kết quả đánh giá lịch sử về độ sẵn sàng của đặc trưng và hợp đồng dữ liệu. Chỉ số này dùng để theo dõi chất lượng đầu vào của mô hình.';
    if (normalized.includes('funnel')) return 'Phễu đánh giá lịch sử, thể hiện số event còn lại sau từng gate từ dữ liệu nguồn đến quyết định vận hành.';
    if (normalized.includes('trend') || normalized.includes('series')) return 'Chuỗi xu hướng từ giai đoạn đánh giá mô hình, dùng để quan sát biến thiên của chỉ số theo thời gian hoặc theo mục tiêu dự báo.';
    if (normalized.includes('trace') || normalized.includes('explanation')) return 'Dấu vết đánh giá L1, L2 và Policy v2 cho một event đại diện, giúp diễn giải cách hệ thống đi đến kết luận.';
    return 'Dữ liệu đánh giá lịch sử của mô hình cho chỉ số này. Giá trị giúp so sánh chất lượng, độ ổn định hoặc độ bao phủ của mô hình trong phạm vi đánh giá.';
  }
  if (normalized.includes('artifact') || normalized.includes('metadata')) {
    return 'Thông tin từ artifact hoặc metadata mô hình đã xác thực; không phải chỉ số runtime trực tiếp.';
  }
  if (normalized.includes('audit') || normalized.includes('runtime') || normalized.includes('sql')) {
    return 'Thông tin runtime/audit chỉ đọc. Giá trị phản ánh phạm vi dữ liệu hiện có, không thay đổi model hoặc Policy.';
  }
  if (normalized.includes('policy')) {
    return 'Giải thích liên quan đến Policy v2: policy chuyển output L1/L2 và bằng chứng thành action, judgment và lý do cuối.';
  }
  return 'Thông tin giải thích cho chỉ số này trong ngữ cảnh đánh giá vận hành Weldcom AI.';
}

export function translateInfoTooltip(source: string, language: AppLanguage) {
  return infoTooltipCopy.get(source)?.[language]
    || runtimeTooltipCopy[source]?.[language]
    || contextualTooltipFallback(source, language);
}
