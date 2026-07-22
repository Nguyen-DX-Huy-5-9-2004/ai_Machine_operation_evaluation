param(
    [string]$Server = "L0A0P8W1",
    [string]$Database = "OBAD_AI_LOCAL",
    [string]$User = "huynd1",
    [string]$ProjectRoot = "E:\OBAD",
    [int]$BatchSize = 1000,
    [int]$ProgressEvery = 50000
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$Importer = Join-Path $ScriptDir "import_steps_5_to_8.py"
$Manifest = Join-Path $ScriptDir "steps_5_to_8_import_manifest.json"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "WELDCOM LOCAL SQL IMPORT - STEPS 5 TO 8" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Server   : $Server"
Write-Host "Database : $Database"
Write-Host "User     : $User"
Write-Host "Root     : $ProjectRoot"
Write-Host "Package  : $ScriptDir"
Write-Host ""

foreach ($requiredPath in @($Python, $Importer, $Manifest)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Không tìm thấy file bắt buộc: $requiredPath"
    }
}

Set-Location $ProjectRoot

# Verify pyodbc and choose an installed SQL Server ODBC driver.
$driverOutput = & $Python -c "import pyodbc; print('\n'.join(pyodbc.drivers()))"
if ($LASTEXITCODE -ne 0) {
    throw "Không import được pyodbc trong E:\OBAD\.venv."
}

$installedDrivers = @($driverOutput | Where-Object { $_ -and $_.Trim() })
if ($installedDrivers -contains "ODBC Driver 18 for SQL Server") {
    $Driver = "ODBC Driver 18 for SQL Server"
}
elseif ($installedDrivers -contains "ODBC Driver 17 for SQL Server") {
    $Driver = "ODBC Driver 17 for SQL Server"
}
else {
    Write-Host "Các ODBC driver hiện có:" -ForegroundColor Yellow
    $installedDrivers | ForEach-Object { Write-Host "  $_" }
    throw "Không tìm thấy ODBC Driver 17 hoặc 18 for SQL Server."
}

Write-Host "ODBC     : $Driver" -ForegroundColor Green
Write-Host ""

$securePassword = Read-Host "Nhập mật khẩu SQL Server cho user $User" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = $null

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    $env:OBAD_SQL_SERVER = $Server
    $env:OBAD_SQL_DATABASE = $Database
    $env:OBAD_SQL_DRIVER = $Driver
    $env:OBAD_SQL_TRUSTED = "no"
    $env:OBAD_SQL_USER = $User
    $env:OBAD_SQL_PASSWORD = $plainPassword

    Write-Host "Đang kiểm tra kết nối SQL..." -ForegroundColor Cyan

    $connectionTest = @"
import os, pyodbc
cs = (
    f"DRIVER={{{os.environ['OBAD_SQL_DRIVER']}}};"
    f"SERVER={os.environ['OBAD_SQL_SERVER']};"
    f"DATABASE={os.environ['OBAD_SQL_DATABASE']};"
    f"UID={os.environ['OBAD_SQL_USER']};"
    f"PWD={os.environ['OBAD_SQL_PASSWORD']};"
    "Encrypt=no;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=10"
)
with pyodbc.connect(cs) as cn:
    row = cn.cursor().execute(
        "SELECT @@SERVERNAME, DB_NAME(), SUSER_SNAME()"
    ).fetchone()
    print(f"CONNECTED|server={row[0]}|database={row[1]}|login={row[2]}")
"@

    & $Python -c $connectionTest
    if ($LASTEXITCODE -ne 0) {
        throw "Kết nối SQL thất bại. Chưa thực hiện import."
    }

    Write-Host ""
    Write-Host "[1/2] Kiểm tra CSV, encoding, header và SHA256..." -ForegroundColor Cyan

    & $Python $Importer `
        --root $ProjectRoot `
        --manifest $Manifest `
        --server $Server `
        --database $Database `
        --driver $Driver `
        --inspect-only

    if ($LASTEXITCODE -ne 0) {
        throw "Kiểm tra CSV thất bại. Chưa thực hiện import."
    }

    Write-Host ""
    Write-Host "Các file historical rất lớn; quá trình import có thể kéo dài nhiều giờ." -ForegroundColor Yellow
    $answer = Read-Host "Nhập chính xác YES để bắt đầu import vào $Database"

    if ($answer -cne "YES") {
        Write-Host "Đã dừng trước khi import. Không ghi dữ liệu." -ForegroundColor Yellow
        exit 0
    }

    $confirmation = "I_UNDERSTAND_THIS_IS_LOCAL_$($Database.ToUpperInvariant())"

    Write-Host ""
    Write-Host "[2/2] Bắt đầu import..." -ForegroundColor Cyan

    & $Python $Importer `
        --root $ProjectRoot `
        --manifest $Manifest `
        --server $Server `
        --database $Database `
        --driver $Driver `
        --batch-size $BatchSize `
        --progress-every $ProgressEvery `
        --skip-existing-matching `
        --add-missing-columns `
        --local-confirmation $confirmation

    if ($LASTEXITCODE -ne 0) {
        throw "Import thất bại. Xem audit mới nhất trong E:\OBAD\data\realtime_audit\local_historical_import_*"
    }

    Write-Host ""
    Write-Host "IMPORT HOÀN TẤT." -ForegroundColor Green
    Write-Host "Tiếp theo chạy trong SSMS:"
    Write-Host "  1. 07_CREATE_INDEXES_AFTER_IMPORT.sql"
    Write-Host "  2. E:\OBAD\sql\02a_preflight_unified_dashboard_view.sql"
    Write-Host "  3. E:\OBAD\sql\02_create_unified_dashboard_view.sql"
    Write-Host "  4. E:\OBAD\sql\03_verify_dashboard_contract.sql"
    Write-Host "  5. 08_VALIDATE_AFTER_IMPORT.sql"
}
finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    Remove-Item Env:OBAD_SQL_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:OBAD_SQL_USER -ErrorAction SilentlyContinue
    Remove-Item Env:OBAD_SQL_TRUSTED -ErrorAction SilentlyContinue
    Remove-Item Env:OBAD_SQL_SERVER -ErrorAction SilentlyContinue
    Remove-Item Env:OBAD_SQL_DATABASE -ErrorAction SilentlyContinue
    Remove-Item Env:OBAD_SQL_DRIVER -ErrorAction SilentlyContinue

    $plainPassword = $null
}
