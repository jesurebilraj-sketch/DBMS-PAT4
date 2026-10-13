@echo off
echo ====================================================================
echo   Compiling Election Commission Management System (Java + JDBC)
echo ====================================================================

if not exist "bin" mkdir "bin"

javac -encoding UTF-8 -d bin -cp "lib/*;src" src/com/ecms/model/*.java src/com/ecms/db/*.java src/com/ecms/service/*.java src/com/ecms/handler/*.java src/com/ecms/ElectionCommissionApp.java

if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Compilation successful! Binaries created in bin/
) else (
    echo [ERROR] Compilation failed. Please inspect error messages above.
)

