#!/bin/bash

# Exit on any error
set -e

# Define valid environments
VALID_ENVS=("dev" "staging" "prod")

# Get the environment from command line or default to 'dev'
ENV=${1:-dev}

# Validate environment
if [[ ! " ${VALID_ENVS[@]} " =~ " ${ENV} " ]]; then
    echo "Invalid environment: $ENV"
    echo "Valid environments are: ${VALID_ENVS[*]}"
    exit 1
fi

echo "Deploying Aletheia Mindburn to $ENV environment..."

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

# Build the project
echo "Building project for $ENV environment..."
pnpm turbo run build --filter=@mindburn/* --cache-dir=.turbo

# Deploy infrastructure first
echo "Deploying infrastructure..."
(cd infrastructure/scripts && ./deploy-infrastructure.sh $ENV)

# Deploy API services
echo "Deploying API services..."
(cd api && pnpm serverless deploy --stage $ENV)

# Deploy shared resources
echo "Deploying shared resources..."
(cd packages/shared && pnpm serverless deploy --stage $ENV)

# Deploy worker resources
echo "Deploying worker resources..."
(cd packages/workerInterface && pnpm serverless deploy --stage $ENV)

# Deploy verification engine
echo "Deploying verification engine..."
(cd packages/verificationEngine && pnpm serverless deploy --stage $ENV)

# Deploy payment system
echo "Deploying payment system..."
(cd packages/paymentSystem && pnpm serverless deploy --stage $ENV)

# Deploy developer platform
echo "Deploying developer platform..."
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

# Create deployment record
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
DEPLOY_RECORD="deploy-record-${ENV}-$(date +%s).json"

echo "{
  \"environment\": \"$ENV\",
  \"timestamp\": \"$TIMESTAMP\",
  \"commit\": \"$(git rev-parse HEAD)\",
  \"branch\": \"$(git rev-parse --abbrev-ref HEAD)\",
  \"status\": \"success\"
}" > $DEPLOY_RECORD

echo "Deployment record saved to $DEPLOY_RECORD"
echo "Deployment to $ENV completed successfully!" 