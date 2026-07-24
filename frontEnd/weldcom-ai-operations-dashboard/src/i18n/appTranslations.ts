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

// Product copy is deliberately curated rather than machine-translated. The
// monitor still keeps model names, SQL identifiers, Policy v2 and L1/L2 target
// names in English because they are part of the engineering contract.
const vietnameseUiCopy: Record<string, string> = {
  'Historical production scoring and operational-risk intelligence': 'Chấm điểm dữ liệu lịch sử và phân tích rủi ro vận hành',
  'Current SQL scoring and operational-risk intelligence': 'Chấm điểm SQL hiện tại và phân tích rủi ro vận hành',
  'Loading dashboard intelligence...': 'Đang tải dữ liệu phân tích vận hành...',
  'Preparing the SQL-backed operational overview.': 'Đang chuẩn bị màn tổng quan vận hành từ SQL.',
  'Historical replay is file-only': 'Replay lịch sử chỉ ghi file',
  'All Machines': 'Tất cả máy',
  'Critical Machines': 'Máy mức nghiêm trọng',
  'All Locations': 'Tất cả vị trí',
  'All Action Levels': 'Tất cả mức hành động',
  'Filters': 'Bộ lọc',
  'Last 24 Hours': '24 giờ gần nhất',
  'Last 7 Days': '7 ngày gần nhất',
  'Last 30 Days': '30 ngày gần nhất',
  'Last 90 Days': '90 ngày gần nhất',
  'Full Historical Range': 'Toàn bộ dữ liệu lịch sử',
  'Daily': 'Theo ngày',
  'Hourly': 'Theo giờ',
  'Weekly': 'Theo tuần',
  'Machine Risk Distribution': 'Phân bố mức rủi ro máy',
  'Operational Risk Over Time': 'Xu hướng rủi ro vận hành',
  'Top Machines by Risk': 'Máy có rủi ro cao nhất',
  'L1 Anomaly Status': 'Trạng thái bất thường L1',
  'L2 Fault Confidence': 'Độ tin cậy lỗi L2',
  'Quality Issue Trend': 'Xu hướng vấn đề chất lượng dữ liệu',
  'Data Quality Overview': 'Tổng quan chất lượng dữ liệu',
  'Operational Alerts': 'Cảnh báo vận hành',
  'Operational Alerts in Historical Dataset': 'Cảnh báo vận hành trong dữ liệu lịch sử',
  'Total Machines': 'Tổng số máy',
  'Machine': 'Máy',
  'Score': 'Điểm',
  'Top by current risk': 'Xếp theo rủi ro hiện tại',
  'Top by critical count': 'Xếp theo số lần nghiêm trọng',
  'Top by maintenance risk': 'Xếp theo rủi ro bảo trì',
  'Top by data quality issue': 'Xếp theo vấn đề chất lượng dữ liệu',
  'View Details': 'Xem chi tiết',
  'View All Alerts': 'Xem tất cả cảnh báo',
  'View All Events': 'Xem tất cả sự kiện',
  'Critical': 'Nghiêm trọng',
  'High': 'Cao',
  'Medium': 'Trung bình',
  'Low': 'Thấp',
  'No Data': 'Chưa có dữ liệu',
  'Normal': 'Bình thường',
  'Anomaly': 'Bất thường',
  'Healthy': 'Ổn định',
  'Running': 'Đang hoạt động',
  'Operational': 'Đang vận hành',
  'Pass': 'Đạt',
  'Fail': 'Không đạt',
  'Review': 'Cần xem xét',
  'CHECK_DATA': 'CHECK_DATA · Kiểm tra dữ liệu',
  'CHECK_ENERGY': 'CHECK_ENERGY · Kiểm tra năng lượng',
  'CHECK_DATA_AND_ENERGY': 'CHECK_DATA_AND_ENERGY · Kiểm tra dữ liệu và năng lượng',
  'QUALITY_OK': 'QUALITY_OK · Dữ liệu đạt',
  'Machine ID': 'Mã máy',
  'Location': 'Vị trí',
  'Action Level': 'Mức hành động',
  'Operational Judgment': 'Đánh giá vận hành',
  'Fault Risk 30min': 'Rủi ro lỗi 30 phút',
  'Maintenance Risk': 'Rủi ro bảo trì',
  'Repair Risk': 'Rủi ro sửa chữa',
  'Quality Judgment': 'Đánh giá chất lượng',
  'L1 Anomaly': 'Bất thường L1',
  'Final Reason': 'Lý do cuối',
  'Event Time': 'Thời điểm sự kiện',
  'Actions': 'Thao tác',
  'Machine Detail': 'Chi tiết máy',
  'Back to machines': 'Quay lại danh sách máy',
  'Timeline': 'Dòng thời gian',
  'AI Analysis': 'Phân tích AI',
  'Performance': 'Hiệu năng',
  'Energy': 'Năng lượng',
  'Maintenance': 'Bảo trì',
  'Operational Timeline': 'Dòng thời gian vận hành',
  'Selected Range': 'Khoảng thời gian đã chọn',
  'AI Decision Stack': 'Chuỗi quyết định AI',
  'Risk Contribution': 'Đóng góp vào rủi ro',
  'Contribution': 'Mức đóng góp',
  'AI Explainability & Evidence': 'Diễn giải AI và bằng chứng',
  'Operational Evidence': 'Bằng chứng vận hành',
  'Energy & Data Evidence': 'Bằng chứng năng lượng và dữ liệu',
  'Final Reason (V2)': 'Lý do cuối (V2)',
  'Confidence': 'Độ tin cậy',
  'L1 Score': 'Điểm L1',
  'L2 Confidence': 'Độ tin cậy L2',
  'Recent Events': 'Sự kiện gần đây',
  'Event time': 'Thời điểm sự kiện',
  'Status': 'Trạng thái',
  'Duration': 'Thời lượng',
  'KWh delta': 'Chênh lệch KWh',
  'KWh source': 'Nguồn KWh',
  'Gap from prev': 'Khoảng cách với sự kiện trước',
  'L1 result': 'Kết quả L1',
  'Quality': 'Chất lượng',
  'Open Timeline': 'Mở dòng thời gian',
  'Explain AI': 'Giải thích AI',
  'View Detail': 'Xem chi tiết',
  'L1 Anomaly Score Over Time': 'Xu hướng điểm bất thường L1',
  'L2 Risks Over Time': 'Xu hướng rủi ro L2',
  'Event KWh Delta': 'Chênh lệch KWh theo sự kiện',
  'Loaded Status vs KWh Evidence': 'Trạng thái có tải và bằng chứng KWh',
  'AI Model Monitor': 'Giám sát mô hình AI',
  'Monitor AI runtime, model accuracy, scoring health, data contract and model governance.': 'Theo dõi runtime AI, chất lượng mô hình, sức khỏe chấm điểm, hợp đồng dữ liệu và quản trị mô hình.',
  'AI Runtime Status': 'Trạng thái runtime AI',
  'L1 Scoring Coverage': 'Mức bao phủ chấm điểm L1',
  'L1 Alert Rate': 'Tỷ lệ cảnh báo L1',
  'L2 Positive Prediction Rate': 'Tỷ lệ dự đoán dương tính L2',
  'Calibration & Threshold Health': 'Hiệu chỉnh xác suất và sức khỏe ngưỡng',
  'Data / Feature Drift': 'Drift dữ liệu / đặc trưng',
  'Scoring Run Success Rate': 'Tỷ lệ lần chấm điểm thành công',
  'L1 — Dual TCN Autoencoder Performance': 'L1 — Hiệu năng Dual TCN Autoencoder',
  'L2 — LightGBM Multi-label Classifier Performance': 'L2 — Hiệu năng LightGBM đa nhãn',
  'L2 Positive Prediction Rate by Target': 'Tỷ lệ dự đoán dương tính L2 theo mục tiêu',
  'Scoring Funnel': 'Phễu chấm điểm',
  'AI 2-Layer Decision Flow': 'Luồng quyết định AI hai lớp',
  'Data Contract & Feature Health': 'Hợp đồng dữ liệu và sức khỏe đặc trưng',
  'Example Decision Trace': 'Dấu vết quyết định mẫu',
  'Latest Bounded Inference': 'Lần suy luận bounded gần nhất',
  'Runtime Environment': 'Môi trường runtime',
  'Artifact Integrity': 'Tính toàn vẹn artifact',
  'Feature Availability': 'Độ sẵn sàng đặc trưng',
  'Missing Feature Rate': 'Tỷ lệ thiếu đặc trưng',
  'Event ID Alignment': 'Đối sánh Event ID',
  'L1 Window Availability': 'Độ sẵn sàng cửa sổ L1',
  'SQL ↔ Historical Parity': 'Tính tương đồng SQL ↔ historical',
  'Not available': 'Chưa có dữ liệu',
  'Not calculated': 'Chưa tính toán',
  'No recent run': 'Chưa có lần chạy gần đây',
  'Generated': 'Tạo lúc',
  'Source': 'Nguồn',
  'Threshold': 'Ngưỡng',
  'Target': 'Mục tiêu',
  'Train': 'Huấn luyện',
  'Validation': 'Kiểm định',
  'Test': 'Kiểm tra',
  'Overall': 'Tổng thể',
  'Machines': 'Máy móc',
  'Historical Mode': 'Chế độ lịch sử',
  'Production Candidate': 'Ứng viên production',
  'Export': 'Xuất dữ liệu',
  'Machine detail sections': 'Các phần chi tiết máy',
  'Updating the selected time range without resetting this view': 'Đang cập nhật khoảng thời gian đã chọn mà không đặt lại màn hình hiện tại',
  'Current Operational Alerts': 'Cảnh báo vận hành hiện tại',
  'Grouped by operational_action_level.': 'Phân nhóm theo operational_action_level.',
  'No Data means no current L1 + L2 + Policy result is available in the selected scope.': 'Chưa có dữ liệu nghĩa là chưa có kết quả L1, L2 và Policy hiện hành trong phạm vi đã chọn.',
  'Operational Risk Score': 'Điểm rủi ro vận hành',
  'Line A Machines': 'Máy thuộc Line A',
  'Line B Machines': 'Máy thuộc Line B',
  'Line A': 'Line A',
  'Line B': 'Line B',
  'Line C': 'Line C',
  'Line D': 'Line D',
  'ON (Loaded)': 'BẬT (Có tải)',
  'ON (No-load)': 'BẬT (Không tải)',
  'OFF': 'TẮT',
  'Fault': 'Lỗi',
  'Selected': 'Đang chọn',
  'Candidate': 'Ứng viên',
  'Profile': 'Hồ sơ',
  'Normal FPR': 'FPR bình thường',
  'Known-fault recall': 'Recall lỗi đã biết',
  'Average precision': 'Độ chính xác trung bình',
  'Accuracy': 'Độ chính xác',
  'Support': 'Số mẫu',
  'Behavioral anomaly detection · window size: 20 events': 'Phát hiện bất thường hành vi · cửa sổ 20 sự kiện',
  'Deviation validation and risk prediction by target': 'Xác thực độ lệch và dự đoán rủi ro theo từng mục tiêu',
  'View detailed L1 metrics': 'Xem chỉ số L1 chi tiết',
  'View detailed L2 metrics': 'Xem chỉ số L2 chi tiết',
  'View full report': 'Xem toàn bộ báo cáo',
  'Check item': 'Hạng mục kiểm tra',
  'Value': 'Giá trị',
  'Trend': 'Xu hướng',
  'Historical model evaluation': 'Đánh giá mô hình lịch sử',
  'Model input': 'Đầu vào mô hình',
  'Total': 'Tổng',
  'Processed difference': 'Chênh lệch đã xử lý',
  'Actual KWh': 'KWh thực tế',
  'Expected KWh': 'KWh kỳ vọng',
  'Loaded': 'Có tải',
  'Deviation': 'Độ lệch',
  'Consistency': 'Tính nhất quán',
  'KWh Availability': 'Độ sẵn sàng KWh',
  'Raw': 'Dữ liệu gốc',
  'Imputed': 'Được bù',
  'Missing': 'Thiếu',
  'KWh Delta (24h)': 'Chênh lệch KWh (24 giờ)',
  'KWh Rate (Avg)': 'Tốc độ KWh (trung bình)',
  'KWh Source': 'Nguồn KWh',
  'Loaded Zero KWh': 'Có tải nhưng KWh bằng 0',
  'Negative KWh': 'KWh âm',
  'Missing KWh': 'Thiếu KWh',
  'No material inconsistency': 'Không phát hiện mâu thuẫn đáng kể',
  'Review event evidence': 'Xem lại bằng chứng sự kiện',
  'Good coverage': 'Độ bao phủ tốt',
  'Review data coverage': 'Xem lại độ bao phủ dữ liệu',
  'Raw + controlled fill': 'Dữ liệu gốc + bù có kiểm soát',
  'Event-level source': 'Nguồn theo sự kiện',
  'Needs validation': 'Cần xác thực',
  'Check meter logic': 'Kiểm tra logic đồng hồ đo',
  'Recent events': 'Sự kiện gần đây',
  'Max': 'Cao nhất',
  'Min': 'Thấp nhất',
  'Peak': 'Đỉnh',
  'event': 'sự kiện',
  'events': 'sự kiện',
  'Last 50': '50 sự kiện gần nhất',
  'Unable to load mock demo data.': 'Không thể tải dữ liệu mock.',
  'Unable to load real API data.': 'Không thể tải dữ liệu API thực.',
  'Loading monitor data...': 'Đang tải dữ liệu giám sát mô hình...',
  'Retry': 'Thử lại',
  'Refresh monitor': 'Làm mới giám sát mô hình',
  'No prediction-rate series available for this range.': 'Chưa có chuỗi tỷ lệ dự đoán dương tính cho khoảng thời gian này.',
  'Fault 30min': 'Rủi ro lỗi 30 phút',
  'Fault 60min': 'Rủi ro lỗi 60 phút',
  'Maintenance 30 events': 'Rủi ro bảo trì 30 sự kiện',
  'Repair 30 events': 'Rủi ro sửa chữa 30 sự kiện',
  'Stage': 'Tầng',
  'Events': 'Sự kiện',
  'Conversion': 'Tỷ lệ chuyển đổi',
  'conversion': 'chuyển đổi',
  'Not scored events': 'Sự kiện chưa được chấm điểm',
  'View reasons': 'Xem lý do',
  'Selected time range': 'Khoảng thời gian đã chọn',
  'Input Evidence': 'Bằng chứng đầu vào',
  'L1 — Dual TCN': 'L1 — Dual TCN',
  'L2 — Risks': 'L2 — Rủi ro',
  'View full trace': 'Xem toàn bộ dấu vết',
  'No bounded inference sample available.': 'Chưa có mẫu suy luận bounded để hiển thị.',
  'Assessment explanation': 'Diễn giải kết quả đánh giá',
  'Latest bounded inference': 'Lần suy luận bounded gần nhất',
  'Input / policy-ready': 'Đầu vào / sẵn sàng cho Policy',
  'SQL writes': 'Lần ghi SQL',
  'Completed': 'Hoàn tất',
  'LIVE SQL': 'SQL trực tiếp',
  'RUNTIME AUDIT': 'Audit runtime',
  'VALIDATED ARTIFACT': 'Artifact đã xác thực',
  'DEMO REFERENCE': 'Tham chiếu trình diễn',
  'SIMULATED TREND': 'Xu hướng mô phỏng',
  'MIXED SOURCES': 'Nguồn hỗn hợp',
  'Operating Mix': 'Cơ cấu vận hành',
  'Loaded %': 'Có tải %',
  'No-load %': 'Không tải %',
  'Off %': 'Tắt máy %',
  'Duration & Gap Health': 'Sức khỏe thời lượng và khoảng hở',
  'Avg duration': 'Thời lượng trung bình',
  'Gap count': 'Số khoảng hở',
  'Throughput vs KWh Rate': 'Thông lượng và tốc độ KWh',
  'KWh rate': 'Tốc độ KWh',
  'Loaded ratio': 'Tỷ lệ có tải',
  'No-load ratio': 'Tỷ lệ không tải',
  'Off ratio': 'Tỷ lệ tắt máy',
  'Avg event duration': 'Thời lượng sự kiện trung bình',
  'Transitions': 'Chuyển trạng thái',
  'Abnormal durations': 'Thời lượng bất thường',
  'Big gaps': 'Khoảng hở lớn',
  'Throughput index': 'Chỉ số thông lượng',
  'productive loaded time': 'thời gian có tải tạo sản lượng',
  'running without load': 'vận hành không tải',
  'idle/off window': 'khoảng dừng/tắt',
  'per event segment': 'trên mỗi phân đoạn sự kiện',
  'status changes': 'số lần đổi trạng thái',
  'duration outliers': 'ngoại lệ thời lượng',
  'sequence breaks': 'đứt chuỗi sự kiện',
  'readiness KPI': 'KPI sẵn sàng',
  'Machine-level energy evidence': 'Bằng chứng năng lượng theo từng máy',
  'Event KWh values are used as evidence for this machine. Cabinet/global KWh must stay at coarse location/day level unless backend supplies a validated machine-cabinet bridge.': 'KWh theo event là bằng chứng cho máy này. KWh tủ điện/tổng chỉ được dùng ở mức vị trí/ngày, trừ khi backend cung cấp liên kết máy–tủ đã xác thực.',
  'SQL event evidence': 'Bằng chứng sự kiện từ SQL',
  'Energy Rule Checks': 'Kiểm tra quy tắc năng lượng',
  'Loaded but zero KWh': 'Có tải nhưng KWh bằng 0',
  'Loaded without KWh': 'Có tải nhưng thiếu KWh',
  'Negative KWh delta': 'Chênh lệch KWh âm',
  'Mixed source': 'Nguồn hỗn hợp',
  'Energy Interpretation': 'Diễn giải năng lượng',
  'Energy consistency is weak but not standalone proof of machine failure.': 'Tính nhất quán năng lượng thấp nhưng không phải bằng chứng độc lập để kết luận máy hỏng.',
  'KWh inconsistency supports the L1/L2 warning, but data quality and KWh source must be reviewed before treating energy as a hard fault signal.': 'Mâu thuẫn KWh hỗ trợ cảnh báo L1/L2, nhưng cần rà soát chất lượng dữ liệu và nguồn KWh trước khi coi đây là tín hiệu lỗi chắc chắn.',
  'Event Explorer': 'Tra cứu sự kiện',
  'All statuses': 'Tất cả trạng thái',
  'All action levels': 'Tất cả mức hành động',
  'latest available rows': 'các dòng mới nhất hiện có',
  'Critical events': 'Sự kiện nghiêm trọng',
  'L1 anomaly events': 'Sự kiện bất thường L1',
  'behavior anomaly': 'bất thường hành vi',
  'requires validation': 'cần xác thực',
  'Status Distribution': 'Phân bố trạng thái',
  'Maintenance & Repair Risk': 'Rủi ro bảo trì và sửa chữa',
  'Maintenance risk': 'Rủi ro bảo trì',
  'Repair risk': 'Rủi ro sửa chữa',
  'Maintenance Signals': 'Tín hiệu bảo trì',
  'Inspection Plan': 'Kế hoạch kiểm tra',
  'Export checklist': 'Xuất danh sách kiểm tra',
  'Raw Events': 'Sự kiện nguồn',
  'Valid Feature Events': 'Sự kiện có đặc trưng hợp lệ',
  'L1 Window Available': 'Có cửa sổ L1',
  'L1 Scored Events': 'Sự kiện đã chấm L1',
  'L2 Scored Events': 'Sự kiện đã chấm L2',
  'Policy Decisions': 'Quyết định Policy',
  'SQL / Event Stream': 'SQL / Luồng sự kiện',
  'Feature Builder': 'Bộ tạo đặc trưng',
  'L1 Dual TCN Autoencoder': 'L1 Dual TCN Autoencoder',
  'L1 Behavior Deviation Score': 'Điểm lệch hành vi L1',
  'L2 LightGBM Multi-label': 'L2 LightGBM đa nhãn',
  'Policy v2 Decision Engine': 'Bộ quyết định Policy v2',
  'Operational Alerts & Dashboard': 'Cảnh báo vận hành và Dashboard',
  'Success': 'Thành công',
  'Failed': 'Thất bại',
  'Duration (s)': 'Thời lượng (giây)',
  'Event Alignment': 'Đối sánh sự kiện',
  'Missing Rate': 'Tỷ lệ thiếu',
  'Demo stability visualization; production thresholds are listed separately.': 'Mô phỏng độ ổn định; các ngưỡng production được liệt kê riêng.',
  'Lower is better for FPR': 'FPR càng thấp càng tốt',
  'Higher is better for recall / precision / F1': 'Recall / precision / F1 càng cao càng tốt',
  'Due': 'Hạn thực hiện',
  'Owner': 'Phụ trách',
  'System evaluation': 'Đánh giá hệ thống',
  'Local fixture data': 'Dữ liệu mẫu cục bộ',
  'SQL runtime ready. Some AI Monitor charts show historical model-evaluation series.': 'SQL runtime đã sẵn sàng. Một số biểu đồ AI Model Monitor hiển thị chuỗi đánh giá mô hình lịch sử.',
  'DEMO DATA': 'DỮ LIỆU DEMO',
  'MOCK DATA': 'DỮ LIỆU MẪU',
  'API DATA': 'DỮ LIỆU API',
  'OPERATIONAL': 'SẴN SÀNG VẬN HÀNH',
  'STARTING / NOT READY': 'ĐANG KHỞI ĐỘNG / CHƯA SẴN SÀNG',
  'Rapid risk escalation with repeated fault confidence spikes.': 'Rủi ro tăng nhanh với nhiều đỉnh độ tin cậy lỗi lặp lại.',
  'Fault confidence and quality action level are both elevated.': 'Độ tin cậy lỗi và mức hành động chất lượng dữ liệu đều tăng cao.',
  'Fault risk remains high while behavior signal is stable.': 'Rủi ro lỗi vẫn cao trong khi tín hiệu hành vi ổn định.',
  'Operational risk above threshold with moderate maintenance load.': 'Rủi ro vận hành vượt ngưỡng với tải bảo trì ở mức trung bình.',
  'Data quality risk requires validation before operational escalation.': 'Rủi ro chất lượng dữ liệu cần được xác thực trước khi nâng mức cảnh báo vận hành.',
  'Moderate fault risk; continue monitoring current window.': 'Rủi ro lỗi ở mức trung bình; tiếp tục theo dõi cửa sổ hiện tại.',
  'High risk fault pattern detected': 'Phát hiện mẫu lỗi có rủi ro cao',
  'Energy spike with gap before': 'Đỉnh năng lượng kèm khoảng hở trước đó',
  'No load signature': 'Dấu hiệu không tải',
  'Machine idle': 'Máy đang nhàn rỗi',
  'Scheduled maintenance': 'Bảo trì theo kế hoạch',
  'Missing KWh and short duration': 'Thiếu KWh và thời lượng ngắn',
  'Loaded energy pattern above baseline': 'Mẫu năng lượng có tải vượt đường cơ sở',
  'High energy spike with abnormal sensor readings and repeated fault evidence.': 'Đỉnh năng lượng cao, cảm biến bất thường và có bằng chứng lỗi lặp lại.',
};

// API payloads intentionally retain canonical enum values. Translate their
// operator-facing rendering here, while preserving model names and field IDs.
const vietnameseCanonicalValueCopy: Record<string, string> = {
  CRITICAL: 'NGHIÊM TRỌNG',
  HIGH: 'CAO',
  MEDIUM: 'TRUNG BÌNH',
  LOW: 'THẤP',
  NORMAL: 'BÌNH THƯỜNG',
  ANOMALY: 'BẤT THƯỜNG',
  READY: 'SẴN SÀNG',
  PASS: 'ĐẠT',
  FAIL: 'KHÔNG ĐẠT',
  WARNING: 'CẢNH BÁO',
  REVIEW: 'CẦN XEM XÉT',
  ACTIVE: 'ĐANG HOẠT ĐỘNG',
  ON_LOADED: 'BẬT (CÓ TẢI)',
  ON_NO_LOAD: 'BẬT (KHÔNG TẢI)',
  OFF: 'TẮT',
  FAULT: 'LỖI',
  MAINTENANCE: 'BẢO TRÌ',
  DATA_ISSUE: 'VẤN ĐỀ DỮ LIỆU',
  NO_DATA: 'CHƯA CÓ DỮ LIỆU',
  MIXED_RAW_FILL: 'DỮ LIỆU GỐC + BÙ CÓ KIỂM SOÁT',
};

export function translateUiText(value: string, language: AppLanguage) {
  if (language === 'en') return value;
  return vietnameseUiCopy[value] ?? vietnameseCanonicalValueCopy[value] ?? value;
}

export function useUiText() {
  const language = useAppLanguage();
  return (value: string) => translateUiText(value, language);
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
