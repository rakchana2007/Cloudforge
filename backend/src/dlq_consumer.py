import json
from common import table, now


def handler(event, context):
    failures = []
    for record in event.get("Records", []):
        message_id = record.get("messageId")
        try:
            message = json.loads(record.get("body", "{}"))
            task_id = message.get("taskId")
            if task_id:
                table.update_item(
                    Key={"taskId": task_id},
                    UpdateExpression="SET #s = :failed, updatedAt = :now, lastError = if_not_exists(lastError, :error)",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={
                        ":failed": "PERMANENTLY_FAILED",
                        ":now": now(),
                        ":error": "Task exhausted the queue retry policy.",
                    },
                )
        except Exception as exc:
            print(f"Could not persist DLQ status for message {message_id}: {exc}")
            failures.append({"itemIdentifier": message_id})
    return {"batchItemFailures": failures}
