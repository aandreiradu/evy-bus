# !/usr/bin/env bash

set -euo pipefail

echo "Configuring Localstack"
echo "==================="
echo ""

LOCALSTACK_HOST=${LOCALSTACK_HOST:-localhost}
AWS_REGION=eu-central-1
LOCALSTACK_DUMMY_ID=000000000000


create_topic() {
    local TOPIC_NAME_TO_CREATE=$1
    awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 sns create-topic --name ${TOPIC_NAME_TO_CREATE} --output text
}

create_queue() {
    local QUEUE_NAME_TO_CREATE=$1
    local QUEUE_DEAD_LETTERS_ARN=$2
    awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 sqs create-queue --queue-name ${QUEUE_NAME_TO_CREATE} --attributes "{\"RedrivePolicy\": \"{\\\"maxReceiveCount\\\":\\\"5\\\", \\\"deadLetterTargetArn\\\": \\\"${QUEUE_DEAD_LETTERS_ARN}\\\"}\"}" --output text
}

create_dead_letter_queue() {
    local QUEUE_NAME_TO_CREATE=$1
    awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 sqs create-queue --queue-name ${QUEUE_NAME_TO_CREATE} --output text
}

link_queue_and_topic() {
    local TOPIC_ARN_TO_LINK=$1
    local QUEUE_ARN_TO_LINK=$2
    awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 sns subscribe --topic-arn ${TOPIC_ARN_TO_LINK} --protocol sqs --notification-endpoint ${QUEUE_ARN_TO_LINK} --output text
}

set_subscription_prefix_filter() {
    local SUBSCRIPTION_ARN=$1
    local FILTER_ATTRIBUTE=$2
    awslocal sns set-subscription-attributes --subscription-arn "$SUBSCRIPTION_ARN" --attribute-name FilterPolicy --attribute-value "{ \"type\": [{\"prefix\": \"$FILTER_ATTRIBUTE\"}] }"
}

guess_queue_arn_from_name() {
    local QUEUE_NAME=$1
    echo "arn:aws:sqs:${AWS_REGION}:${LOCALSTACK_DUMMY_ID}:$QUEUE_NAME"
}

guess_topic_arn_from_name() {
    local TOPIC_NAME=$1
    echo "arn:aws:sns:${AWS_REGION}:${LOCALSTACK_DUMMY_ID}:$TOPIC_NAME"
}

create_dynamodb_table() {
    local TABLE_NAME_TO_CREATE=$1
    
    awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 dynamodb describe-table --table-name ${TABLE_NAME_TO_CREATE} || \
      awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 dynamodb create-table --table-name ${TABLE_NAME_TO_CREATE} --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST
}

create_dynamo_secondary_index() {
    local TABLE_NAME_TO_UPDATE=$1
    local COLUMN_NAME=$2
    local INDEX_NAME="${COLUMN_NAME}_index"
    local INDEX_EXISTS=$(awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 dynamodb describe-table --table-name ${TABLE_NAME_TO_UPDATE} | jq -r ".Table.GlobalSecondaryIndexes[] | select(.IndexName == \"${INDEX_NAME}\")")
    if [ -n "$INDEX_EXISTS" ]; then
        echo "Index ${INDEX_NAME} already exists"
        return
    fi
    awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 dynamodb update-table --table-name ${TABLE_NAME_TO_UPDATE} --attribute-definitions --attribute-definitions AttributeName=${COLUMN_NAME},AttributeType=S --global-secondary-index-updates "[{\"Create\":{\"IndexName\": \"${INDEX_NAME}\",\"KeySchema\":[{\"AttributeName\":\"${COLUMN_NAME}\",\"KeyType\":\"HASH\"}],\"ProvisionedThroughput\": {\"ReadCapacityUnits\": 10, \"WriteCapacityUnits\": 5},\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" --billing-mode PAY_PER_REQUEST
}

create_s3_bucket() { 
    local BUCKET_NAME=$1
    echo "creating bucket" "$BUCKET_NAME"
    awslocal s3api create-bucket --bucket "$BUCKET_NAME" --create-bucket-configuration LocationConstraint="$AWS_REGION"
    echo "successfully created bucket" "$BUCKET_NAME"
    echo "applying cors config to bucket" "$BUCKET_NAME"
    awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 s3api put-bucket-cors --bucket "$BUCKET_NAME" --cors-configuration file://s3-cors-config.json
    echo "successfully applied cors config to bucket" "$BUCKET_NAME"
}


echo "Creating EVENTS topic" 
TOPIC_EVENTS_URL=$(create_topic events)
TOPIC_EVENTS_ARN=$(guess_topic_arn_from_name events)
echo "Successfully created EVENTS topic"

echo "Creating queues..."

echo "Creating auth queue"
QUEUE_AUTH_DLQ_URL=$(create_dead_letter_queue auth-dlq)
QUEUE_AUTH_DLQ_ARN=$(guess_queue_arn_from_name auth-dlq)

QUEUE_AUTH_URL=$(create_queue auth $QUEUE_AUTH_DLQ_ARN)
QUEUE_AUTH_ARN=$(guess_queue_arn_from_name auth)



echo "Creating events queue"
QUEUE_EVENTS_DLQ_URL=$(create_dead_letter_queue events-dlq)
QUEUE_EVENTS_DLQ_ARN=$(guess_queue_arn_from_name events-dlq)

QUEUE_EVENTS_URL=$(create_queue events $QUEUE_EVENTS_DLQ_ARN)
QUEUE_EVENTS_ARN=$(guess_queue_arn_from_name events)


echo "Creating tables"

echo "Creating Queue Keys table"
QUEUE_KEYS_TABLE_URL=$(create_dynamodb_table queueKeys)

echo "Creating Queue keys secondary index"
KEY_IDX=$(create_dynamo_secondary_index queueKeys key)

echo "Creating Queue Keys table"
USER_TABLE_URL=$(create_dynamodb_table users)
