# Deploying to AWS App Runner

This directory contains the AWS CDK stack that provisions:

- An ECR repository (`cbam-app`)
- Two Secrets Manager entries (`anthropic-api-key`, `voyage-api-key`)
- An App Runner service that auto-deploys whenever the `:latest` image is pushed to ECR
- IAM roles scoped to those secrets

The app's runtime profile (Claude Agent SDK with in-process MCP tools, SSE streaming, ~60s tail latency, glibc-linked CLI binary) fits inside App Runner's envelope today. If you ever raise `maxTurns` past ~12 or chain slower tools, migrate to ECS Fargate — the `imageRepository` block in `cbam-app-stack.ts` is the only thing that has to change.

---

## One-time setup

You need:

- An AWS account with admin or equivalent.
- AWS CLI v2 logged in (`aws sts get-caller-identity` should work).
- Node.js 20+ and Docker Desktop locally (only needed if you want to test the image before pushing).

### 1. Install CDK deps

```bash
cd infra
npm install
```

### 2. Bootstrap the account/region (first time only)

```bash
npx cdk bootstrap aws://<account-id>/us-east-1
```

### 3. First deploy of the stack

App Runner refuses to start a service when the ECR repo is empty, so the first deploy is a two-step dance:

```bash
# Step A: deploy ECR + secrets only. The App Runner service will be in
# CREATE_FAILED until step C — that's expected.
npx cdk deploy CbamAppStack
```

If `cdk deploy` fails on the App Runner resource the first time, that's fine — the ECR repo and secrets will still have been created. Capture the outputs (or look them up):

```bash
aws cloudformation describe-stacks --stack-name CbamAppStack \
  --query "Stacks[0].Outputs" --output table
```

### 4. Populate the secrets

```bash
aws secretsmanager put-secret-value \
  --secret-id <AnthropicSecretArn> \
  --secret-string 'sk-ant-...'

aws secretsmanager put-secret-value \
  --secret-id <VoyageSecretArn> \
  --secret-string 'pa-...'
```

### 5. Push the first image

From the repo root:

```bash
# Authenticate Docker against ECR
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build for linux/amd64 (the Agent SDK only ships a linux-x64 binary)
docker buildx build --platform linux/amd64 \
  -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/cbam-app:latest \
  --push .
```

### 6. Re-run cdk deploy to bring up App Runner

```bash
cd infra
npx cdk deploy CbamAppStack
```

The `ServiceUrl` output is your public HTTPS endpoint. First boot takes ~3 minutes while App Runner pulls the 250 MB SDK binary in the image.

### 7. Smoke test

```bash
SERVICE=$(aws cloudformation describe-stacks --stack-name CbamAppStack \
  --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl'].OutputValue" --output text)

# Home page (static)
curl -I "$SERVICE"

# Chat SSE — should stream events: text, retrieved, done
curl -N -X POST "$SERVICE/api/chat" \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"What are the system boundaries for embedded emissions under CBAM?"}],"framework":"cbam"}'
```

If the chat endpoint streams `event: retrieved` and then `event: text` chunks, RAG and the Agent SDK are both wired up correctly.

---

## GitHub Actions auto-deploy

The workflow in `.github/workflows/deploy.yml` builds and pushes on every push to `main`. App Runner's `autoDeploymentsEnabled=true` setting on the `:latest` tag means the push itself is the deploy trigger.

### Configure GitHub OIDC -> AWS

One-time, in the AWS account:

1. Create an OIDC identity provider for `token.actions.githubusercontent.com`.
2. Create an IAM role `github-actions-cbam-app` trusted by that provider, restricted to your repo's ref:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
         },
         "StringLike": {
           "token.actions.githubusercontent.com:sub": "repo:<org>/<repo>:ref:refs/heads/main"
         }
       }
     }]
   }
   ```

3. Attach a policy granting only what's needed:

   - `ecr:GetAuthorizationToken` (resource: `*`)
   - `ecr:BatchCheckLayerAvailability`, `ecr:CompleteLayerUpload`, `ecr:InitiateLayerUpload`, `ecr:PutImage`, `ecr:UploadLayerPart`, `ecr:BatchGetImage` (resource: the `cbam-app` repo ARN)
   - `apprunner:ListServices` (resource: `*`) — only used for the post-deploy URL print

4. In the GitHub repo, add a secret `AWS_DEPLOY_ROLE_ARN` pointing at the role's ARN.

After that, push to `main` and the workflow handles the rest.

---

## Operating notes

### Watching deploys

```bash
aws apprunner describe-service --service-arn <arn> \
  --query "Service.Status"
```

`OPERATION_IN_PROGRESS` -> `RUNNING` is the happy path. On failure, check:

```bash
aws logs tail /aws/apprunner/cbam-app/<service-id>/service --follow
aws logs tail /aws/apprunner/cbam-app/<service-id>/application --follow
```

### Rotating API keys

```bash
aws secretsmanager put-secret-value --secret-id <arn> --secret-string '...'
aws apprunner start-deployment --service-arn <arn>   # picks up new env
```

### Cost shape

App Runner: ~$5/instance/month minimum (1 vCPU / 2 GB) + active request time. Add ECR storage ($0.10/GB/mo) and Secrets Manager ($0.40/secret/mo). The dominant cost will be Anthropic + Voyage tokens, not infra.

### When to migrate off App Runner

Move to ECS Fargate behind an ALB if any of these become true:

- Agent runs need >120s end-to-end (App Runner caps requests).
- You want a fixed egress IP (App Runner needs a VPC connector for that, which loses the "managed" simplicity).
- You need request-level metrics App Runner doesn't expose.
- You want WAF/CloudFront in front of the app.

The Dockerfile and CI workflow port over unchanged; only the App Runner block in the CDK stack gets replaced with `ApplicationLoadBalancedFargateService`.
