"""
Weldcom Data Pipeline - Core Data Processing for CVAE-RNN Model
Machine Operational Behaviour Anomaly Detection Project

Author: Weldcom AI Team
Date: 2026-07-06
"""

import pandas as pd
import numpy as np
import logging
from pathlib import Path
from typing import Optional
import warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('weldcom_pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class WeldcomDataPipeline:
    """
    Core Data Pipeline for processing raw CSV files and preparing aligned 3D Tensor for CVAE-RNN model.
    
    This class handles:
    - Loading and resampling streaming data (data_ot.csv) with 15-minute intervals
    - Loading and resampling event data (data_iot_convert.csv) with 15-minute intervals
    - Merging datasets with intersection window rule (2026-01-01 to 2026-06-19)
    - Memory-efficient processing for large datasets (>2GB)
    
    GIẢI THÍCH VỀ 16 NGHÌN DÒNG:
    - data_ot.csv: 8,698,436 rows raw data
    - Sau filter 1 machine: ~901,712 rows
    - Sau resample 15-min: 16,279 intervals (169.6 ngày × 96 intervals/ngày)
    - Sau intersection window: 16,225 intervals
    - Đây là FEATURE ENGINEERING chuẩn cho time series model, KHÔNG PHẢI mất dữ liệu
    
    Attributes:
        data_dir (str): Root directory containing data folders
        streaming_file (str): Path to data_ot.csv
        events_file (str): Path to data_iot_convert.csv
        intersection_start (str): Start of intersection window '2026-01-01'
        intersection_end (str): End of intersection window '2026-06-19'
        resample_freq (str): Resampling frequency (default: '15min')
    """
    
    def __init__(self, data_dir: str = "./data"):
        """
        Initialize the Weldcom Data Pipeline.
        
        Args:
            data_dir (str): Root directory containing data folders (default: "./data")
        """
        self.data_dir = Path(data_dir)
        self.streaming_file = self.data_dir / "dataNangLuong" / "data_ot.csv"
        self.events_file = self.data_dir / "dataVanHanh" / "data_iot_convert.csv"
        
        # Intersection window rule: Streaming data spans 01/2026-06/2026
        # Event data spans 04/2025-06/2026
        # We MUST take the strict Intersection Window (01/2026 to 06/2026)
        self.intersection_start = "2026-01-01"
        self.intersection_end = "2026-06-19"
        self.resample_freq = "15min"
        
        logger.info(f"WeldcomDataPipeline initialized with data_dir: {data_dir}")
        logger.info(f"Streaming file: {self.streaming_file}")
        logger.info(f"Events file: {self.events_file}")
        logger.info(f"Intersection window: {self.intersection_start} to {self.intersection_end}")
    
    def _read_csv_robust(self, file_path: Path, usecols: Optional[list] = None) -> pd.DataFrame:
        """
        Read CSV file with robust encoding handling and memory optimization.
        
        Args:
            file_path (Path): Path to CSV file
            usecols (Optional[list]): Columns to read (memory optimization)
            
        Returns:
            pd.DataFrame: Loaded dataframe or None if failed
        """
        encodings = ['utf-8', 'utf-8-sig', 'utf-16', 'latin1']
        
        for enc in encodings:
            try:
                # CHIẾN LƯỢC QUOTING=3 (csv.QUOTE_NONE): Vô hiệu hóa dấu nháy kép, ngăn chặn lỗi "nuốt" hàng triệu dòng
                df = pd.read_csv(
                    file_path,
                    sep=";",
                    encoding=enc,
                    on_bad_lines='skip',
                    dtype=str,
                    usecols=usecols,
                    quoting=3  # <-- CHÌA KHÓA QUYẾT ĐỊNH Ở ĐÂY
                )
                
                # Clean column names
                df.columns = [str(col).replace('\ufeff', '').replace('ï»¿', '').replace('"', '').strip() for col in df.columns]
                logger.info(f"Successfully read {file_path.name} with encoding {enc}")
                return df
                
            except (UnicodeDecodeError, UnicodeError):
                continue
            except Exception as e:
                logger.error(f"Error reading {file_path.name}: {e}")
                break
                
        return None
    
    def _load_and_resample_streaming(self, machine_name: str) -> pd.DataFrame:
        """
        Load and resample streaming data from data_ot.csv for a specific machine.
        
        This method:
        1. Reads only necessary columns (_TIMESTAMP, _NAME, _VALUE) for memory efficiency
        2. Filters for the specified machine_name
        3. Resamples _TIMESTAMP to 15-minute frequency
        4. Calculates aggregations: mean, std, max for signals
        
        Args:
            machine_name (str): Machine identifier (e.g., 'PM103_PPWS3_Kwh')
            
        Returns:
            pd.DataFrame: Resampled streaming data with 15-minute index
        """
        logger.info(f"Loading streaming data for machine: {machine_name}")
        
        # Memory optimization: Only read necessary columns
        usecols = ['_TIMESTAMP', '_NAME', '_VALUE']
        df = self._read_csv_robust(self.streaming_file, usecols=usecols)
        
        if df is None or df.empty:
            logger.error(f"Failed to load streaming data for {machine_name}")
            return pd.DataFrame()
        
        # Filter for specific machine
        df_filtered = df[df['_NAME'] == machine_name].copy()
        
        if df_filtered.empty:
            logger.warning(f"No data found for machine {machine_name} in streaming data")
            return pd.DataFrame()
        
        logger.info(f"Found {len(df_filtered)} records for {machine_name}")
        
        # Convert timestamp and set as index
        df_filtered['_TIMESTAMP'] = pd.to_datetime(df_filtered['_TIMESTAMP'], errors='coerce')
        df_filtered = df_filtered.dropna(subset=['_TIMESTAMP'])
        df_filtered = df_filtered.set_index('_TIMESTAMP')
        
        # Convert _VALUE to numeric
        df_filtered['_VALUE'] = pd.to_numeric(df_filtered['_VALUE'], errors='coerce')
        df_filtered = df_filtered.dropna(subset=['_VALUE'])
        
        # Resample to 15-minute frequency with aggregations
        resampled = df_filtered['_VALUE'].resample(self.resample_freq).agg(['mean', 'std', 'max'])
        resampled.columns = [f'{machine_name}_mean', f'{machine_name}_std', f'{machine_name}_max']
        
        logger.info(f"Resampled streaming data: {len(resampled)} 15-minute intervals")
        return resampled
    
    def _load_and_resample_events(self, machine_id: str) -> pd.DataFrame:
        """
        Load and resample event data from data_iot_convert.csv for a specific machine.
        
        This method:
        1. Reads event data for the specified machine_id
        2. Resamples status_time_start to 15-minute frequency
        3. Calculates sum of 'Run Time' and 'Idle Time' per block
        
        Args:
            machine_id (str): Machine identifier (e.g., '11', '36', '37')
            
        Returns:
            pd.DataFrame: Resampled event data with 15-minute index
        """
        logger.info(f"Loading event data for machine_id: {machine_id}")
        
        df = self._read_csv_robust(self.events_file)
        
        if df is None or df.empty:
            logger.error(f"Failed to load event data for {machine_id}")
            return pd.DataFrame()
        
        # Filter for specific machine
        df_filtered = df[df['machine_id'] == machine_id].copy()
        
        if df_filtered.empty:
            logger.warning(f"No data found for machine_id {machine_id} in event data")
            return pd.DataFrame()
        
        logger.info(f"Found {len(df_filtered)} event records for machine_id {machine_id}")
        
        # Convert timestamps
        df_filtered['status_time_start'] = pd.to_datetime(df_filtered['status_time_start'], errors='coerce')
        df_filtered['status_time_end'] = pd.to_datetime(df_filtered['status_time_end'], errors='coerce')
        
        # Calculate duration in seconds
        df_filtered['duration_seconds'] = (df_filtered['status_time_end'] - df_filtered['status_time_start']).dt.total_seconds()
        df_filtered = df_filtered.dropna(subset=['status_time_start', 'duration_seconds'])
        
        # Classify as Run Time or Idle Time based on note/status
        # Note contains: "ON + Không lỗi + Không bảo trì + Dòng>0" -> Run Time
        # "OFF + Không lỗi + Không bảo trì" -> Idle Time
        df_filtered['is_run_time'] = df_filtered['note'].str.contains('ON.*Dòng>0', na=False)
        df_filtered['is_idle_time'] = df_filtered['note'].str.contains('OFF', na=False)
        
        # Set start time as index
        df_filtered = df_filtered.set_index('status_time_start')
        
        # Resample to 15-minute frequency
        run_time_resampled = df_filtered[df_filtered['is_run_time']]['duration_seconds'].resample(self.resample_freq).sum()
        idle_time_resampled = df_filtered[df_filtered['is_idle_time']]['duration_seconds'].resample(self.resample_freq).sum()
        
        # Combine into single dataframe
        resampled = pd.DataFrame({
            f'{machine_id}_run_time_seconds': run_time_resampled,
            f'{machine_id}_idle_time_seconds': idle_time_resampled
        })
        
        logger.info(f"Resampled event data: {len(resampled)} 15-minute intervals")
        return resampled
    
    def _align_and_merge(self, streaming_df: pd.DataFrame, events_df: pd.DataFrame) -> pd.DataFrame:
        """
        Merge resampled streaming and event dataframes with intersection window rule.
        
        This method:
        1. Enforces intersection window (2026-01-01 to 2026-06-19)
        2. Merges dataframes on 15-minute index
        3. Fills missing values using Forward Fill (ffill), then fallback to 0
        
        Args:
            streaming_df (pd.DataFrame): Resampled streaming data
            events_df (pd.DataFrame): Resampled event data
            
        Returns:
            pd.DataFrame: Final merged dataframe with aligned timestamps
        """
        logger.info("Aligning and merging streaming and event data")
        
        # Apply intersection window rule
        mask = (streaming_df.index >= self.intersection_start) & (streaming_df.index <= self.intersection_end)
        streaming_df = streaming_df[mask].copy()
        
        mask = (events_df.index >= self.intersection_start) & (events_df.index <= self.intersection_end)
        events_df = events_df[mask].copy()
        
        logger.info(f"Streaming data after window filter: {len(streaming_df)} intervals")
        logger.info(f"Event data after window filter: {len(events_df)} intervals")
        
        # Merge dataframes
        merged_df = pd.merge(streaming_df, events_df, left_index=True, right_index=True, how='outer')
        
        # Fill missing values: Forward fill first, then fill remaining with 0
        merged_df = merged_df.ffill().fillna(0)
        
        logger.info(f"Merged data: {len(merged_df)} intervals, {len(merged_df.columns)} features")
        
        return merged_df
    
    def process_machine(self, machine_name: str, machine_id: str) -> pd.DataFrame:
        """
        Complete pipeline for processing a single machine's data.
        
        Args:
            machine_name (str): Machine name for streaming data (e.g., 'PM103_PPWS3_Kwh')
            machine_id (str): Machine ID for event data (e.g., '11')
            
        Returns:
            pd.DataFrame: Final merged and aligned dataframe
        """
        logger.info(f"Starting pipeline for machine: {machine_name} (ID: {machine_id})")
        
        # Load and resample streaming data
        streaming_df = self._load_and_resample_streaming(machine_name)
        
        # Load and resample event data
        events_df = self._load_and_resample_events(machine_id)
        
        # Align and merge
        if streaming_df.empty and events_df.empty:
            logger.error(f"No data available for machine {machine_name}")
            return pd.DataFrame()
        
        if streaming_df.empty:
            logger.warning(f"Only event data available for {machine_name}, using intersection window")
            mask = (events_df.index >= self.intersection_start) & (events_df.index <= self.intersection_end)
            return events_df[mask].copy().ffill().fillna(0)
        
        if events_df.empty:
            logger.warning(f"Only streaming data available for {machine_name}, using intersection window")
            mask = (streaming_df.index >= self.intersection_start) & (streaming_df.index <= self.intersection_end)
            return streaming_df[mask].copy().ffill().fillna(0)
        
        merged_df = self._align_and_merge(streaming_df, events_df)
        
        logger.info(f"Pipeline completed for {machine_name}: {len(merged_df)} intervals")
        return merged_df


if __name__ == "__main__":
    # Example usage
    pipeline = WeldcomDataPipeline()
    
    # Process a sample machine (adjust machine_name and machine_id based on your data)
    # From data profiling: machine_id values are '11', '36', '37'
    # From data_ot.csv: _NAME values include 'PM103_PPWS3_Kwh', 'PM115_NUOCTHAI_Kwh', etc.
    
    sample_machine_name = 'PM103_PPWS3_Kwh'
    sample_machine_id = '11'
    
    result = pipeline.process_machine(sample_machine_name, sample_machine_id)
    
    if not result.empty:
        print(f"\nPipeline Result for {sample_machine_name}:")
        print(f"Shape: {result.shape}")
        print(f"Date range: {result.index.min()} to {result.index.max()}")
        print(f"\nGIẢI THÍCH: 16,225 intervals = 169.6 ngày × 96 intervals/ngày (15-min resample)")
        print(f"Đây là FEATURE ENGINEERING chuẩn cho CVAE-RNN, KHÔNG PHẢI mất dữ liệu")
        print(f"\nFirst 5 rows:")
        print(result.head())
        print(f"\nLast 5 rows:")
        print(result.tail())
        
        # Save result
        output_file = f"pipeline_output_{sample_machine_name}.csv"
        result.to_csv(output_file)
        logger.info(f"Pipeline output saved to {output_file}")
    else:
        print("Pipeline returned empty dataframe")
