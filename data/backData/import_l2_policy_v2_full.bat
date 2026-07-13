@echo off
setlocal
chcp 65001 > nul
color 0A
cls

echo.
echo ===================================================
echo TIEN TRINH IMPORT DU LIEU VAO SQL SERVER
echo ===================================================

set "SERVER_IP=10.29.134.73,45193"
set "USER=i26s02004"
set "PASS=pfKJBmFdnQWrVqnJs"
set "DB=i26s02004_dat_dev"

set "FILE_PATH=C:\Users\huynd1\Downloads\ai_l2_fault_judgment_policy_v2_all.csv"
set "TARGET_TABLE=dbo.ai_l2_fault_judgment_policy_v2_full" 
set "ERROR_LOG=C:\Users\huynd1\Downloads\import_error.log"

echo [Database]: %DB%
echo [Bang dich]: %TARGET_TABLE%
echo [File nguon]: %FILE_PATH%
echo.
echo Bat dau import du lieu. Vui long doi...
echo.

bcp "%TARGET_TABLE%" in "%FILE_PATH%" -c -C 65001 -t"," -r"0x0A" -S "tcp:%SERVER_IP%;Encrypt=no" -d "%DB%" -U "%USER%" -P "%PASS%" -b 100000 -F 2 -e "%ERROR_LOG%"

if errorlevel 1 (
    echo.
    echo [ERROR] Qua trinh import gap loi!
    echo Vui long kiem tra chi tiet dong bi loi tai: %ERROR_LOG%
) else (
    echo.
    echo === HOAN THANH IMPORT ===
)

pause
goto :eof