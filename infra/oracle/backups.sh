#!/usr/bin/env bash
set -euo pipefail
umask 077
mkdir -p /backups
while true; do
  file="/backups/lifesync-$(date -u +%Y%m%dT%H%M%SZ).dump.enc"
  if pg_dump --format=custom | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -out "$file.tmp"; then
    mv "$file.tmp" "$file"
    (cd /backups && sha256sum "$(basename "$file")" > "$(basename "$file").sha256")
    find /backups -maxdepth 1 -type f -name 'lifesync-*.dump.enc*' -mtime +14 -delete
    echo BACKUP_COMPLETED
  else
    rm -f "$file.tmp"
    echo BACKUP_FAILED >&2
  fi
  sleep 86400
done
