@echo off
setlocal
cls
echo 
echo ===============================================
echo         Jarvis Kanban Onboard
echo ===============================================
echo   _  _            _      _       _           
echo  | || | __ _ _ __ | | ___| |_ ___| |__   ___  
echo  | || |/ _` | '_ \| |/ _ \ __/ __| '_ \ / _ \ 
echo  |__   _| (_| | |_) | |  __/ || (__| | | |  __/ 
echo     |_|  \__,_| .__/|_|\___|\__\___|_| |_|\___| 
echo              |_|                                
echo ===============================================
echo 1) 选择同步 JSON 文件
echo 2) 后台启动看板 + 同步代理
echo 3) 自动打开浏览器
echo.
echo Tip: 运行中请勿关闭此窗口
echo ===============================================
echo.
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0jarvis-oneclick.ps1"
