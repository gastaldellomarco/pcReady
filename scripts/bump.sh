#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/bump.sh <patch|minor|major>
BUMP=${1:-patch}

echo "Bumping version: $BUMP"

# Update package.json version without creating git tag
NEW_VERSION=$(npm version "$BUMP" --no-git-tag-version --allow-same-version)
echo "New version: $NEW_VERSION"

git add package.json
git commit -m "chore(release): v$NEW_VERSION"
git tag "v$NEW_VERSION"

git push origin main
git push origin "v$NEW_VERSION"

echo "Release v$NEW_VERSION pushed. Create GitHub Release from tag or let CI create it."
