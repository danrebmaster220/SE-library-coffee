# Railway MySQL Database Initialization Script
# This script will connect to Railway and run the database schema

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Railway MySQL Database Initialization" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Railway Connection Details
$host_name = "mainline.proxy.rlwy.net"
$port = "28638"
$username = "root"
$database = "railway"

# Prompt for password securely
Write-Host "Enter your Railway MySQL password: " -NoNewline -ForegroundColor Yellow
$password = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plain_password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""
Write-Host "Connecting to Railway MySQL..." -ForegroundColor Green

# Path to mysql executable
$mysql_path = ".\mariadb\bin\mysql.exe"
$sql_file = ".\backend\config\coffee_database.sql"

# Execute SQL file
try {
    Get-Content $sql_file | & $mysql_path -h $host_name -P $port -u $username -p$plain_password --protocol=TCP --skip-ssl $database
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Database schema created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Verify tables in Railway Dashboard -> Database tab" -ForegroundColor White
        Write-Host "2. Run seed script to create default users" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ Error creating database schema" -ForegroundColor Red
        Write-Host "Exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
