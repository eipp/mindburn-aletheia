#!/bin/bash

# Set the environment (default to dev if not provided)
ENV=${1:-dev}

# Set queue name prefix based on environment
PREFIX="aletheia-${ENV}"

echo "Deploying SQS queues for environment: ${ENV}"

# Function to create a queue with DLQ
create_queue_with_dlq() {
  local queue_name=$1
  local dlq_name="${queue_name}-dlq"
  local visibility_timeout=$2
  local retention_period=$3
  local max_receive_count=$4
  
  echo "Creating DLQ: ${dlq_name}"
  dlq_url=$(aws sqs create-queue \
    --queue-name ${dlq_name} \
    --attributes '{"MessageRetentionPeriod":"1209600"}' \
    --output json \
    --query 'QueueUrl' \
    --output text)
  
  echo "DLQ URL: ${dlq_url}"
  
  dlq_arn=$(aws sqs get-queue-attributes \
    --queue-url ${dlq_url} \
    --attribute-names QueueArn \
    --query 'Attributes.QueueArn' \
    --output text)
  
  echo "DLQ ARN: ${dlq_arn}"
  
  # Create redrive policy with escaped quotes
  redrive_policy="{\\\"deadLetterTargetArn\\\":\\\"${dlq_arn}\\\",\\\"maxReceiveCount\\\":\\\"${max_receive_count}\\\"}"
  
  echo "Creating main queue: ${queue_name}"
  queue_url=$(aws sqs create-queue \
    --queue-name ${queue_name} \
    --attributes "{\"VisibilityTimeout\":\"${visibility_timeout}\",\"MessageRetentionPeriod\":\"${retention_period}\",\"RedrivePolicy\":\"${redrive_policy}\"}" \
    --output json \
    --query 'QueueUrl' \
    --output text)
  
  echo "Main queue URL: ${queue_url}"
  echo "Queue ${queue_name} and DLQ ${dlq_name} created successfully"
  echo "-----------------------------------"
}

# Create task distribution queue with DLQ
create_queue_with_dlq "${PREFIX}-task-distribution" "30" "604800" "5"

# Create high-priority task queue with DLQ (using the same DLQ as task distribution)
create_queue_with_dlq "${PREFIX}-high-priority-tasks" "30" "604800" "5"

# Create verification submission queue with DLQ
create_queue_with_dlq "${PREFIX}-verification-submission" "120" "604800" "3"

# Create worker notification queue with DLQ
create_queue_with_dlq "${PREFIX}-worker-notification" "30" "259200" "5"

# Create task expiration queue with DLQ
create_queue_with_dlq "${PREFIX}-task-expiration" "300" "604800" "3"

# Create results processing queue with DLQ
create_queue_with_dlq "${PREFIX}-results-processing" "300" "604800" "3"

echo "All SQS queues have been deployed successfully for environment: ${ENV}" 