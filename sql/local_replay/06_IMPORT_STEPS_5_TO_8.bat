@echo off
setlocal EnableExtensions

REM This BAT must stay in the same extracted folder as:
REM   06_IMPORT_STEPS_5_TO_8_SQL_LOGIN.ps1
REM   import_steps_5_to_8.py
REM   steps_5_to_8_import_manifest.json

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%06_IMPORT_STEPS_5_TO_8_SQL_LOGIN.ps1"

if not exist "%PS_SCRIPT%" (
    echo ERROR: Khong tim thay file:
    echo %PS_SCRIPT%
    echo.
    echo Hay giai nen TOAN BO file ZIP vao cung mot thu muc.
    echo Khong chay rieng file BAT tu thu muc Downloads.
    pause
    exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
    echo Script ket thuc voi ma loi %EXIT_CODE%.
) else (
    echo Script da ket thuc thanh cong.
)
pause
exit /b %EXIT_CODE%
