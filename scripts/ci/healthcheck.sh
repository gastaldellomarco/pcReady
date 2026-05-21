#!/usr/bin/env bash
set -euo pipefail

# Healthcheck script for post-deploy readiness
# Usage: healthcheck.sh <url> [attempts] [wait_seconds] [warmup]
# Example: ./healthcheck.sh https://pcready.mavcoo.it 5 15 true

URL="${1:-${LHCI_URL:-}}"
ATTEMPTS="${2:-5}"
WAIT="${3:-15}"
WARMUP="${4:-false}"

if [ -z "$URL" ]; then
  echo "::error::No URL provided. Usage: $0 <url> [attempts] [wait_seconds] [warmup]"
  exit 2
fi

host() {
  # extract hostname from URL
  echo "$URL" | sed -E 's#^https?://##' | cut -d'/' -f1
}

resolve_ip() {
  local h="$1"
  # Try python3 for portable DNS resolution
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<PYTHON 2>/dev/null || return 1
import socket,sys
try:
    print(socket.gethostbyname(sys.argv[1]))
except Exception:
    sys.exit(1)
PYTHON
    return $?
  fi

  # fall back to getent
  if command -v getent >/dev/null 2>&1; then
    getent hosts "$h" | awk '{print $1}' | head -n1 || return 1
  else
    return 1
  fi
}

log() { printf "[%s] %s\n" "$(date --utc +%Y-%m-%dT%H:%M:%SZ)" "$1"; }

attempt=1
while [ "$attempt" -le "$ATTEMPTS" ]; do
  log "Attempt $attempt/$ATTEMPTS: checking $URL"

  H="$(host)"
  if ip=$(resolve_ip "$H" 2>/dev/null); then
    log "DNS resolution: $H -> $ip"
  else
    log "DNS resolution failed for $H"
  fi

  # run a HEAD request following redirects; capture final URL and status
  curl_out=$(curl -I -L --max-redirs 10 --connect-timeout 10 --silent --show-error --write-out "\nFinal URL: %{url_effective}\nHTTP status: %{http_code}\nRedirects: %{num_redirects}\nTotal time: %{time_total}s\n" "$URL" 2>&1) || curl_status=$?

  if [ -n "${curl_status:-}" ]; then
    log "curl failed (exit ${curl_status}). Output:\n${curl_out}"
  else
    log "curl succeeded. Output:\n${curl_out}"
  fi

  # obtain numeric HTTP status with a separate quick call (silently)
  status_code=$(curl -L -o /dev/null -sS --max-redirs 10 --connect-timeout 10 --write-out "%{http_code}" "$URL" || echo "000")

  if [[ "$status_code" =~ ^[2-3][0-9][0-9]$ ]]; then
    log "Success: HTTP ${status_code} (acceptable)."

    if [ "$WARMUP" = "true" ] || [ "$WARMUP" = "1" ]; then
      log "Warmup enabled: performing GET to warm caches"
      curl -fsS --compressed --max-time 30 "$URL" >/dev/null 2>&1 && log "Warmup request succeeded" || log "Warmup request failed (non-fatal)"
    fi

    exit 0
  else
    log "Unhealthy: HTTP ${status_code}. Will retry after ${WAIT}s if attempts remain."
  fi

  attempt=$((attempt+1))
  if [ "$attempt" -le "$ATTEMPTS" ]; then
    sleep "$WAIT"
  fi
done

log "Healthcheck failed after ${ATTEMPTS} attempts."
exit 1
