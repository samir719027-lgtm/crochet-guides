@echo off
cd /d "%~dp0.."
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
echo ---- %date% %time% ---- >> scripts\pin_log.txt
python scripts\pinterest_publish.py --kids --publish --limit 1 >> scripts\pin_log.txt 2>&1
