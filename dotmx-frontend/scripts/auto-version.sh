#!/bin/bash

# Auto-versioning script with AI evaluation
# Analyzes git changes and automatically bumps version following semantic versioning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🤖 AI-Powered Auto Versioning${NC}"
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
    echo -e "${RED}Error: GEMINI_API_KEY not found in environment${NC}"
    echo "Please set GEMINI_API_KEY in .env or .env.local file"
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version:${NC} $CURRENT_VERSION"

# Get the diff of staged changes
DIFF=$(git diff --staged 2>/dev/null || echo "")

if [ -z "$DIFF" ]; then
  echo -e "${YELLOW}No staged changes found. Checking unstaged changes...${NC}"
  DIFF=$(git diff 2>/dev/null || echo "")
fi

if [ -z "$DIFF" ]; then
  echo -e "${YELLOW}No changes detected. Version will remain: $CURRENT_VERSION${NC}"
  exit 0
fi

# Get list of changed files
CHANGED_FILES=$(git diff --staged --name-only 2>/dev/null || git diff --name-only 2>/dev/null || echo "")
echo -e "${BLUE}Changed files:${NC}"
echo "$CHANGED_FILES" | sed 's/^/  - /'
echo ""

# Limit diff size
DIFF_SIZE=$(echo -n "$DIFF" | wc -c)
if [ "$DIFF_SIZE" -gt 50000 ]; then
  echo -e "${YELLOW}Diff is large ($DIFF_SIZE bytes). Truncating to 50KB for analysis.${NC}"
  DIFF=$(echo -n "$DIFF" | head -c 50000)
fi

# Create a summary of changes
CHANGE_SUMMARY=$(echo "$CHANGED_FILES" | head -20)
if [ $(echo "$CHANGED_FILES" | wc -l) -gt 20 ]; then
  CHANGE_SUMMARY="$CHANGE_SUMMARY\n... and $(( $(echo "$CHANGED_FILES" | wc -l) - 20 )) more files"
fi

# Prepare AI prompt for version analysis
PROMPT="You are a semantic versioning expert. Analyze the following git diff and determine the appropriate version bump.

Current version: $CURRENT_VERSION

Changed files:
$CHANGE_SUMMARY

Git diff (truncated if large):
\`\`\`diff
$DIFF
\`\`\`

Based on semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes, incompatible API changes, major feature removals
- MINOR: New features, new functionality, backward-compatible changes
- PATCH: Bug fixes, documentation updates, code refactoring without new features

Analyze the changes and respond with ONLY ONE of these exact words:
- MAJOR
- MINOR
- PATCH
- NONE (if changes are trivial like formatting, comments, or config only)

Your response should be a single word. Consider:
1. Breaking changes in APIs or contracts
2. New features or components added
3. Bug fixes or refactoring
4. Documentation or configuration changes only
5. The scope and impact of the changes

Response:"

# Call Gemini API
echo -e "${BLUE}🤖 Analyzing changes with AI...${NC}"

GEMINI_API_ENDPOINT="https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=$GEMINI_API_KEY"

# Create JSON payload
JSON_PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT" \
  '{
    "contents": [{
      "parts": [{"text": $prompt}]
    }],
    "generationConfig": {
      "temperature": 0.1,
      "maxOutputTokens": 100,
      "topP": 0.95
    }
  }')

# Make API request
API_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  "$GEMINI_API_ENDPOINT" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$API_RESPONSE" ]; then
    echo -e "${RED}Error: API request failed${NC}"
    exit 1
fi

# Extract version bump recommendation
VERSION_BUMP=$(python3 -c '
import sys, json, re
try:
    data = json.load(sys.stdin)
    if "candidates" in data and len(data["candidates"]) > 0:
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip().upper()
        # Extract just the version bump word
        for word in ["MAJOR", "MINOR", "PATCH", "NONE"]:
            if word in text:
                print(word)
                sys.exit(0)
        print("PATCH")  # Default to patch if unclear
    else:
        print("PATCH")
except:
    print("PATCH")
' <<< "$API_RESPONSE" 2>/dev/null)

if [ -z "$VERSION_BUMP" ]; then
    echo -e "${YELLOW}Warning: Could not determine version bump. Defaulting to PATCH${NC}"
    VERSION_BUMP="PATCH"
fi

echo -e "${GREEN}AI Recommendation: ${VERSION_BUMP}${NC}"
echo ""

# Calculate new version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Remove any pre-release or build metadata
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
  "NONE")
    echo -e "${YELLOW}No version bump needed (trivial changes)${NC}"
    echo "Version remains: $CURRENT_VERSION"
    exit 0
    ;;
  *)
    echo -e "${YELLOW}Unknown bump type: $VERSION_BUMP. Defaulting to PATCH${NC}"
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo -e "${GREEN}Version bump: $CURRENT_VERSION → $NEW_VERSION${NC}"

# Update package.json
if [ "$(uname)" == "Darwin" ]; then
  # macOS
  sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
else
  # Linux
  sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
fi

# Check if update was successful
UPDATED_VERSION=$(node -p "require('./package.json').version")
if [ "$UPDATED_VERSION" != "$NEW_VERSION" ]; then
    echo -e "${RED}Error: Failed to update package.json${NC}"
    exit 1
fi

echo -e "${GREEN}✓ package.json updated${NC}"

# Stage the updated package.json
git add package.json 2>/dev/null || true

echo -e "${GREEN}✓ Version bumped successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
