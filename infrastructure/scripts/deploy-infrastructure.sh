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

# Get AWS account and region from environment configuration
ACCOUNT=$(node -e "console.log(require('../src/config/environment').environments['$ENV'].account || process.env.CDK_DEFAULT_ACCOUNT)")
REGION=$(node -e "console.log(require('../src/config/environment').environments['$ENV'].region || 'us-east-1')")

echo "Deploying Aletheia Infrastructure for environment: $ENV to account: $ACCOUNT in region: $REGION"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "Error: AWS CLI is not configured. Please configure AWS CLI or provide AWS credentials."
    exit 1
fi

# Build the CDK app
echo "Building CDK app..."
npm run build

# Get backup region for multi-region deployment
BACKUP_REGION=$(node -e "console.log(require('../src/config/environment').environments['$ENV'].backupRegion || 'us-west-2')")

# Check for required environment variables
if [[ "$ENV" == "prod" && -z "$PROD_CERTIFICATE_ARN" ]]; then
    echo "Error: PROD_CERTIFICATE_ARN environment variable is required for production deployment."
    exit 1
fi

if [[ "$ENV" == "staging" && -z "$STAGING_CERTIFICATE_ARN" ]]; then
    echo "Error: STAGING_CERTIFICATE_ARN environment variable is required for staging deployment."
    exit 1
fi

# Store the current stack status for rollback if needed
STACK_NAME="AletheiaMindburn${ENV^}InfrastructureStack"
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DOES_NOT_EXIST")

# Create a backup of CloudFormation template
if [[ "$STACK_STATUS" != "DOES_NOT_EXIST" ]]; then
    echo "Creating backup of current CloudFormation template..."
    aws cloudformation get-template --stack-name $STACK_NAME > cf-template-backup-$ENV.json || {
        echo "Warning: Could not create backup of CloudFormation template."
    }
fi

# Generate a CDK context file for rollback if needed
echo "Generating CDK context for rollback..."
CONTEXT_FILE="cdk-context-$ENV-$(date +%s).json"
echo "{\"env\":\"$ENV\",\"primary-region\":\"$REGION\",\"backup-region\":\"$BACKUP_REGION\"}" > $CONTEXT_FILE

# Deploy infrastructure stack with environment-specific configuration
echo "Deploying infrastructure stack..."
DEPLOY_SUCCESS=false
npx cdk deploy $STACK_NAME \
  --context env=$ENV \
  --context primary-region=$REGION \
  --context backup-region=$BACKUP_REGION \
  --require-approval never \
  --profile aletheia-$ENV && DEPLOY_SUCCESS=true

if [[ "$DEPLOY_SUCCESS" == "true" ]]; then
    echo "Infrastructure deployment completed successfully!"

    # Create a deployment summary
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    SUMMARY_FILE="deploy-summary-${ENV}-${TIMESTAMP}.txt"

    echo "Deployment Summary" > $SUMMARY_FILE
    echo "==================" >> $SUMMARY_FILE
    echo "Environment: $ENV" >> $SUMMARY_FILE
    echo "Account: $ACCOUNT" >> $SUMMARY_FILE
    echo "Primary Region: $REGION" >> $SUMMARY_FILE
    echo "Backup Region: $BACKUP_REGION" >> $SUMMARY_FILE
    echo "Timestamp: $TIMESTAMP" >> $SUMMARY_FILE
    echo "Status: Success" >> $SUMMARY_FILE

    echo "Deployment summary saved to $SUMMARY_FILE"
    
    # Clean up rollback files
    rm -f $CONTEXT_FILE
else
    echo "Infrastructure deployment failed! Initiating rollback..."
    
    # Rollback based on stack status
    if [[ "$STACK_STATUS" == "DOES_NOT_EXIST" ]]; then
        echo "Stack did not exist before deployment. Destroying the failed stack..."
        npx cdk destroy $STACK_NAME \
            --context env=$ENV \
            --context primary-region=$REGION \
            --context backup-region=$BACKUP_REGION \
            --force \
            --profile aletheia-$ENV || {
                echo "Warning: Rollback failed. Manual intervention may be required."
            }
    else
        echo "Stack existed before deployment. Reverting to previous state..."
        # Attempt hotswap rollback first for faster recovery of minor changes
        npx cdk deploy $STACK_NAME \
            --hotswap \
            --context env=$ENV \
            --context primary-region=$REGION \
            --context backup-region=$BACKUP_REGION \
            --require-approval never \
            --profile aletheia-$ENV || {
                
                echo "Hotswap rollback failed, attempting full rollback..."
                npx cdk destroy $STACK_NAME \
                    --context env=$ENV \
                    --context primary-region=$REGION \
                    --context backup-region=$BACKUP_REGION \
                    --force \
                    --profile aletheia-$ENV || {
                        echo "Error: Rollback failed. Please review stack status and manually fix issues."
                    }
            }
    fi
    
    # Log rollback summary
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    ROLLBACK_FILE="rollback-summary-${ENV}-${TIMESTAMP}.txt"
    
    echo "Rollback Summary" > $ROLLBACK_FILE
    echo "================" >> $ROLLBACK_FILE
    echo "Environment: $ENV" >> $ROLLBACK_FILE
    echo "Account: $ACCOUNT" >> $ROLLBACK_FILE
    echo "Timestamp: $TIMESTAMP" >> $ROLLBACK_FILE
    echo "Original Status: $STACK_STATUS" >> $ROLLBACK_FILE
    echo "Attempted Rollback: Yes" >> $ROLLBACK_FILE
    
    echo "Rollback summary saved to $ROLLBACK_FILE"
    echo "Deployment failed. Please check logs for details."
    exit 1
fi 