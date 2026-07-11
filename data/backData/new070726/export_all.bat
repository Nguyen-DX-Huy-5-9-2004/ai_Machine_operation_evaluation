@echo off
setlocal
chcp 65001 > nul
color 0A
cls

echo.

REM ==========================================
REM CẤU HÌNH KẾT NỐI CHUNG 
REM Tách riêng SERVER_IP để dùng chuẩn cho cả sqlcmd và bcp
REM ==========================================
set "SERVER_IP=10.29.134.73,45193"
set "USER=i26s02004"
set "PASS=pfKJBmFdnQWrVqnJs"
set "OUT_DIR=E:\export"

REM --- DATABASE: i26s02004_iot_dev ---
set "DB=i26s02004_iot_dev"
echo [Đang xử lý Database: %DB%]...
REM call :ExportTable "dbo.data_ot"
REM call :ExportTable "dbo.tbl_status"
REM call :ExportTable "dbo.wdi_datachange_log"
REM call :ExportTable "dbo.data_welding_device_realtime_info"
echo.

REM --- DATABASE: i26s02004_dat_dev ---
set "DB=i26s02004_dat_dev"
echo [Đang xử lý Database: %DB%]...
call :ExportTable "ai_l1_operation_event_sequence"
call :ExportTable "ai_l2_fault_confidence_event"
REM call :ExportTable "dbo.data_iot_convert"
REM call :ExportTable "dbo.data_iot_convert_daily"
REM call :ExportTable "dbo.data_machine_signal_his"
REM call :ExportTable "dbo.data_machine_status_his"
REM call :ExportTable "dbo.data_machine_work_status"
REM call :ExportTable "dbo.data_cabinetglobal_kwh"
REM call :ExportTable "dbo.data_cabinetglobal_kwh_daily"
REM call :ExportTable "dbo.data_machine"
REM call :ExportTable "dbo.data_machine_component"
REM call :ExportTable "dbo.data_machine_threshold"
REM call :ExportTable "dbo.data_machine_group"
REM call :ExportTable "dbo.data_machine_type"
REM call :ExportTable "dbo.data_electric_cabinet"
REM call :ExportTable "dbo.data_electric_cabinetglobal"
REM call :ExportTable "dbo.data_iot_liquid"
REM call :ExportTable "dbo.data_liquid_meter"
REM call :ExportTable "dbo.machine_location_his_layout"
REM call :ExportTable "dbo.data_machine_issue"
REM call :ExportTable "dbo.data_machine_repair"
REM call :ExportTable "dbo.data_machine_document"
REM call :ExportTable "dbo.welding_parameter_lookup"
REM call :ExportTable "dbo.data_liquid_meter_group"
REM call :ExportTable "dbo.data_iot_liquid_daily"
REM call :ExportTable "dbo.data_iot_liquid_status"
REM call :ExportTable "dbo.welding_wire_density"
REM call :ExportTable "dbo.data_error"
REM call :ExportTable "dbo.data_machine_maintenance_his"
REM call :ExportTable "dbo.data_maintenance"
REM call :ExportTable "dbo.data_error_group"
REM call :ExportTable "dbo.data_iot_device_connect_his"
REM call :ExportTable "dbo.data_installation_device_iot_and_his"
REM call :ExportTable "dbo.view_iot_map_mms_v1"
REM call :ExportTable "dbo.megmeet_system_device_statistical_hourly_report"
REM call :ExportTable "dbo.megmeet_system_device_statistical_report"
REM call :ExportTable "dbo.data_iot_convert_megmeet"
REM call :ExportTable "dbo.data_iot_liquid_summary_config"
REM call :ExportTable "dbo.data_iot_device"
REM call :ExportTable "dbo.data_follow_iot"

echo.
echo === HOÀN THÀNH HOÀN TOÀN ===
pause
goto :eof

:ExportTable
set "FULL_TABLE=%~1"
set "FILE_NAME=%FULL_TABLE:dbo.=%"

echo  - Đang trích xuất: %FILE_NAME%...

sqlcmd -S "tcp:%SERVER_IP%" -C -d "%DB%" -U "%USER%" -P "%PASS%" -h -1 -W -Q "SET NOCOUNT ON; SELECT STUFF((SELECT ';' + name FROM sys.columns WHERE object_id = OBJECT_ID('%FULL_TABLE%') ORDER BY column_id FOR XML PATH('')), 1, 1, '')" -o "%OUT_DIR%\%FILE_NAME%_header.csv"

bcp "%FULL_TABLE%" out "%OUT_DIR%\%FILE_NAME%_data.csv" -c -C 65001 -t";" -S "tcp:%SERVER_IP%;Encrypt=no" -d "%DB%" -U "%USER%" -P "%PASS%" > nul

copy /b "%OUT_DIR%\%FILE_NAME%_header.csv" + "%OUT_DIR%\%FILE_NAME%_data.csv" "%OUT_DIR%\%FILE_NAME%.csv" > nul

del "%OUT_DIR%\%FILE_NAME%_header.csv"
del "%OUT_DIR%\%FILE_NAME%_data.csv"

goto :eof