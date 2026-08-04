@echo off
title BygSmart Deployment
"C:\Program Files\Git\git-bash.exe" -l -c "cd '/e/01PROJEKTER/04 Mobil APPS/bygsmart 2.1/Byggeapp-2.1' && bash deploy/deploy-simply.sh; echo; echo '=== DEPLOYMENT DONE ==='; read -r -p 'Press Enter to close...'"
