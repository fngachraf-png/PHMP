#!/usr/bin/env bash
# PHMP — نسخة احتياطية يومية (cron) — VACUUM INTO + quick_check + احتفاظ 30
set -euo pipefail
cd /root/PHMP/server
exec node src/backup.js
