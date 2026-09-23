# OMNIV3 Consulting

Static Astro + Tailwind website, hosted on AWS Amplify. The contact form calls a
separate API Gateway HTTP API → Node 22 Lambda → SES backend. No Astro server or
Node adapter is required; `dist/` is the complete website output.

## Local development and verification

```sh
nvm use
npm ci
npm ci --prefix backend/contact
npm test
npm run build
npm run preview
```

Node 22.12 or later in the Node 22 line is required. `.nvmrc` and `amplify.yml`
select Node 22. For development, follow AGENTS.md's background-server guidance.
Backend tests mock SES; they do not send emails or require AWS credentials.

Copy `.env.example` to `.env` and set `PUBLIC_CONTACT_API_URL` to the backend's
`ContactApiUrl` output. This is public build-time configuration: changing it
requires rebuilding the site. If absent, the form is disabled with an unavailable
message. Never put AWS credentials in a `PUBLIC_` variable.

## Backend infrastructure (prepare for review; not deployed)

`infra/template.json` is an AWS SAM template. Parameters:

- `AllowedOrigin`: defaults to `https://omnir3.com`, the canonical production origin.
  Use no trailing slash. All other origins, including `www`, are denied.
- `SesFromEmail`: verified sender email address.
- `ContactToEmail`: fixed destination inbox; visitors cannot choose recipients.
- `SesIdentity`: verified SES identity (domain or address) authorizing the sender.

SAM maps those parameters to `ALLOWED_ORIGIN`, `SES_FROM_EMAIL`, and
`CONTACT_TO_EMAIL` Lambda environment variables. `AWS_REGION` and temporary IAM
credentials come from Lambda. SES must be configured in the same AWS region.
Verify the identity first; SES sandbox accounts also require a verified recipient,
and production access is needed to remove sandbox restrictions.

For local infrastructure validation with the AWS SAM CLI installed:

```sh
sam validate --lint --template-file infra/template.json
sam build --template-file infra/template.json
```

After review and explicit deployment approval, an operator can deploy the SAM
build with the origin and three required SES parameters, then copy `ContactApiUrl` into Amplify's
`PUBLIC_CONTACT_API_URL` environment variable. No AWS resources are created by
`npm ci`, `npm test`, or `npm run build`.

## Amplify and the GoDaddy domain

`amplify.yml` installs Node 22, runs `npm ci` and `npm run build`, and publishes
`dist/`. Use static hosting, with no SSR compute or server start command.
After approval, connect the intended repository branch to Amplify, configure the
API URL, and add the custom domain in Amplify. Keep GoDaddy as the registrar and
add the exact DNS verification and routing records Amplify supplies there.

Use `omnir3.com` as the canonical hostname and redirect `www.omnir3.com` to it. Set
`AllowedOrigin` to that canonical origin. Amplify preview domains and localhost
are deliberately not allowed by the production API. For end-to-end local UI
checks, use a local mock API; backend handler tests cover request processing.

## Validation, CORS and spam controls

The handler accepts only JSON POSTs from the configured origin, enforces a 16 KB
body limit and field types/lengths, validates the email and package, and requires
at least 30 characters of project details. Email content is plain text; the sender
and recipient are fixed, with the visitor's address used only as Reply-To.
Success is reported only after SES accepts the message (not a delivery guarantee).
Provider failures return a generic error; logs omit message content and addresses.

API Gateway handles CORS preflight for the exact origin, POST, and Content-Type.
The Lambda independently checks Origin. The hidden honeypot silently discards
filled submissions. API Gateway throttles to 1 request/second with a burst of 5;
Lambda concurrency is capped at 2 and logs expire after 14 days. IAM permits only
SES SendEmail for the configured identity, sender, and recipient.

CORS is a browser policy, not authentication: bots can forge Origin and bypass a
honeypot. Throttling is aggregate and best-effort, not per-IP. These are basic spam
controls; add a verified challenge or persistent per-IP rate limiting if abuse
warrants it. This implementation does not retry submissions automatically or
provide deduplication; after a network timeout, a manual retry may send twice.

Reference: [Astro components](https://docs.astro.build/en/basics/astro-components/)
and [AWS SAM HTTP API](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-httpapi.html).

## Review verification

Verified locally on Node 22.23.2: root and backend `npm ci`, all eight handler
tests, `npm run build` with and without an API URL, and `cfn-lint` against the SAM
template. The configured URL appears in the generated page; no `dist/server` or
Astro API endpoint remains. AWS deployment, SES delivery, DNS changes and Amplify
publishing have not been performed.

The existing Astro dependency tree still reports npm audit advisories, including
Astro/AVIF and transitive sharp/js-yaml findings. Dependency security upgrades
remain a follow-up before production; this branch does not claim a clean audit.
The separate Lambda dependency install reported no vulnerabilities.
