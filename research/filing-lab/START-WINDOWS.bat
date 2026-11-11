@echo off
rem Starts the filing lab on this computer and opens it in your browser. Works offline.
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo The lab is not installed yet. Running INSTALL-WINDOWS.bat first...
  call "%~dp0INSTALL-WINDOWS.bat"
)
set HF_HUB_OFFLINE=1
set TRANSFORMERS_OFFLINE=1
rem For a GPU: set LAB_GPU_LAYERS=99 (after installing with -Gpu)
".venv\Scripts\python.exe" lab\server.py
pause
