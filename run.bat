@echo off
echo ====================================================================
echo   Starting Election Commission Management System (Java + JDBC)
echo ====================================================================

if not exist "bin\com\ecms\ElectionCommissionApp.class" (
    echo [INFO] Binaries not found. Running compilation first...
    call compile.bat
)

echo [INFO] Launching ECMS Web Server...
java --enable-native-access=ALL-UNNAMED -cp "bin;lib/*" com.ecms.ElectionCommissionApp

