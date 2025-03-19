#!/bin/bash

# Script to run TypeScript strict mode check across all packages
# This script will identify packages that need type fixes

set -e

echo "Running TypeScript strict mode check across all packages..."

# Define colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Array to store packages with issues
declare -a failed_packages

# Find all tsconfig.json files
find ./packages -name "tsconfig.json" -not -path "*/node_modules/*" -not -path "*/dist/*" | while read -r config_file; do
  package_dir=$(dirname "$config_file")
  package_name=$(basename "$package_dir")
  
  echo -e "${YELLOW}Checking package:${NC} $package_name in $package_dir"
  
  # Create a temporary tsconfig with strict mode enabled
  temp_config="${package_dir}/tsconfig.strict.json"
  
  # Read the original config and add strict: true
  jq '.compilerOptions.strict = true' "$config_file" > "$temp_config"
  
  # Run TypeScript check with strict mode
  if npx tsc --project "$temp_config" --noEmit; then
    echo -e "${GREEN}✓ Package $package_name passes strict mode${NC}"
  else
    echo -e "${RED}✗ Package $package_name has type issues${NC}"
    failed_packages+=("$package_name")
  fi
  
  # Remove temporary config
  rm "$temp_config"
done

# Also check the root directory
if [ -f "./tsconfig.json" ]; then
  echo -e "${YELLOW}Checking root project${NC}"
  
  # Create a temporary tsconfig with strict mode enabled
  temp_config="./tsconfig.strict.json"
  
  # Read the original config and add strict: true
  jq '.compilerOptions.strict = true' "./tsconfig.json" > "$temp_config"
  
  # Run TypeScript check with strict mode
  if npx tsc --project "$temp_config" --noEmit; then
    echo -e "${GREEN}✓ Root project passes strict mode${NC}"
  else
    echo -e "${RED}✗ Root project has type issues${NC}"
    failed_packages+=("root")
  fi
  
  # Remove temporary config
  rm "$temp_config"
fi

# Check if any packages failed
if [ ${#failed_packages[@]} -eq 0 ]; then
  echo -e "${GREEN}All packages pass TypeScript strict mode!${NC}"
  exit 0
else
  echo -e "${RED}The following packages have TypeScript strict mode issues:${NC}"
  for package in "${failed_packages[@]}"; do
    echo "- $package"
  done
  echo "Please fix the type issues in these packages."
  exit 1
fi 