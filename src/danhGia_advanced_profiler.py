import pandas as pd
import numpy as np
import os
import glob
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class WeldcomUltimateDataProfiler:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.file_paths = glob.glob(os.path.join(self.data_dir, '**', '*.csv'), recursive=True)
        self.overview_report = []
        self.data_dictionary = []

        self.time_col_mapping = {
            # Nhóm 1: Streaming Tín Hiệu
            'data_ot.csv': '_TIMESTAMP',
            'data_cabinetglobal_kwh.csv': 'iot_time',
            'data_iot_liquid.csv': 'iot_time',
            'data_machine_signal_his.csv': 'status_time',
            
            # Nhóm 2: Chu Kỳ Sự Kiện & Báo Cáo
            'data_iot_convert.csv': 'status_time_start',
            'data_machine_status_his.csv': 'status_time',
            'data_cabinetglobal_kwh_daily.csv': 'date',
            'data_iot_convert_daily.csv': 'date',
            
            # Nhóm 3: Cấu hình Động & Lịch sử
            'data_machine_threshold.csv': 'start_time',
            'machine_location_his_layout.csv': 'created_time',
            
            # Nhóm 4: Cấu hình Tĩnh (Master Data)
            # Lưu ý: data_machine.csv và data_electric_cabinetglobal.csv không có cột thời gian hợp lệ
            # data_machine_work_status.csv file gần như rỗng, không có dữ liệu thời gian
            'data_machine_type.csv': 'created_time',
            'data_machine_group.csv': 'created_time',
            'data_liquid_meter.csv': 'created_time',
            'data_electric_cabinet.csv': 'created_time',
            'data_machine_component.csv': 'warranty_start_date'
        }

    def _read_csv_robust(self, file_path):
        encodings = ['utf-16', 'utf-8', 'utf-8-sig', 'latin1']
        for enc in encodings:
            try:
                # Tối ưu Big Data (2GB+): Bỏ low_memory=False để giải phóng RAM
                # Ép toàn bộ đọc dưới dạng chuỗi (dtype=str) ở bước Profiling để tăng tốc độ và tránh sập RAM
                df = pd.read_csv(file_path, sep=";", encoding=enc, on_bad_lines='skip', dtype=str)

                # Dọn dẹp khoảng trắng, ký tự rác ẩn (\ufeff) để đảm bảo Mapping không bị trượt
                df.columns = [str(col).replace('\ufeff', '').replace('ï»¿', '').strip() for col in df.columns]
                return df
            except (UnicodeDecodeError, UnicodeError):
                continue
            except Exception:
                break
        return None

    def _find_primary_time_col(self, file_name, df):
        # 1. Quét theo Mapping đích danh
        file_name_lower = file_name.lower()
        if file_name_lower in self.time_col_mapping:
            target_col = self.time_col_mapping[file_name_lower].lower()
            for col in df.columns:
                if str(col).lower() == target_col:
                    return col

        # 2. Thuật toán dự phòng - quét tất cả các cột để tìm datetime hợp lệ
        best_col = None
        highest_score = -1
        
        for col in df.columns:
            col_lower = str(col).lower()
            score = 0
            
            # Ưu tiên các cột có tên liên quan đến thời gian
            if 'time' in col_lower or 'date' in col_lower or 'timestamp' in col_lower:
                if any(k in col_lower for k in ['_timestamp', 'iot_time', 'status_time_start', 'status_time']):
                    score = 100
                elif any(k in col_lower for k in ['created', 'modified', 'updated']):
                    score = 10
                else:
                    score = 50
            
            # Thử parse mẫu dữ liệu để xác nhận
            try:
                sample = df[col].dropna().head(50)
                if not sample.empty:
                    # Chuyển sang string và kiểm tra pattern datetime
                    sample_str = sample.astype(str)
                    # Kiểm tra xem có chứa pattern năm không (201|202|203)
                    has_year_pattern = sample_str.str.contains(r'201|202|203', na=False).any()
                    
                    if has_year_pattern:
                        parsed = pd.to_datetime(sample, errors='coerce')
                        valid_count = parsed.notna().sum()
                        if valid_count > 0:
                            # Tăng score dựa trên tỷ lệ dữ liệu hợp lệ
                            validity_ratio = valid_count / len(sample)
                            score += int(validity_ratio * 100)
                            
                            if score > highest_score:
                                highest_score = score
                                best_col = col
            except:
                continue
                
        return best_col

    def _evaluate_ai_readiness(self, missing_rate, duplicate_rate, time_span_days, has_time_series):
        score = 100.0
        score -= (missing_rate * 100) * 1.5
        score -= (duplicate_rate * 100) * 2.0
        
        if has_time_series:
            score += 10
            if time_span_days and time_span_days < 7:
                score -= 20
        return max(0.0, min(100.0, round(score, 2)))

    def profile_file(self, file_path):
        file_name = os.path.basename(file_path)
        folder_name = os.path.basename(os.path.dirname(file_path))
        
        if os.path.getsize(file_path) == 0:
            return {"Folder": folder_name, "File_Name": file_name, "Status": "Empty File"}
            
        df = self._read_csv_robust(file_path)
        if df is None or df.empty:
            return {"Folder": folder_name, "File_Name": file_name, "Status": "Read Error / Empty"}
            
        total_rows = len(df)
        total_cols = len(df.columns)
        
        missing_rate = df.isnull().sum().sum() / (total_rows * total_cols) if total_rows > 0 else 0
        duplicate_rate = df.duplicated().sum() / total_rows if total_rows > 0 else 0
        primary_keys = [col for col in df.columns if df[col].nunique() == total_rows and df[col].isnull().sum() == 0]
        
        primary_time_col = self._find_primary_time_col(file_name, df)
        start_time = end_time = time_span_days = rows_per_day = median_gap_str = None
        
        if primary_time_col:
            # BỘ LỌC THÉP CHO DỮ LIỆU LỚN (Ngăn lỗi 1970 và tối ưu RAM)
            raw_time_series = df[primary_time_col].astype(str)
            
            # Chiến lược 1: Lọc các dòng chứa năm thực tế (cho datetime string)
            filtered_series = raw_time_series[raw_time_series.str.contains(r'201|202|203', na=False)]
            valid_dates = pd.to_datetime(filtered_series, errors='coerce').dropna()
            
            # Chiến lược 2: Nếu không tìm thấy, thử parse numeric timestamps (Unix timestamp hoặc milliseconds)
            if valid_dates.empty:
                # Loại bỏ các giá trị không phải số
                numeric_series = pd.to_numeric(raw_time_series, errors='coerce').dropna()
                # Chỉ lấy các giá trị hợp lý (timestamp > 0 và < year 2100)
                numeric_series = numeric_series[(numeric_series > 0) & (numeric_series < 4102444800)]  # < 2100-01-01
                if not numeric_series.empty:
                    # Thử parse as Unix timestamp (seconds)
                    valid_dates = pd.to_datetime(numeric_series, unit='s', errors='coerce').dropna()
                    # Nếu vẫn không có, thử as milliseconds
                    if valid_dates.empty:
                        valid_dates = pd.to_datetime(numeric_series, unit='ms', errors='coerce').dropna()
            
            # Khóa mốc thời gian an toàn
            valid_dates = valid_dates[valid_dates.dt.year >= 2015].sort_values()
            
            if not valid_dates.empty:
                start_time = valid_dates.iloc[0]
                end_time = valid_dates.iloc[-1]
                time_span_days = (end_time - start_time).total_seconds() / 86400.0
                
                if time_span_days > 0:
                    rows_per_day = round(len(valid_dates) / time_span_days, 2)
                
                deltas = valid_dates.diff().dropna().dt.total_seconds()
                if not deltas.empty:
                    median_gap = deltas.median()
                    median_gap_str = f"{median_gap:.2f}s"

        ai_score = self._evaluate_ai_readiness(missing_rate, duplicate_rate, time_span_days, bool(primary_time_col))
        
        for col in df.columns:
            # Tối ưu Big Data: Không unique() toàn bộ cột 2GB, chỉ lấy mẫu 1000 dòng để tiết kiệm thời gian
            sample_vals = df[col].dropna().head(1000).unique()[:3].tolist()
            
            self.data_dictionary.append({
                "File_Name": file_name,
                "Column_Name": col,
                "Data_Type": "string (optimized)", 
                "Unique_Count": df[col].nunique(),
                "Missing (%)": round(df[col].isnull().mean() * 100, 2),
                "Sample_Values": str(sample_vals)
            })

        return {
            "Folder": folder_name,
            "File_Name": file_name,
            "Rows": total_rows,
            "Cols": total_cols,
            "AI_Score": ai_score,
            "Missing(%)": round(missing_rate * 100, 2),
            "Primary_Time_Col": primary_time_col if primary_time_col else "N/A",
            "Start_Time": start_time,
            "End_Time": end_time,
            "Span_(Days)": round(time_span_days, 1) if time_span_days else "N/A",
            "Median_Time_Gap": median_gap_str if median_gap_str else "N/A",
            "Rows/Day": rows_per_day if rows_per_day else "N/A",
            "PK_Found": ", ".join(primary_keys) if primary_keys else "None",
            "Status": "Success"
        }

    def run(self):
        print(f"Khởi động WELDCOM ULTIMATE PROFILER - CHẾ ĐỘ BIG DATA (>2GB)...")
        print("-" * 60)
        for file_path in self.file_paths:
            print(f"Đang đồng bộ trục thời gian và phân tích: {os.path.basename(file_path)}")
            res = self.profile_file(file_path)
            self.overview_report.append(res)
            
        overview_df = pd.DataFrame(self.overview_report)
        dict_df = pd.DataFrame(self.data_dictionary)
        
        if "AI_Score" in overview_df.columns:
            overview_df = overview_df.sort_values(by="AI_Score", ascending=False, na_position='last')
            
        output_file = "Weldcom_Ultimate_Data_Profile.xlsx"
        with pd.ExcelWriter(output_file) as writer:
            overview_df.to_excel(writer, sheet_name="AI_Architecture_Planning", index=False)
            dict_df.to_excel(writer, sheet_name="Data_Dictionary", index=False)
            
        print("-" * 60)
        print(f"Hoàn tất! Báo cáo chiến lược (Đã chặn mốc 1970 và tối ưu RAM) lưu tại: {output_file}")

if __name__ == "__main__":
    DATA_DIR = "./data" 
    profiler = WeldcomUltimateDataProfiler(DATA_DIR)
    profiler.run()