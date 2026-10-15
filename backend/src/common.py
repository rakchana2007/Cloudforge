import json
import os
from datetime import datetime, timezone

import boto3

endpoint = os.environ.get("AWS_ENDPOINT_URL", "http://localhost:4566")

dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=endpoint,
    region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
)
table = dynamodb.Table(os.environ["TASK_TABLE"])

sqs = boto3.client(
    "sqs",
    endpoint_url=endpoint,
    region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
)
queue_url = os.environ["MAIN_QUEUE_URL"]


def now():
    return datetime.now(timezone.utc).isoformat()


def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def read_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except (TypeError, json.JSONDecodeError):
        return {}


def send_task(task):
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(task))


def get_all_tasks():
    items = []
    kwargs = {}
    while True:
        result = table.scan(**kwargs)
        items.extend(result.get("Items", []))
        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key
    items.sort(key=lambda item: item.get("createdAt", ""), reverse=True)
    return items
