import pandas as pd
import numpy as np
import os
import glob
import warnings

warnings.filterwarnings('ignore')

class WeldcomMarkdownProfiler:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.file_paths = glob.glob(os.path.join(self.data_dir, '**', '*.csv'), recursive=True)
        self.overview_report = []
        self.data_dictionaries = {}

    def _read_csv_safe(self, file_path):
        encodings = ['utf-16', 'utf-8', 'utf-8-sig', 'latin1']
        for enc in encodings:
            try:
                df = pd.read_csv(file_path, encoding=enc, on_bad_lines='skip', low_memory=False)
                df.columns = [str(col).strip() for col in df.columns]
                return df
            except (UnicodeDecodeError, UnicodeError):
                continue
            except Exception as e:
                print(f"Lỗi đọc file {file_path} với encoding {enc}: {e}")
                break
        return None

    def _evaluate_ai_readiness(self, missing_rate, duplicate_rate, has_time_col):
        """Chấm điểm AI Readiness Score."""
        score = 100.0
        score -= (missing_rate * 100) * 1.5
        score -= (duplicate_rate * 100) * 2.0
        if has_time_col:
            score += 10
        return max(0.0, min(100.0, round(score, 2)))

    def profile_file(self, file_path):
        file_name = os.path.basename(file_path)
        folder_name = os.path.basename(os.path.dirname(file_path))
        
        if os.path.getsize(file_path) == 0:
            return {"Folder": folder_name, "File_Name": file_name, "Status": "Empty File"}
            
        df = self._read_csv_safe(file_path)
        if df is None or df.empty:
            return {"Folder": folder_name, "File_Name": file_name, "Status": "Read Error / Empty"}

        total_rows = len(df)
        total_cols = len(df.columns)
        
        # 1. Chất lượng dữ liệu
        missing_cells = df.isnull().sum().sum()
        missing_rate = missing_cells / (total_rows * total_cols) if total_rows > 0 else 0
        duplicate_rate = df.duplicated().sum() / total_rows if total_rows > 0 else 0
        
        constant_cols = [col for col in df.columns if df[col].nunique(dropna=True) <= 1]
        high_missing_cols = [col for col in df.columns if df[col].isnull().mean() > 0.8]
        
        # 2. Khóa & Ràng buộc
        primary_keys = [col for col in df.columns if df[col].nunique() == total_rows and df[col].isnull().sum() == 0]
        # Nhận diện Foreign Key tiềm năng dựa trên suffix '_id'
        foreign_keys = [col for col in df.columns if str(col).lower().endswith('_id') and col not in primary_keys]

        # 3. Chuỗi thời gian
        time_cols = [col for col in df.columns if 'time' in str(col).lower() or 'date' in str(col).lower()]
        
        # 4. Điểm AI
        ai_score = self._evaluate_ai_readiness(missing_rate, duplicate_rate, bool(time_cols))

        # 5. Xây dựng Data Dictionary cho file này
        dict_records = []
        for col in df.columns:
            sample_vals = [str(x) for x in df[col].dropna().unique()[:3]]
            dict_records.append({
                "Column": col,
                "Type": str(df[col].dtype),
                "Unique_Count": df[col].nunique(),
                "Missing (%)": round(df[col].isnull().mean() * 100, 2),
                "Role": "PK" if col in primary_keys else ("FK" if col in foreign_keys else "Feature"),
                "Sample": ", ".join(sample_vals)
            })
        
        self.data_dictionaries[file_name] = pd.DataFrame(dict_records)

        return {
            "Folder": folder_name,
            "File_Name": file_name,
            "Rows": total_rows,
            "Columns": total_cols,
            "AI_Score": ai_score,
            "Missing (%)": round(missing_rate * 100, 2),
            "Duplicate (%)": round(duplicate_rate * 100, 2),
            "Constant_Cols": len(constant_cols),
            "PK_Found": ", ".join(primary_keys) if primary_keys else "None",
            "FK_Found": len(foreign_keys),
            "Status": "Success"
        }

    def run(self):
        print("Bắt đầu quét sâu dữ liệu và xử lý định dạng Encoding...")
        for file_path in self.file_paths:
            print(f"Đang phân tích: {os.path.basename(file_path)}")
            res = self.profile_file(file_path)
            self.overview_report.append(res)

        # Tạo file Markdown
        overview_df = pd.DataFrame(self.overview_report)
        if "AI_Score" in overview_df.columns:
            overview_df = overview_df.sort_values(by="AI_Score", ascending=False, na_position='last')

        md_lines = []
        md_lines.append("# BÁO CÁO PHÂN TÍCH CHẤT LƯỢNG DỮ LIỆU WELDCOM (AI READINESS)\n")
        md_lines.append("Tài liệu này được sinh tự động phục vụ cho việc hoạch định chiến lược AI.\n")
        
        md_lines.append("## 1. TỔNG QUAN (OVERVIEW)\n")
        md_lines.append(overview_df.to_markdown(index=False))
        md_lines.append("\n\n---\n")

        md_lines.append("## 2. TỪ ĐIỂN DỮ LIỆU CHI TIẾT (DATA DICTIONARY)\n")
        for file_name, d_df in self.data_dictionaries.items():
            md_lines.append(f"### File: `{file_name}`\n")
            md_lines.append(d_df.to_markdown(index=False))
            md_lines.append("\n\n")

        output_file = "Weldcom_Data_Profile_Report.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))

        print(f"\nHoàn tất! Đã xuất báo cáo chuẩn Markdown tại: {output_file}")
        print("Hãy copy hoặc upload trực tiếp nội dung file này vào Gemini.")

if __name__ == "__main__":
    DATA_DIR = "./data" 
    profiler = WeldcomMarkdownProfiler(DATA_DIR)
    profiler.run()