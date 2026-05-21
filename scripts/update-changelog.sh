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

commit_lines() {
  local grep_arg=${1:-}
  local invert=${2:-false}
  local args=()
  if [ -n "$RANGE" ]; then
    args+=("$RANGE")
  fi

  if [ -n "$grep_arg" ]; then
    args+=(--grep="$grep_arg" --regexp-ignore-case)
  fi

  if [ "$invert" = "true" ]; then
    args+=(--invert-grep)
  fi

  git log "${args[@]}" --pretty=format:"%s" |
    sed -E \
      -e 's/^[[:space:]]+//' \
      -e 's/^(feat|fix|docs|chore|refactor|perf|test|build|ci|style)(\([^)]+\))?!?:[[:space:]]*//' \
      -e 's/^./\U&/' \
      -e 's/^/- /' || true
}

section() {
  local title=$1
  local commits=$2

  if [ -n "$commits" ]; then
    printf '### %s\n%s\n\n' "$title" "$commits"
  fi
}

ADDED_COMMITS=$(commit_lines '^feat')
FIXED_COMMITS=$(commit_lines '^fix')
REMOVED_COMMITS=$(commit_lines '^remove|^revert|BREAKING CHANGE')
CHANGED_COMMITS=$(commit_lines '^feat|^fix|^remove|^revert|BREAKING CHANGE' true)

BODY="$(
  section "Added" "$ADDED_COMMITS"
  section "Changed" "$CHANGED_COMMITS"
  section "Fixed" "$FIXED_COMMITS"
  section "Removed" "$REMOVED_COMMITS"
)"

if [ -z "$BODY" ]; then
  BODY="### Changed
- Aggiornamento release.

"
fi

NEW_SECTION="## [${VERSION}] - ${DATE}

${BODY}"

node --input-type=module - "$CHANGELOG_FILE" "$NEW_SECTION" <<'JS'
import fs from "node:fs";

const [path, newSection] = process.argv.slice(2);
const text = fs.readFileSync(path, "utf8");
const normalized = text.endsWith("\n") ? text : `${text}\n`;
const unreleasedHeading = normalized.match(/^## \[Unreleased\]$/m);
const releaseHeading = normalized.match(/^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}$/m);

if (!unreleasedHeading) {
  throw new Error("Missing ## [Unreleased] section in CHANGELOG.md");
}

const unreleasedLineEnd = normalized.indexOf("\n", unreleasedHeading.index);
const beforeUnreleasedBody = normalized.slice(0, unreleasedLineEnd).trimEnd();
const existingReleases = releaseHeading ? normalized.slice(releaseHeading.index).trimStart() : "";
const emptyUnreleased = "### Added\n\n### Changed\n\n### Fixed\n\n### Removed";
const next = `${beforeUnreleasedBody}\n\n${emptyUnreleased}\n\n${newSection.trim()}\n\n${existingReleases}`;

fs.writeFileSync(path, `${next.trimEnd()}\n`, "utf8");
JS

node --input-type=module - "$CHANGELOG_FILE" "$REPO_URL" "$VERSION" "$TAG" "${PREV_TAG:-}" <<'JS'
import fs from "node:fs";

const [path, repoUrl, version, tag, prevTag] = process.argv.slice(2);
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
const filtered = lines.filter((line) => {
  if (line.startsWith("[Unreleased]: ")) return false;
  if (line.startsWith(`[${version}]: `)) return false;
  return true;
});

while (filtered.length > 0 && filtered.at(-1) === "") {
  filtered.pop();
}

filtered.push("");
filtered.push(`[Unreleased]: ${repoUrl}/compare/${tag}...HEAD`);
filtered.push(
  prevTag
    ? `[${version}]: ${repoUrl}/compare/${prevTag}...${tag}`
    : `[${version}]: ${repoUrl}/releases/tag/${tag}`,
);

fs.writeFileSync(path, `${filtered.join("\n")}\n`, "utf8");
JS

echo "CHANGELOG.md updated for ${TAG}"
