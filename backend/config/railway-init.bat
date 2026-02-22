@echo off
echo ========================================
echo Railway MySQL Database Initialization
echo ========================================
echo.

REM Note: Railway uses mysql.railway.internal which is NOT accessible externally
REM You need to use the PUBLIC connection details from Railway Variables tab

echo ERROR: mysql.railway.internal is only accessible from within Railway's private network
echo.
echo Please get the PUBLIC connection details:
echo 1. Go to Railway Dashboard
echo 2. Click Variables tab
echo 3. Look for MYSQL_PUBLIC_URL or similar public connection string
echo.
echo OR use the "Public Network" tab in the Connect modal
echo.
pause
