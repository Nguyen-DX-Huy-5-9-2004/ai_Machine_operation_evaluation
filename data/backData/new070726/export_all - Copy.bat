@echo off
setlocal
chcp 65001 > nul
color 0A
cls

echo.

set "SERVER_IP=10.29.134.73,45193"
set "USER=i26s02004"
set "PASS=pfKJBmFdnQWrVqnJs"
set "OUT_DIR=E:\export"

set "DB=i26s02004_dat_dev"
echo [Đang xử lý Database: %DB%]...
call :ExportTable "dbo.vw_ai_l1_train_normal_lenient"
call :ExportTable "dbo.vw_ai_l1_train_normal_strict"
call :ExportTable "dbo.ai_l2_future_fault_label"
call :ExportTable "dbo.vw_ai_l2_train_final"
echo.
echo === HOÀN THÀNH HOÀN TOÀN ===
pause
goto :eof

:ExportTable
set "FULL_TABLE=%~1"
set "FILE_NAME=%FULL_TABLE:dbo.=%"

echo  - Đang trích xuất: %FILE_NAME%...

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

REM Tao header
bcp "SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF; SELECT STUFF((SELECT N';' + c.name COLLATE DATABASE_DEFAULT FROM sys.columns AS c WHERE c.object_id = OBJECT_ID(N'%FULL_TABLE%') ORDER BY c.column_id FOR XML PATH(''), TYPE).value(N'.', N'nvarchar(max)'), 1, 1, N'') COLLATE DATABASE_DEFAULT" queryout "%OUT_DIR%\%FILE_NAME%_header.csv" -c -C 65001 -S "tcp:%SERVER_IP%;Encrypt=no" -d "%DB%" -U "%USER%" -P "%PASS%" > "%OUT_DIR%\%FILE_NAME%_header_bcp.log" 2>&1

if errorlevel 1 (
    echo [ERROR] Tao header loi: %FULL_TABLE%
    type "%OUT_DIR%\%FILE_NAME%_header_bcp.log"
    goto :eof
)

REM Xuat data bang queryout de bat du SET options
bcp "SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF; SELECT * FROM %FULL_TABLE%" queryout "%OUT_DIR%\%FILE_NAME%_data.csv" -c -C 65001 -t";" -S "tcp:%SERVER_IP%;Encrypt=no" -d "%DB%" -U "%USER%" -P "%PASS%" -e "%OUT_DIR%\%FILE_NAME%_error.log" > "%OUT_DIR%\%FILE_NAME%_data_bcp.log" 2>&1

if errorlevel 1 (
    echo [ERROR] BCP data loi: %FULL_TABLE%
    type "%OUT_DIR%\%FILE_NAME%_data_bcp.log"
    goto :eof
)

copy /b "%OUT_DIR%\%FILE_NAME%_header.csv" + "%OUT_DIR%\%FILE_NAME%_data.csv" "%OUT_DIR%\%FILE_NAME%.csv" > nul

del "%OUT_DIR%\%FILE_NAME%_header.csv"
del "%OUT_DIR%\%FILE_NAME%_data.csv"

echo  - Xong: %FILE_NAME%.csv
goto :eof