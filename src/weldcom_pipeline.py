import pandas as pd
import numpy as np
import os
import glob
from datetime import datetime
import csv
import warnings
warnings.filterwarnings('ignore')

class WeldcomDataPipeline:
    """
    Pipeline xử lý dữ liệu tối đa cho AI Training - RAW DATA + MULTI-MACHINE + ROLLING WINDOWS
    
    Chiến lược mới:
    - Process TOP 10 machines từ data_ot.csv
    - KHÔNG resample, giữ raw data (~900K rows/machine)
    - Thêm rolling window features (mean, std, max qua 15-min, 1-hour)
    - Tổng: ~9 triệu rows với nhiều features
    """
    
    def __init__(self, data_dir="./data"):
        self.data_dir = data_dir
        self.streaming_file = os.path.join(data_dir, "dataNangLuong", "data_ot.csv")
        self.events_file = os.path.join(data_dir, "dataVanHanh", "data_iot_convert.csv")
        
        # Intersection window
        self.intersection_start = "2026-01-01"
        self.intersection_end = "2026-06-19"
        
        print(f"WeldcomDataPipeline initialized - RAW DATA MODE")
        print(f"Streaming file: {self.streaming_file}")
        print(f"Events file: {self.events_file}")
    
    def _read_csv_robust(self, file_path, usecols=None):
        """Đọc CSV với encoding robust và quoting=3"""
        encodings = ['utf-8', 'utf-8-sig', 'utf-16', 'latin1']
        for enc in encodings:
            try:
                df = pd.read_csv(
                    file_path, 
                    sep=";", 
                    encoding=enc, 
                    on_bad_lines='skip', 
                    dtype=str,
                    usecols=usecols,
                    quoting=3
                )
                df.columns = [str(col).replace('\ufeff', '').replace('ï»¿', '').replace('"', '').strip() for col in df.columns]
                print(f"Successfully read {os.path.basename(file_path)} with encoding {enc}")
                return df
            except (UnicodeDecodeError, UnicodeError):
                continue
            except Exception as e:
                print(f"Error reading {os.path.basename(file_path)}: {e}")
                break
        return None
    
    def _get_top_machines(self, top_n=10):
        """Lấy TOP N machines có nhiều dữ liệu nhất từ data_ot.csv"""
        print(f"Finding TOP {top_n} machines with most data...")
        
        usecols = ['_NAME']
        df = self._read_csv_robust(self.streaming_file, usecols=usecols)
        
        if df is None or df.empty:
            print("Failed to load streaming data")
            return []
        
        # Count rows per machine
        machine_counts = df['_NAME'].value_counts().head(top_n)
        print(f"TOP {top_n} machines:")
        for i, (machine, count) in enumerate(machine_counts.items(), 1):
            print(f"  {i}. {machine}: {count:,} rows")
        
        return machine_counts.index.tolist()
    
    def _load_raw_streaming_data(self, machine_name):
        """Load raw streaming data cho 1 machine (KHÔNG resample)"""
        print(f"Loading raw streaming data for: {machine_name}")
        
        usecols = ['_TIMESTAMP', '_NAME', '_VALUE']
        df = self._read_csv_robust(self.streaming_file, usecols=usecols)
        
        if df is None or df.empty:
            return pd.DataFrame()
        
        # Filter cho machine
        df_filtered = df[df['_NAME'] == machine_name].copy()
        
        if df_filtered.empty:
            print(f"No data found for {machine_name}")
            return pd.DataFrame()
        
        print(f"Found {len(df_filtered):,} raw records for {machine_name}")
        
        # Convert timestamp
        df_filtered['_TIMESTAMP'] = pd.to_datetime(df_filtered['_TIMESTAMP'], errors='coerce')
        df_filtered = df_filtered.dropna(subset=['_TIMESTAMP'])
        
        # Convert value
        df_filtered['_VALUE'] = pd.to_numeric(df_filtered['_VALUE'], errors='coerce')
        df_filtered = df_filtered.dropna(subset=['_VALUE'])
        
        # Filter intersection window
        mask = (df_filtered['_TIMESTAMP'] >= self.intersection_start) & (df_filtered['_TIMESTAMP'] <= self.intersection_end)
        df_filtered = df_filtered[mask].copy()
        
        print(f"After intersection window: {len(df_filtered):,} records")
        
        # Add rolling window features
        df_filtered = df_filtered.set_index('_TIMESTAMP').sort_index()
        
        # Rolling windows: 15-min (90 rows ~ 1 row/6s), 1-hour (360 rows)
        windows = {'15min': 90, '1hour': 360}
        
        for window_name, window_size in windows.items():
            df_filtered[f'rolling_mean_{window_name}'] = df_filtered['_VALUE'].rolling(window=window_size, min_periods=1).mean()
            df_filtered[f'rolling_std_{window_name}'] = df_filtered['_VALUE'].rolling(window=window_size, min_periods=1).std()
            df_filtered[f'rolling_max_{window_name}'] = df_filtered['_VALUE'].rolling(window=window_size, min_periods=1).max()
        
        # Fill NaN from rolling windows
        df_filtered = df_filtered.bfill().fillna(0)
        
        # Add machine identifier
        df_filtered['machine_name'] = machine_name
        
        return df_filtered.reset_index()
    
    def _load_raw_events_data(self, machine_id):
        """Load raw event data cho 1 machine (KHÔNG resample)"""
        print(f"Loading raw event data for machine_id: {machine_id}")
        
        df = self._read_csv_robust(self.events_file)
        
        if df is None or df.empty:
            return pd.DataFrame()
        
        # Filter cho machine
        df_filtered = df[df['machine_id'] == machine_id].copy()
        
        if df_filtered.empty:
            print(f"No event data found for machine_id {machine_id}")
            return pd.DataFrame()
        
        print(f"Found {len(df_filtered):,} raw event records for machine_id {machine_id}")
        
        # Convert timestamps
        df_filtered['status_time_start'] = pd.to_datetime(df_filtered['status_time_start'], errors='coerce')
        df_filtered['status_time_end'] = pd.to_datetime(df_filtered['status_time_end'], errors='coerce')
        
        # Calculate duration
        df_filtered['duration_seconds'] = (df_filtered['status_time_end'] - df_filtered['status_time_start']).dt.total_seconds()
        df_filtered = df_filtered.dropna(subset=['status_time_start', 'duration_seconds'])
        
        # Filter intersection window
        mask = (df_filtered['status_time_start'] >= self.intersection_start) & (df_filtered['status_time_start'] <= self.intersection_end)
        df_filtered = df_filtered[mask].copy()
        
        print(f"After intersection window: {len(df_filtered):,} records")
        
        # Classify Run/Idle time
        df_filtered['is_run_time'] = df_filtered['note'].str.contains('ON.*Dòng>0', na=False)
        df_filtered['is_idle_time'] = df_filtered['note'].str.contains('OFF', na=False)
        
        # Add machine identifier
        df_filtered['machine_id'] = machine_id
        
        return df_filtered
    
    def process_top_machines(self, top_n=10):
        """Process TOP N machines và merge data"""
        print(f"\n=== PROCESSING TOP {top_n} MACHINES ===")
        
        # Get top machines
        top_machines = self._get_top_machines(top_n)
        
        if not top_machines:
            print(f"No machines found")
            return pd.DataFrame()
        
        all_streaming_data = []
        all_events_data = []
        
        # Process each machine
        for i, machine_name in enumerate(top_machines, 1):
            print(f"\n--- Processing machine {i}/{top_n}: {machine_name} ---")
            
            # Load streaming data
            streaming_df = self._load_raw_streaming_data(machine_name)
            if not streaming_df.empty:
                all_streaming_data.append(streaming_df)
            
            # Load events data (map machine_name to machine_id - simplified)
            # For now, use machine_name as machine_id
            events_df = self._load_raw_events_data(machine_name)
            if not events_df.empty:
                all_events_data.append(events_df)
        
        # Combine all streaming data
        if all_streaming_data:
            final_streaming_df = pd.concat(all_streaming_data, ignore_index=True)
            print(f"\nTotal streaming data: {len(final_streaming_df):,} rows")
        else:
            final_streaming_df = pd.DataFrame()
            print("No streaming data collected")
        
        # Combine all events data
        if all_events_data:
            final_events_df = pd.concat(all_events_data, ignore_index=True)
            print(f"Total events data: {len(final_events_df):,} rows")
        else:
            final_events_df = pd.DataFrame()
            print("No events data collected")
        
        return final_streaming_df, final_events_df
    
    def run(self):
        """Run pipeline và save results"""
        print("=" * 60)
        print("WELDCOM DATA PIPELINE - RAW DATA MODE FOR AI TRAINING")
        print("=" * 60)
        
        streaming_df, events_df = self.process_top_machines(top_n=10)
        
        # Save results
        if not streaming_df.empty:
            streaming_output = "weldcom_streaming_raw_data.csv"
            streaming_df.to_csv(streaming_output, index=False)
            print(f"\n✓ Streaming data saved: {streaming_output}")
            print(f"  Shape: {streaming_df.shape}")
            print(f"  Columns: {list(streaming_df.columns)}")
        
        if not events_df.empty:
            events_output = "weldcom_events_raw_data.csv"
            events_df.to_csv(events_output, index=False)
            print(f"\n✓ Events data saved: {events_output}")
            print(f"  Shape: {events_df.shape}")
            print(f"  Columns: {list(events_df.columns)}")
        
        print("\n" + "=" * 60)
        print("PIPELINE COMPLETED - RAW DATA READY FOR AI TRAINING")
        print("=" * 60)

if __name__ == "__main__":
    DATA_DIR = "./data" 
    pipeline = WeldcomDataPipeline(DATA_DIR)
    pipeline.run()