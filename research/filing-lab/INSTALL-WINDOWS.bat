@echo off
rem One-time setup: Python libraries, llama.cpp and the two default models (about 3 GB in total).
rem   INSTALL-WINDOWS.bat            default models (GLiNER2.5 Small + Qwen3 1.7B)
rem   INSTALL-WINDOWS.bat -AllModels also the larger comparison models
rem   INSTALL-WINDOWS.bat -Gpu       use the GPU build of llama.cpp
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install_windows.ps1" %*
echo.
pause
