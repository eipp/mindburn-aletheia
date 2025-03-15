#!/bin/bash

# Create DynamoDB tables
echo "Creating DynamoDB tables..."

# Users table
awslocal dynamodb create-table \
  --table-name users \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=telegramId,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\": \"telegramId-index\",\"KeySchema\":[{\"AttributeName\":\"telegramId\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}]" \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# Tasks table
awslocal dynamodb create-table \
  --table-name tasks \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=status,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\": \"status-index\",\"KeySchema\":[{\"AttributeName\":\"status\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}]" \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# Bot sessions table
awslocal dynamodb create-table \
  --table-name bot-sessions \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# Create SQS queues
echo "Creating SQS queues..."

awslocal sqs create-queue --queue-name task-queue
awslocal sqs create-queue --queue-name verification-queue

# Create SSM parameters
echo "Creating SSM parameters..."

awslocal ssm put-parameter \
  --name "/aletheia/dev/bot-token" \
  --value "test_bot_token" \
  --type SecureString

awslocal ssm put-parameter \
  --name "/aletheia/dev/webhook-domain" \
  --value "http://localhost:3000" \
  --type String

awslocal ssm put-parameter \
  --name "/aletheia/dev/task-queue-url" \
  --value "http://localhost:4566/000000000000/task-queue" \
  --type String

# Seed test data
echo "Seeding test data..."

# Add test user
awslocal dynamodb put-item \
  --table-name users \
  --item '{
    "id": {"S": "test-user-1"},
    "telegramId": {"S": "123456789"},
    "username": {"S": "testuser"},
    "walletAddress": {"S": "0:1234567890abcdef"},
    "createdAt": {"N": "1709136000000"}
  }'

# Add test task
awslocal dynamodb put-item \
  --table-name tasks \
  --item '{
    "id": {"S": "test-task-1"},
    "status": {"S": "PENDING"},
    "type": {"S": "IMAGE_VERIFICATION"},
    "reward": {"N": "1000000000"},
    "createdAt": {"N": "1709136000000"}
  }'

echo "LocalStack initialization completed!" 