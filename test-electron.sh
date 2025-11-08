#!/bin/bash
set -euo pipefail

echo "Checking TypeScript types..."
npx tsc --noEmit

echo "Linting (暂未配置)"

echo "Build renderer"
npm run build:react

echo "Build electron"
npm run build:electron
