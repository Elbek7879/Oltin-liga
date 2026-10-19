#!/usr/bin/env bash
# Payariq Oltin Ligasi - zaxira nusxa (Linux server).
#
# Baza (pg_dump, custom format) va yuklangan rasmlar papkasi saqlanadi, eng oxirgi KEEP ta nusxa qoladi.
# Ulanish ma'lumotlari ilova yonidagi .env faylidan olinadi (DB_URL, DB_USERNAME, DB_PASSWORD, MEDIA_DIR).
#
# Qo'lda:  /opt/oltin-liga/backup.sh
# Har kuni 03:00 da (crontab -e):
#   0 3 * * * /opt/oltin-liga/backup.sh >> /opt/oltin-liga/logs/backup.log 2>&1
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/oltin-liga/.env}"
TARGET="${TARGET:-/opt/oltin-liga/backups}"
KEEP="${KEEP:-30}"

# Kalit bo'lmasa bo'sh qiymat qaytaradi (pipefail skriptni to'xtatmasin)
get() { { grep -E "^$1=" "$ENV_FILE" || true; } | head -1 | cut -d= -f2- | tr -d '\r'; }

DB_URL="$(get DB_URL)"
DB_USERNAME="$(get DB_USERNAME)"
MEDIA_DIR="$(get MEDIA_DIR)"
[[ -n "$DB_URL" && -n "$DB_USERNAME" ]] || { echo "DB_URL yoki DB_USERNAME $ENV_FILE da yo'q" >&2; exit 1; }

# jdbc:postgresql://host:port/baza?parametrlar
if [[ "$DB_URL" =~ ^jdbc:postgresql://([^:/]+)(:([0-9]+))?/([^?]+) ]]; then
  DB_HOST="${BASH_REMATCH[1]}"; DB_PORT="${BASH_REMATCH[3]:-5432}"; DB_NAME="${BASH_REMATCH[4]}"
else
  echo "DB_URL formati tushunarsiz" >&2; exit 1
fi

mkdir -p "$TARGET"
STAMP="$(date +%Y-%m-%d_%H%M)"
DUMP="$TARGET/payariq-$STAMP.dump"

# Parol faqat shu buyruq uchun beriladi, ekranga chiqmaydi
PGPASSWORD="$(get DB_PASSWORD)" pg_dump --host "$DB_HOST" --port "$DB_PORT" --username "$DB_USERNAME" \
  --format=custom --no-owner --file "$DUMP" "$DB_NAME"
echo "$(date '+%F %T') baza saqlandi: $DUMP ($(du -h "$DUMP" | cut -f1))"

if [[ -n "$MEDIA_DIR" && -d "$MEDIA_DIR" ]] && [[ -n "$(ls -A "$MEDIA_DIR")" ]]; then
  tar -czf "$TARGET/payariq-media-$STAMP.tar.gz" -C "$MEDIA_DIR" .
  echo "$(date '+%F %T') rasmlar saqlandi: payariq-media-$STAMP.tar.gz"
fi

# Eski nusxalarni tozalash
ls -1t "$TARGET"/payariq-2*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
ls -1t "$TARGET"/payariq-media-*.tar.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
