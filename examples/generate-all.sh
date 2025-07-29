#!/bin/bash

# Generate OpenPkg specs for all examples

echo "Generating OpenPkg specifications for all examples..."

# Simple Math
echo "📐 Generating for simple-math..."
cd simple-math
bun ../../src/cli.ts index.ts -o openpkg.json
cd ..

# React Hooks
echo "⚛️  Generating for react-hooks..."
cd react-hooks
bun ../../src/cli.ts index.ts -o openpkg.json
cd ..

# API Client
echo "🌐 Generating for api-client..."
cd api-client
bun ../../src/cli.ts index.ts -o openpkg.json
cd ..

echo "✅ Done! Check each example directory for openpkg.json"