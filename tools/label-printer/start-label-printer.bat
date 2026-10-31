@echo off
rem Starts the label printer helper. Keep this window open while printing.
rem To start it automatically, put a shortcut to this file in the Startup folder
rem (press Win+R, type shell:startup).
title OptiSource label printer helper
cd /d "%~dp0"
node server.mjs
echo.
echo The helper has stopped. See the message above.
pause
