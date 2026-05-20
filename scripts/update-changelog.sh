#!/usr/bin/env bash
set -euo pipefail

VERSION=${1:?version is required}
TAG=${2:-v${VERSION#v}}
VERSION=${VERSION#v}
CHANGELOG_FILE="CHANGELOG.md"
REPO_URL="https://github.com/gastaldellomarco/pcReady"

if [ ! -f "$CHANGELOG_FILE" ]; then
  cat > "$CHANGELOG_FILE" <<'EOF'
# Changelog

Tutti i cambiamenti notevoli a questo progetto sono documentati in questo file.
Formato basato su [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
### Changed
### Fixed
### Removed

EOF
fi

PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
DATE=$(date +%F)
RANGE=""

if [ -n "$PREV_TAG" ]; then
  RANGE="${PREV_TAG}..HEAD"
fi

map_commits() {
  local grep_arg=$1
  local fallback=$2
  local commits

  if [ -n "$RANGE" ]; then
    commits=$(git log "$RANGE" --grep="$grep_arg" --regexp-ignore-case --pretty=format:"- %s" || true)
  else
    commits=$(git log --grep="$grep_arg" --regexp-ignore-case --pretty=format:"- %s" || true)
  fi

  if [ -n "$commits" ]; then
    printf '%s\n' "$fallback"
    printf '%s\n\n' "$commits"
  fi
}

ADDED=$(map_commits '^feat' '### Added')
FIXED=$(map_commits '^fix' '### Fixed')
REMOVED=$(map_commits '^remove\|^revert\|BREAKING CHANGE' '### Removed')

if [ -n "$ADDED" ]; then
  ADDED="${ADDED}"$'\n\n'
fi

if [ -n "$FIXED" ]; then
  FIXED="${FIXED}"$'\n\n'
fi

if [ -n "$REMOVED" ]; then
  REMOVED="${REMOVED}"$'\n\n'
fi

if [ -n "$RANGE" ]; then
  CHANGED_COMMITS=$(git log "$RANGE" --invert-grep --grep='^feat' --grep='^fix' --grep='^remove\|^revert\|BREAKING CHANGE' --regexp-ignore-case --pretty=format:"- %s" || true)
else
  CHANGED_COMMITS=$(git log --invert-grep --grep='^feat' --grep='^fix' --grep='^remove\|^revert\|BREAKING CHANGE' --regexp-ignore-case --pretty=format:"- %s" || true)
fi

CHANGED=""
if [ -n "$CHANGED_COMMITS" ]; then
  CHANGED=$(printf '### Changed\n%s\n\n' "$CHANGED_COMMITS")
fi

if [ -n "$CHANGED" ]; then
  CHANGED="${CHANGED}"$'\n\n'
fi

BODY="${ADDED}${CHANGED}${FIXED}${REMOVED}"
if [ -z "$BODY" ]; then
  BODY="### Changed
- Aggiornamento release.

"
fi

NEW_SECTION="## [${VERSION}] - ${DATE}

${BODY}"

python - "$CHANGELOG_FILE" "$NEW_SECTION" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
new_section = sys.argv[2].rstrip() + "\n\n"
text = path.read_text(encoding="utf-8")
marker = "### Removed"
insert_after = text.index(marker) + len(marker)
text = text[:insert_after] + "\n\n" + new_section + text[insert_after:].lstrip()
path.write_text(text, encoding="utf-8")
PY

python - "$CHANGELOG_FILE" "$REPO_URL" "$VERSION" "$TAG" "${PREV_TAG:-}" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
repo_url, version, tag, prev_tag = sys.argv[2:6]
text = path.read_text(encoding="utf-8")
text = re.sub(r"\n\[Unreleased\]: .*(?=\n|$)", "", text)
text = re.sub(rf"\n\[{re.escape(version)}\]: .*(?=\n|$)", "", text)
base = text.rstrip() + "\n\n"
base += f"[Unreleased]: {repo_url}/compare/{tag}...HEAD\n"
if prev_tag:
    base += f"[{version}]: {repo_url}/compare/{prev_tag}...{tag}\n"
else:
    base += f"[{version}]: {repo_url}/releases/tag/{tag}\n"
path.write_text(base, encoding="utf-8")
PY

echo "CHANGELOG.md updated for ${TAG}"
