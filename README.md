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
- `SesFromEmail`: defaults to `info@omnir3.com`. The sender must be authorized by
  the verified SES identity.
- `ContactToEmail`: defaults to `epdevio23@gmail.com`; visitors cannot choose recipients.
- `SesIdentity`: defaults to `omnir3.com`, to be verified through SES DNS records
  at GoDaddy. This does not create an email mailbox.

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
build with the reviewed parameter defaults (or explicit overrides), then copy
`ContactApiUrl` into Amplify's
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

Verified locally on Node 22.23.2: root and backend `npm ci`, handler and infrastructure parameter
tests, `npm run build` with and without an API URL, and `cfn-lint` against the SAM
template. The configured URL appears in the generated page; no `dist/server` or
Astro API endpoint remains. AWS deployment, SES delivery, DNS changes and Amplify
publishing have not been performed.

The dependency lockfile now resolves Astro 7.2.8, sharp 0.35.4, and js-yaml 4.3.2.
Fresh `npm ci` and `npm audit` runs for both the website and Lambda reported zero
known vulnerabilities on September 23, 2026. Astro's minimum dependency version
is raised to 7.2.8, the [patched AVIF release](https://github.com/advisories/GHSA-26w7-cxv4-gfx2).

### AWS readiness observed before merge

Read-only checks on September 23, 2026 in `us-west-1` found:

- Amplify app `OMNIV3-Consulting` has automatic builds enabled for production
  branch `main`. Merging to that remote branch can immediately publish the site.
- Neither the app nor `main` has `PUBLIC_CONTACT_API_URL` configured.
- The app has no custom domain association yet.
- SES sending is enabled, but production access is disabled and no SES email or
  domain identities are configured in this region.

Before a production merge, finish SES identity/DNS verification for `omnir3.com`
and recipient verification for `epdevio23@gmail.com` while in the sandbox, deploy
the reviewed backend, configure the API URL in
Amplify, and connect `omnir3.com`. In the SES sandbox the recipient must also be
verified; request production access if an unverified recipient is needed. Verify
preflight and a real form submission after deployment. These steps have not been
performed; no AWS settings were changed during the checks. If merging code before
this setup, first explicitly disable automatic deployment in Amplify.
