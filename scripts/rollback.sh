#!/bin/bash

# Exit on any error
set -e

# Define valid environments
VALID_ENVS=("dev" "staging" "prod")

# Get the environment from command line or default to 'dev'
ENV=${1:-dev}

# Get commit hash to rollback to (optional)
TARGET_COMMIT=${2:-""}

# Validate environment
if [[ ! " ${VALID_ENVS[@]} " =~ " ${ENV} " ]]; then
    echo "Invalid environment: $ENV"
    echo "Valid environments are: ${VALID_ENVS[*]}"
    exit 1
fi

echo "Rolling back Aletheia Mindburn in $ENV environment..."

# Define variables based on environment
case "$ENV" in
  "dev")
    API_URL="https://api-dev.mindburn.org"
    STACK_NAME="AletheiaMindburn${ENV^}InfrastructureStack"
    ;;
  "staging")
    API_URL="https://api-staging.mindburn.org"
    STACK_NAME="AletheiaMindburn${ENV^}InfrastructureStack"
    ;;
  "prod")
    API_URL="https://api.mindburn.org"
    STACK_NAME="AletheiaMindburn${ENV^}InfrastructureStack"
    ;;
esac

# Find latest successful deployment
if [ -z "$TARGET_COMMIT" ]; then
    echo "No target commit specified, looking for latest successful deployment..."
    
    # Look for the most recent deployment record
    LATEST_RECORD=$(ls -t deploy-record-${ENV}-*.json 2>/dev/null | head -n 1)
    
    if [ -n "$LATEST_RECORD" ]; then
        echo "Found deployment record: $LATEST_RECORD"
        TARGET_COMMIT=$(grep -o '"commit": "[^"]*"' $LATEST_RECORD | cut -d'"' -f4)
        echo "Using commit from deployment record: $TARGET_COMMIT"
    else
        echo "No deployment records found. Using the previous commit on the current branch."
        TARGET_COMMIT=$(git rev-parse HEAD^)
    fi
fi

if [ -z "$TARGET_COMMIT" ]; then
    echo "Error: Could not determine target commit for rollback"
    exit 1
fi

echo "Rolling back to commit: $TARGET_COMMIT"

# Create a temporary branch for rollback
ROLLBACK_BRANCH="rollback-${ENV}-$(date +%s)"
echo "Creating temporary branch for rollback: $ROLLBACK_BRANCH"
git checkout -b $ROLLBACK_BRANCH $TARGET_COMMIT

# Build the project
echo "Building project for rollback..."
pnpm install
pnpm turbo run build --filter=@mindburn/* --cache-dir=.turbo

# Rollback infrastructure first
echo "Rolling back infrastructure..."
(cd infrastructure/scripts && ./deploy-infrastructure.sh $ENV)

# Rollback API services
echo "Rolling back API services..."
(cd api && pnpm serverless deploy --stage $ENV)

# Rollback shared resources
echo "Rolling back shared resources..."
(cd packages/shared && pnpm serverless deploy --stage $ENV)

# Rollback worker resources
echo "Rolling back worker resources..."
(cd packages/workerInterface && pnpm serverless deploy --stage $ENV)

# Rollback verification engine
echo "Rolling back verification engine..."
(cd packages/verificationEngine && pnpm serverless deploy --stage $ENV)

# Rollback payment system
echo "Rolling back payment system..."
(cd packages/paymentSystem && pnpm serverless deploy --stage $ENV)

# Rollback developer platform
echo "Rolling back developer platform..."
(cd packages/developerPlatform && pnpm serverless deploy --stage $ENV)

# Upload frontend assets if applicable
if [ -d "packages/workerWebapp/build" ]; then
  echo "Uploading frontend assets..."
  # Get S3 bucket name from CloudFormation outputs
  S3_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='WebappBucketName'].OutputValue" --output text)
  
  if [ -n "$S3_BUCKET" ]; then
    echo "Uploading to S3 bucket: $S3_BUCKET"
    aws s3 sync packages/workerWebapp/build s3://$S3_BUCKET/ --delete
    
    # Invalidate CloudFront cache if needed
    CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)
    if [ -n "$CLOUDFRONT_ID" ]; then
      echo "Invalidating CloudFront cache: $CLOUDFRONT_ID"
      aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
    fi
  else
    echo "Warning: S3 bucket name not found in CloudFormation outputs"
  fi
fi

# Create rollback record
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
ROLLBACK_RECORD="rollback-record-${ENV}-$(date +%s).json"

echo "{
  \"environment\": \"$ENV\",
  \"timestamp\": \"$TIMESTAMP\",
  \"commit\": \"${TARGET_COMMIT}\",
  \"status\": \"success\"
}" > $ROLLBACK_RECORD

# Clean up by switching back to the original branch
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git checkout $ORIGINAL_BRANCH

echo "Rollback record saved to $ROLLBACK_RECORD"
echo "Rollback to $ENV completed successfully!"
echo "Temporary branch $ROLLBACK_BRANCH can be deleted if rollback is successful" 