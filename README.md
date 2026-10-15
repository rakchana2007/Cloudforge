# CloudFlow — Cloud Queue & Worker Hackathon Project

A deployable AWS starter project for the CloudForge queue-and-worker problem statement.

## What is included
- React + Vite dashboard
- AWS SAM infrastructure template
- API Gateway + Lambda task producer
- Amazon SQS main queue + dead-letter queue (DLQ)
- SQS-triggered worker Lambda
- DynamoDB durable task records
- DLQ consumer Lambda that marks permanently failed tasks
- CloudWatch logs
- Demo task generator, controlled failure simulation, task statistics, and retry/DLQ visibility
- Idempotency guard using DynamoDB conditional updates

> This is a deployable starter project, not a cloud deployment. You must deploy it into an AWS account and configure the frontend API URL before real cloud services will be used. AWS usage may incur charges. Use a sandbox/student account and clean up resources after the hackathon.

## Architecture
React dashboard → API Gateway → Producer Lambda → SQS → Worker Lambda → DynamoDB
                                                               └─ failures after retries → SQS DLQ → DLQ Consumer Lambda → DynamoDB

## Prerequisites
- AWS account with permission to create SAM/CloudFormation stacks, Lambda, API Gateway, SQS, DynamoDB, IAM and CloudWatch resources
- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed
- Node.js 18+ and npm

## 1. Deploy the backend
From this directory:

```bash
cd backend
sam build
sam deploy --guided
```

Suggested answers:
- Stack Name: `cloudflow-hackathon`
- AWS Region: choose the region provided/allowed by your hackathon
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Disable rollback: `N`
- Save arguments to configuration file: `Y`

After deployment, copy the `ApiUrl` output.

If your hackathon gives you a specific AWS account/region or prohibits IAM creation, ask the organizer before deploying.

## 2. Configure and run the frontend
In another terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env` (copy `.env.example`) and set:

```env
VITE_API_BASE_URL=https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/Prod
```

Then run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## 3. Demo flow
1. Click **Submit 10 demo tasks**.
2. Watch tasks move from `QUEUED` to `PROCESSING` to `COMPLETED`.
3. Click **Submit failure demo**. The task is designed to fail on every attempt so you can demonstrate retries and DLQ handling.
4. Refresh the task list/statistics and inspect the `PERMANENTLY_FAILED` task and error.
5. Submit a normal task and a failure-demo task again to show unique IDs.
6. Click **Refresh** to fetch current cloud state.

The failure demo intentionally fails all processing attempts; this makes DLQ behaviour easier to demonstrate live. It does not simulate “fail twice then succeed” in this starter.

## 4. Important implementation notes
- SQS is at-least-once delivery: duplicates are possible.
- The worker uses a conditional DynamoDB update to claim a task and skips already-completed tasks. For production-grade idempotency, put the business operation and idempotency record in a transaction, and use a stable task ID across redeliveries.
- The SQS event source mapping uses batch size 1 so a failed message does not repeatedly retry unrelated messages in a batch.
- `maxReceiveCount: 3` is the redrive threshold. Receive counts can be affected by visibility timeouts and infrastructure behaviour; test the exact behaviour in your deployed region.
- A DLQ consumer records permanent failure in DynamoDB. SQS DLQ movement and the DLQ consumer are asynchronous, so the dashboard may need a refresh before the status updates.
- Counts are derived from unique task records. `retried` means a task has had at least two attempts (at least one retry); it is not a final outcome category.
- The project is a hackathon demo, not a production-hardened service. Add authentication, rate limiting, stricter validation, alarms and retention policies before real use.
- CORS is enabled for demo convenience. Restrict allowed origins before public production use.

## 5. Useful commands
```bash
# Backend deployment outputs
cd backend
sam list stack-outputs --stack-name cloudflow-hackathon

# Frontend development
cd frontend
npm run dev

# Delete resources when done (check the stack name first)
aws cloudformation delete-stack --stack-name cloudflow-hackathon
```

## Troubleshooting
- **Frontend says API URL is not configured:** set `VITE_API_BASE_URL` in `frontend/.env`, then restart Vite.
- **403 / CORS errors:** check the API URL, deployment stage and browser console. The SAM API enables CORS for localhost and common local Vite ports.
- **Tasks stay queued:** inspect the producer Lambda, SQS queue metrics and worker Lambda CloudWatch logs.
- **Failure demo not yet permanently failed:** allow time for three receives, then refresh. Check the main queue visibility timeout, redrive policy and DLQ consumer logs.
- **SAM deploy fails:** verify AWS credentials, account permissions, region and SAM CLI installation.
