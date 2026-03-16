# Swimming – דוח תחרות שחייה

פרויקט לניתוח והצגת תוצאות תחרויות שחייה (loglig, isr.org.il).

## דף הבית

פתח `index.html` (דרך שרת מקומי או אחר) ובחר:
- **דוח תחרות שחייה** – דוח עם סינון ועמודות
- **טעינת קישור – רשימת משחה** – הזנת קישור ל־loglig/isr.org.il וקבלת רשומות

## הרצה מקומית

1. `npm install`
2. `node server.js` – שרת על פורט 8765
3. פתח בדפדפן: http://localhost:8765

## פריסה ל־AWS Lambda

ה־API של פרסור הקישור (`GET /api/parse?url=...`) ניתן להרצה כ־Lambda עם API Gateway.

### דרישות

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) מותקן
- AWS מוגדר (`aws configure`)

### בנייה ופריסה

```bash
npm install
sam build
sam deploy --guided
```

בהרצת `sam deploy --guided` תתבקש להזין שם Stack, Region ו־Confirm changes. אחרי הפריסה יופיעו ב־Outputs:

- **ParseApiUrl** – כתובת ה־API (למשל `https://xxxx.execute-api.eu-west-1.amazonaws.com/api/parse`)
- **ParseApiFunctionArn** – ה־ARN של פונקציית ה־Lambda

### שימוש מה־Frontend

אחרי הפריסה, אם הדפים מוגשים מתחום אחר (למשל S3/CloudFront), הגדר את כתובת ה־API:

```html
<script>
  window.PARSE_API_BASE = 'https://YOUR-API-ID.execute-api.YOUR-REGION.amazonaws.com';
</script>
```

או התאם את `PARSE_API_BASE` ב־`parse-link.html` לכתובת ה־API שהתקבלה ב־Outputs.

### בדיקה מקומית של ה־Lambda

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

(החלף את ה־URL בקישור תחרות אמיתי.)

### פריסה אוטומטית עם GitHub Actions

כשמשנים קבצים הקשורים ל־Lambda, ה־workflow מפרס את ה־Stack ל־AWS.

**מתי זה רץ:** על דחיפה ל־`main`/`master` כשמשתנים: `lambda.js`, `template.yaml`, `results_url_util.js`, `utils.js`, `package.json`, או ה־workflow עצמו. אפשר גם להריץ ידנית: Actions → Deploy Lambda to AWS → Run workflow.

**הגדרה (OIDC – מומלץ):**

1. ב־AWS: צור [OIDC Identity Provider](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) ל־GitHub (`https://token.actions.githubusercontent.com`).
2. צור IAM Role שמאפשר `AssumeRoleWithWebIdentity` מה־OIDC, עם הרשאות לפרוס CloudFormation, Lambda, S3, API Gateway (או השתמש ב־`AdministratorAccess` לניסוי).
3. ב־GitHub: Settings → Secrets and variables → Actions. הוסף secret:
   - **`AWS_ROLE_ARN`** – ה־ARN של ה־Role (למשל `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`).

**אופציונלי – משתנים:**

- **`AWS_REGION`** (variable) – אזור (ברירת מחדל: `us-east-1`).
- **`SAM_STACK_NAME`** (variable) – שם ה־CloudFormation stack (ברירת מחדל: `swimming-parse-api`).

**אם לא משתמשים ב־OIDC:** ב־`.github/workflows/deploy-lambda.yml` החלף את שלב "Configure AWS credentials" לשימוש ב־`aws-access-key-id` ו־`aws-secret-access-key` מה־secrets, והגדר את ה־secrets המתאימים ב־GitHub.
