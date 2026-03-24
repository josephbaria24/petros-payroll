@echo off
cd /d "%~dp0"
echo ==========================================
echo  PetroSphere ZK Biometrics Sync Service
echo ==========================================
echo.
echo IP: 192.168.254.201
echo.

:loop
echo [%date% %time%] Pulling logs from biometrics device...
python zk-puller.py
echo.
echo [%date% %time%] Sync cycle complete. Waiting 10 minutes...
:: Wait for 60 seconds before next sync
timeout /t 60 /nobreak
goto loop
