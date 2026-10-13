Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "   Starting Election Commission Management System (Java + JDBC)" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path "bin\com\ecms\ElectionCommissionApp.class")) {
    Write-Host "[INFO] Binaries not found. Compiling Java sources..." -ForegroundColor Yellow
    if (-not (Test-Path "bin")) { New-Item -ItemType Directory -Path "bin" | Out-Null }
    $sources = Get-ChildItem -Path src -Filter "*.java" -Recurse | ForEach-Object { $_.FullName }
    javac -encoding UTF-8 -d bin -cp "lib/*;src" $sources
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Compilation failed." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[INFO] Launching ECMS Web Server on port 8080..." -ForegroundColor Green
java --enable-native-access=ALL-UNNAMED -cp "bin;lib/*" com.ecms.ElectionCommissionApp

