#!/bin/bash

# Enhanced auto-versioning script with changelog update
# Analyzes git changes, bumps version, and updates CHANGELOG

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🤖 AI-Powered Auto Versioning + Changelog${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load environment variables
if [ -f .env.local ]; then
  set -a
  source .env.local 2>/dev/null || true
  set +a
fi
if [ -f .env ]; then
  set -a
  source .env 2>/dev/null || true
  set +a
fi

# Check for GEMINI_API_KEY
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}Error: GEMINI_API_KEY not found${NC}"
    echo "Skipping AI versioning. Version will remain unchanged."
    exit 0
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version:${NC} $CURRENT_VERSION"

# Get staged changes
DIFF=$(git diff --staged 2>/dev/null || echo "")
if [ -z "$DIFF" ]; then
  DIFF=$(git diff 2>/dev/null || echo "")
fi

if [ -z "$DIFF" ]; then
  echo -e "${YELLOW}No changes detected. Skipping versioning.${NC}"
  exit 0
fi

# Get changed files
CHANGED_FILES=$(git diff --staged --name-only 2>/dev/null || git diff --name-only 2>/dev/null || echo "")
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')

echo -e "${BLUE}Changed files:${NC} $FILE_COUNT"
echo "$CHANGED_FILES" | head -10 | sed 's/^/  - /'
if [ "$FILE_COUNT" -gt 10 ]; then
  echo "  ... and $((FILE_COUNT - 10)) more files"
fi
echo ""

# Limit diff size
DIFF_SIZE=$(echo -n "$DIFF" | wc -c)
if [ "$DIFF_SIZE" -gt 40000 ]; then
  echo -e "${YELLOW}Diff is large ($DIFF_SIZE bytes). Using summary instead.${NC}"
  DIFF_SUMMARY=$(git diff --staged --stat 2>/dev/null || git diff --stat 2>/dev/null || echo "")
  ANALYSIS_CONTENT="$DIFF_SUMMARY"
else
  ANALYSIS_CONTENT="$DIFF"
fi

# Prepare comprehensive AI prompt
PROMPT="You are a semantic versioning and changelog expert. Analyze the git changes and provide structured output.

Current version: $CURRENT_VERSION

Changed files ($FILE_COUNT total):
$CHANGED_FILES

Changes:
\`\`\`
$ANALYSIS_CONTENT
\`\`\`

Task 1 - VERSION BUMP:
Determine the appropriate semantic version bump (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes, API incompatibilities, contract migrations, major refactors
- MINOR: New features, components, pages, backward-compatible additions
- PATCH: Bug fixes, documentation, minor refactoring, styling
- NONE: Trivial changes (comments, formatting, config tweaks)

Task 2 - CHANGELOG ENTRY:
Generate a concise changelog entry categorized by:
- Added: New features
- Changed: Changes in existing functionality
- Fixed: Bug fixes
- Deprecated: Soon-to-be removed features
- Removed: Removed features
- Security: Security improvements

Respond in this EXACT format:
VERSION: [MAJOR|MINOR|PATCH|NONE]
CHANGELOG:
### Added
- [item or 'None']

### Changed
- [item or 'None']

### Fixed
- [item or 'None']

Be concise but informative. Focus on user-facing changes."

# Call Gemini API
echo -e "${BLUE}🤖 Analyzing changes with AI...${NC}"

GEMINI_API_ENDPOINT="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=$GEMINI_API_KEY"

JSON_PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT" \
  '{
    "contents": [{
      "parts": [{"text": $prompt}]
    }],
    "generationConfig": {
      "temperature": 0.2,
      "maxOutputTokens": 800,
      "topP": 0.9
    }
  }')

API_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  "$GEMINI_API_ENDPOINT" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$API_RESPONSE" ]; then
    echo -e "${RED}API request failed. Defaulting to PATCH bump.${NC}"
    VERSION_BUMP="PATCH"
    CHANGELOG_ENTRY="### Changed\n- Various updates and improvements"
else
    # Parse AI response - improved parsing logic
    AI_OUTPUT=$(python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    if "candidates" in data and len(data["candidates"]) > 0:
        candidate = data["candidates"][0]
        if "content" in candidate and "parts" in candidate["content"]:
            parts = candidate["content"]["parts"]
            if len(parts) > 0 and "text" in parts[0]:
                print(parts[0]["text"].strip())
            else:
                print("")
        else:
            print("")
    elif "error" in data:
        print("")
    else:
        print("")
except Exception as e:
    print("")
' <<< "$API_RESPONSE" 2>/dev/null)

    if [ -z "$AI_OUTPUT" ]; then
        # Debug: show raw response structure if parsing failed
        ERROR_MSG=$(python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    if "error" in data:
        print(data["error"].get("message", "Unknown error"))
    else:
        print("Empty response")
except:
    print("JSON parse error")
' <<< "$API_RESPONSE" 2>/dev/null)
        echo -e "${YELLOW}Could not parse AI response: $ERROR_MSG. Using defaults.${NC}"
        VERSION_BUMP="PATCH"
        CHANGELOG_ENTRY="### Changed\n- Various updates and improvements"
    else
        # Extract version bump
        VERSION_BUMP=$(echo "$AI_OUTPUT" | grep "VERSION:" | sed 's/VERSION: *//' | tr -d '\r' | head -1)
        
        # Validate version bump
        case $VERSION_BUMP in
            MAJOR|MINOR|PATCH|NONE)
                ;;
            *)
                echo -e "${YELLOW}Invalid version bump: '$VERSION_BUMP'. Defaulting to PATCH.${NC}"
                VERSION_BUMP="PATCH"
                ;;
        esac
        
        # Extract changelog
        CHANGELOG_ENTRY=$(echo "$AI_OUTPUT" | sed -n '/CHANGELOG:/,$ p' | tail -n +2)
        
        if [ -z "$CHANGELOG_ENTRY" ]; then
            CHANGELOG_ENTRY="### Changed\n- Various updates and improvements"
        fi
    fi
fi

echo -e "${GREEN}AI Recommendation: ${VERSION_BUMP}${NC}"
echo ""

# Handle NONE case
if [ "$VERSION_BUMP" == "NONE" ]; then
    echo -e "${YELLOW}No version bump needed (trivial changes)${NC}"
    echo "Version remains: $CURRENT_VERSION"
    exit 0
fi

# Calculate new version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
PATCH=$(echo "$PATCH" | sed 's/[^0-9].*//')
MINOR=$(echo "$MINOR" | sed 's/[^0-9].*//')
MAJOR=$(echo "$MAJOR" | sed 's/[^0-9].*//')

case $VERSION_BUMP in
  "MAJOR")
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  "MINOR")
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  "PATCH")
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
TODAY=$(date +%Y-%m-%d)

echo -e "${GREEN}Version bump: $CURRENT_VERSION → $NEW_VERSION${NC}"
echo ""

# Update package.json
if [ "$(uname)" == "Darwin" ]; then
  sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
else
  sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
fi

UPDATED_VERSION=$(node -p "require('./package.json').version")
if [ "$UPDATED_VERSION" != "$NEW_VERSION" ]; then
    echo -e "${RED}Failed to update package.json${NC}"
    exit 1
fi

echo -e "${GREEN}✓ package.json updated${NC}"

# Update CHANGELOG.md
if [ -f CHANGELOG.md ]; then
    echo -e "${BLUE}Updating CHANGELOG.md...${NC}"
    
    # Create new changelog entry
    NEW_ENTRY="## [$NEW_VERSION] - $TODAY\n\n$CHANGELOG_ENTRY\n"
    
    # Insert after the [Unreleased] section
    if [ "$(uname)" == "Darwin" ]; then
        # macOS
        awk -v entry="$NEW_ENTRY" '
            /## \[Unreleased\]/ {
                print
                print ""
                print entry
                next
            }
            {print}
        ' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md
    else
        # Linux
        awk -v entry="$NEW_ENTRY" '
            /## \[Unreleased\]/ {
                print
                print ""
                print entry
                next
            }
            {print}
        ' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md
    fi
    
    echo -e "${GREEN}✓ CHANGELOG.md updated${NC}"
    git add CHANGELOG.md 2>/dev/null || true
fi

# Stage package.json
git add package.json 2>/dev/null || true

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Version bumped successfully: v$NEW_VERSION${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
