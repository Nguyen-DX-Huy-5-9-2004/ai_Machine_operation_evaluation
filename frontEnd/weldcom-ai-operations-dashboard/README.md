# WELDCOM AI Operations Dashboard — Frontend V1

Giao diện React + Vite + Tailwind + Recharts cho màn **Futuristic AI Operations Dashboard Overview**.

Màn này được dựng theo style dashboard bạn đã chọn: dark futuristic, neon cards, chart mượt, donut risk distribution, top risky machines, L1/L2 summary, quality issue trend và bảng live alerts.

## 1. Vị trí nên đặt trong project OBAD

Copy thư mục này vào:

```text
OBAD/frontEnd/weldcom-ai-operations-dashboard/
```

## 2. Cài đặt

```powershell
cd OBAD\frontEnd\weldcom-ai-operations-dashboard
npm install
copy .env.example .env
npm run dev
```

Mở:

```text
http://localhost:5173
```

## 3. Chạy bằng dữ liệu giả lập trước

Mặc định `.env.example` để:

```env
VITE_DATA_MODE=mock
```

Chế độ này không cần backend/SQL, dùng file:

```text
src/data/mockDashboard.ts
```

Mục tiêu: kiểm tra UI giống hình trước, layout ổn, màu sắc ổn.

## 4. Chạy với FastAPI backend

Sau khi chạy backend trong file zip thứ hai, đổi `.env` thành:

```env
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:8000/api
```

Sau đó:

```powershell
npm run dev
```

## 5. Màn hình hiện có

- Dashboard overview giống hình đã chọn.
- KPI row:
  - Overall Risk Score
  - Total Machines
  - High Risk Machines
  - Quality Alerts
  - Maintenance Risk
- Main charts:
  - Machine Risk Distribution
  - Operational Risk Over Time
  - Top Machines by Risk
- AI/quality row:
  - L1 Anomaly Status
  - L2 Fault Confidence
  - Quality Issue Trend
  - Data Quality Overview
- Bottom table:
  - Live Alerts

## 6. Map dữ liệu UI với backend

Frontend gọi:

```text
GET /api/dashboard/overview
```

Response cần đúng contract trong:

```text
src/types/dashboard.ts
```

Backend zip đã có endpoint trả đúng contract này.

## 7. Lưu ý quan trọng

- UI không đọc trực tiếp CSV 4 triệu dòng.
- UI chỉ gọi API tổng hợp.
- API có thể lấy từ SQL view hoặc fallback CSV/mock.
- Những dữ liệu như event_start_time, risk_fault_30min, operational_action_level, quality_judgment, L1/L2 score nên được chuẩn hóa ở backend.

