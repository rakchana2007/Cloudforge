import json
from datetime import datetime, timezone
from botocore.exceptions import ClientError
from common import table, now


def handler(event, context):
    failures = []
    for record in event.get("Records", []):
        message_id = record.get("messageId")
        try:
            message = json.loads(record.get("body", "{}"))
            task_id = message["taskId"]

            # Claim an eligible task and increment attempts atomically.
            try:
                table.update_item(
                    Key={"taskId": task_id},
                    UpdateExpression="SET #s = :processing, updatedAt = :now ADD attempts :one",
                    ConditionExpression="#s <> :completed AND #s <> :permanent",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={
                        ":processing": "PROCESSING",
                        ":completed": "COMPLETED",
                        ":permanent": "PERMANENTLY_FAILED",
                        ":now": now(),
                        ":one": 1,
                    },
                )
            except ClientError as exc:
                if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    # Already completed/permanently failed: safely ignore duplicate delivery.
                    continue
                raise

            current = table.get_item(Key={"taskId": task_id}).get("Item", {})
            attempts = int(current.get("attempts", 1))

            if message.get("forceFailure"):
                raise RuntimeError("Intentional demo failure: task configured to fail.")

            # Replace this with real work (e.g. image conversion, report generation).
            result = {
                "message": "Task processed successfully",
                "processedAt": now(),
                "attempt": attempts,
                "taskType": message.get("taskType", "demo"),
            }
            table.update_item(
                Key={"taskId": task_id},
                UpdateExpression="SET #s = :completed, #r = :result, updatedAt = :now, lastError = :empty",
                ConditionExpression="#s = :processing",
                ExpressionAttributeNames={"#s": "status", "#r": "result"},
                ExpressionAttributeValues={
                    ":completed": "COMPLETED",
                    ":processing": "PROCESSING",
                    ":result": json.dumps(result),
                    ":now": now(),
                    ":empty": "",
                },
            )

        except Exception as exc:
            try:
                body = json.loads(record.get("body", "{}"))
                task_id = body.get("taskId")
                if task_id:
                    table.update_item(
                        Key={"taskId": task_id},
                        UpdateExpression="SET #s = :queued, lastError = :error, updatedAt = :now ADD retryCount :one",
                        ExpressionAttributeNames={"#s": "status"},
                        ExpressionAttributeValues={
                            ":queued": "QUEUED",
                            ":error": str(exc)[:500],
                            ":now": now(),
                            ":one": 1,
                        },
                    )
            except Exception:
                pass
            print(f"Task processing failed; SQS will retry. messageId={message_id}; error={exc}")
            failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": failures}
