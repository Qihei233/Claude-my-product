@echo off
setlocal EnableExtensions
title Naiwa Python Platform Launcher

REM ============================================================
REM  One-click launcher: Docker/MySQL + backend + frontend
REM  Keep this file next to the 003.* application folder.
REM  Double-click to start, keep Backend/Frontend windows open.
REM ============================================================

set "SYS=%SystemRoot%\System32"
set "ROOT=%~dp0"
set "DOCKER_EXE=F:\Docker\Docker\Docker Desktop.exe"
if not exist "%DOCKER_EXE%" set "DOCKER_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"

REM ---------- locate project folders ----------
set "APP="
for /d %%D in ("%ROOT%003.*") do set "APP=%%~fD"
if not defined APP (
  echo [ERROR] Cannot find the application folder starting with "003.".
  echo         Please keep this .bat file next to that folder.
  pause
  exit /b 1
)
if not exist "%APP%\backend\package.json" (
  echo [ERROR] Backend folder not found: "%APP%\backend"
  pause
  exit /b 1
)
if not exist "%APP%\frontend\package.json" (
  echo [ERROR] Frontend folder not found: "%APP%\frontend"
  pause
  exit /b 1
)

"%SYS%\where.exe" npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js / npm not found in PATH. Please install Node.js 18+.
  pause
  exit /b 1
)

REM Make sure the docker CLI is reachable
"%SYS%\where.exe" docker >nul 2>&1
if errorlevel 1 (
  if exist "F:\Docker\Docker\resources\bin\docker.exe" set "PATH=F:\Docker\Docker\resources\bin;%PATH%"
  if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" set "PATH=C:\Program Files\Docker\Docker\resources\bin;%PATH%"
)

echo ============================================
echo   Naiwa Python Learning Platform launcher
echo ============================================
echo.

REM ---------- 1. Docker Desktop ----------
"%SYS%\tasklist.exe" /fi "IMAGENAME eq Docker Desktop.exe" 2>nul | "%SYS%\find.exe" /i "Docker Desktop.exe" >nul
if errorlevel 1 (
  echo [1/4] Starting Docker Desktop...
  if exist "%DOCKER_EXE%" (
    start "" "%DOCKER_EXE%"
  ) else (
    echo       [WARN] Docker Desktop not found. Please start it manually.
  )
) else (
  echo [1/4] Docker Desktop is already running.
)

echo       Waiting for the Docker engine...
set "DOCKER_TRIES=0"
:wait_docker
docker info >nul 2>&1
if not errorlevel 1 goto docker_ready
set /a DOCKER_TRIES+=1
if %DOCKER_TRIES% GEQ 60 goto docker_timeout
"%SYS%\timeout.exe" /t 2 /nobreak >nul
goto wait_docker

:docker_timeout
echo       [WARN] Docker engine did not start in time. Login/register may fail.
goto after_docker

:docker_ready
echo       Docker engine is ready.
docker start mysql >nul 2>&1
if errorlevel 1 (
  echo       [WARN] Could not start the "mysql" container.
) else (
  echo       MySQL container started.
)

echo       Waiting for MySQL on port 3307...
set "MYSQL_TRIES=0"
:wait_mysql
"%SYS%\netstat.exe" -ano | "%SYS%\find.exe" ":3307" | "%SYS%\find.exe" "LISTENING" >nul
if not errorlevel 1 goto mysql_ready
set /a MYSQL_TRIES+=1
if %MYSQL_TRIES% GEQ 30 goto mysql_timeout
"%SYS%\timeout.exe" /t 2 /nobreak >nul
goto wait_mysql

:mysql_timeout
echo       [WARN] MySQL is still not listening on port 3307.
:mysql_ready
:after_docker

REM ---------- 2. Backend ----------
"%SYS%\netstat.exe" -ano | "%SYS%\find.exe" ":3001" | "%SYS%\find.exe" "LISTENING" >nul
if errorlevel 1 (
  echo [2/4] Starting backend on http://localhost:3001 ...
  start "Naiwa Backend" /D "%APP%\backend" cmd /k "chcp 65001 >nul && npm run dev"
) else (
  echo [2/4] Backend is already running on port 3001.
)

REM ---------- 3. Frontend ----------
"%SYS%\netstat.exe" -ano | "%SYS%\find.exe" ":5173" | "%SYS%\find.exe" "LISTENING" >nul
if errorlevel 1 (
  echo [3/4] Starting frontend on http://localhost:5173 ...
  start "Naiwa Frontend" /D "%APP%\frontend" cmd /k "chcp 65001 >nul && npm run dev"
) else (
  echo [3/4] Frontend is already running on port 5173.
)

REM ---------- 4. Open browser ----------
echo [4/4] Waiting for the web page...
if not exist "%SYS%\curl.exe" goto web_ready
set "WEB_TRIES=0"
:wait_web
"%SYS%\curl.exe" -s -o nul http://localhost:5173/
if not errorlevel 1 goto web_ready
set /a WEB_TRIES+=1
if %WEB_TRIES% GEQ 30 goto web_ready
"%SYS%\timeout.exe" /t 2 /nobreak >nul
goto wait_web

:web_ready
if not "%NAIWA_NO_OPEN%"=="1" start "" "http://localhost:5173"

echo.
echo Done. The site should be open at:
echo     http://localhost:5173
echo.
echo Keep the Backend and Frontend windows open.
echo Close them to stop the servers.
echo.
if not "%NAIWA_NO_PAUSE%"=="1" pause
endlocal
