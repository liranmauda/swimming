# Swimming – Competition Report

Project for parsing and displaying swimming competition results (loglig, isr.org.il).

## Home

Open `index.html` (via a local server or otherwise) and choose:
- **Competition report** – report with filters and columns
- **Load link – meet list** – enter a loglig/isr.org.il URL and get rows

## Local run

1. `npm install`
2. `node server.js` – server on port 8765
3. Open in browser: http://localhost:8765

## Deploy to AWS Lambda

The parse API (`GET /api/parse?url=...`) can run as a Lambda behind API Gateway.

### Requirements

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) installed
- AWS configured (`aws configure`)

### Build and deploy

```bash
npm install
sam build
sam deploy --guided
```

When you run `sam deploy --guided` you will be prompted for stack name, region, and to confirm changes. After deploy, the stack Outputs will show:

- **ParseApiUrl** – API URL (e.g. `https://xxxx.execute-api.eu-west-1.amazonaws.com/api/parse`)
- **ParseApiFunctionArn** – Lambda function ARN

### Using from the frontend

After deploy, if the app is served from another origin (e.g. S3/CloudFront), set the API base URL:

```html
<script>
  window.PARSE_API_BASE = 'https://YOUR-API-ID.execute-api.YOUR-REGION.amazonaws.com';
</script>
```

Or set `PARSE_API_BASE` in `parse-link.html` to the API URL from the stack Outputs.

### Local Lambda test

```bash
sam build
sam local invoke ParseApiFunction --event - <<'EOF'
{
  "requestContext": { "http": { "method": "GET" } },
  "queryStringParameters": { "url": "https://loglig.com:2053/..." },
  "rawQueryString": ""
}
EOF
```

(Replace the URL with a real competition link.)

### Automatic deploy with GitHub Actions

When Lambda-related files change, the workflow deploys the stack to AWS.

**When it runs:** On push to `main`/`master` when any of these change: `lambda.js`, `template.yaml`, `results_url_util.js`, `utils.js`, `package.json`, or the workflow file. You can also run it manually: Actions → Deploy Lambda to AWS → Run workflow.

**Setup (OIDC – recommended):**

1. In AWS: create a [GitHub OIDC Identity Provider](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) (`https://token.actions.githubusercontent.com`).
2. Create an IAM role that allows `AssumeRoleWithWebIdentity` from that OIDC provider, with permissions to deploy CloudFormation, Lambda, S3, API Gateway (or use `AdministratorAccess` for testing).
3. In GitHub: Settings → Secrets and variables → Actions. Add secret:
   - **`AWS_ROLE_ARN`** – the role ARN (e.g. `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`).

**Optional variables:**

- **`AWS_REGION`** (variable) – region (default: `us-east-1`).
- **`SAM_STACK_NAME`** (variable) – CloudFormation stack name (default: `swimming-parse-api`).

**If not using OIDC:** In `.github/workflows/deploy-lambda.yml`, change the "Configure AWS credentials" step to use `aws-access-key-id` and `aws-secret-access-key` from secrets, and set those secrets in GitHub.
