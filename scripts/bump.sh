#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/bump.sh <patch|minor|major>
BUMP=${1:-patch}

echo "Bumping version: $BUMP"

# Update package.json version without creating git tag
NEW_VERSION=$(npm version "$BUMP" --no-git-tag-version --allow-same-version)
VERSION=${NEW_VERSION#v}
TAG="v$VERSION"
echo "New version: $TAG"

bash scripts/update-changelog.sh "$VERSION" "$TAG"

git add package.json CHANGELOG.md
git commit -m "chore(release): $TAG"
git tag "$TAG"

git push origin main
git push origin "$TAG"

echo "Release $TAG pushed. Create GitHub Release from tag or let CI create it."
