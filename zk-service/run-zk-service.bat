@echo off
cd /d "%~dp0"
echo ==========================================
echo  PetroSphere ZK Biometrics Sync Service
echo ==========================================
echo.
echo IP: 192.168.1.201
echo.

echo [%date% %time%] Pulling logs from biometrics device...
python zk-puller.py
echo.
echo [%date% %time%] Sync cycle complete.
