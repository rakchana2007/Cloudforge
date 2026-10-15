import json
import uuid
from common import table, now, response, read_body, send_task, get_all_tasks


def create_task(task_type="demo", payload=None, force_failure=False):
    task_id = "TASK-" + uuid.uuid4().hex[:10].upper()
    timestamp = now()
    task = {
        "taskId": task_id,
        "taskType": task_type,
        "payload": payload or {},
        "forceFailure": bool(force_failure),
        "status": "QUEUED",
        "attempts": 0,
        "retryCount": 0,
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "result": "",
        "lastError": "",
    }
    table.put_item(Item=task, ConditionExpression="attribute_not_exists(taskId)")
    send_task({
        "taskId": task_id,
        "taskType": task_type,
        "payload": payload or {},
        "forceFailure": bool(force_failure),
    })
    return task


def handler(event, context):
    method = event.get("httpMethod", "")
    path = event.get("path", "")

    if method == "OPTIONS":
        return response(200, {"ok": True})

    if method == "POST" and path.endswith("/tasks/batch"):
        body = read_body(event)
        count = body.get("count", 10)
        try:
            count = int(count)
        except (ValueError, TypeError):
            return response(400, {"error": "count must be an integer"})
        if count < 1 or count > 50:
            return response(400, {"error": "count must be between 1 and 50"})
        tasks = [create_task("demo", {"sequence": i + 1}, False) for i in range(count)]
        return response(201, {"submitted": len(tasks), "tasks": tasks})

    if method == "POST" and path.endswith("/tasks"):
        body = read_body(event)
        task_type = str(body.get("taskType", "demo"))[:80]
        payload = body.get("payload", {})
        force_failure = bool(body.get("forceFailure", False))
        task = create_task(task_type, payload, force_failure)
        return response(201, task)

    if method == "GET" and path.endswith("/stats"):
        tasks = get_all_tasks()
        stats = {
            "submitted": len(tasks),
            "completed": sum(1 for t in tasks if t.get("status") == "COMPLETED"),
            "retried": sum(1 for t in tasks if int(t.get("attempts", 0)) > 1),
            "permanentlyFailed": sum(1 for t in tasks if t.get("status") == "PERMANENTLY_FAILED"),
            "queued": sum(1 for t in tasks if t.get("status") == "QUEUED"),
            "processing": sum(1 for t in tasks if t.get("status") == "PROCESSING"),
        }
        return response(200, stats)

    if method == "GET" and path.endswith("/tasks"):
        tasks = get_all_tasks()
        return response(200, {"tasks": tasks[:200]})

    if method == "POST" and "/recover" in path:
        task_id = event.get("pathParameters", {}).get("taskId")
        if not task_id:
            return response(400, {"error": "taskId is required"})
        try:
            item = table.get_item(Key={"taskId": task_id}).get("Item")
            if not item:
                return response(404, {"error": "Task not found"})
            # Recovery creates a new task with a new ID and links it to the original.
            recovered = create_task(
                item.get("taskType", "demo"),
                {"recoveredFrom": task_id, "originalPayload": item.get("payload", {})},
                False,
            )
            return response(201, {"recoveredTask": recovered, "recoveredFrom": task_id})
        except Exception as exc:
            return response(500, {"error": str(exc)})

    return response(404, {"error": "Route not found"})
