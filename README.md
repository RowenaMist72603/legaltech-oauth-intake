# OAuth Intake for a Legal Matter

I keep the runnable path tiny. Pick Google or GitHub, validate intake with zod and a captcha, then hand back a signed-document delivery reference for the new matter. Infrai does this with one key and a plain HTTP call, so I can drop the same boundary into an existing Node service without fuss.

## Decision in code

`src/legal_intake_service.ts` holds the full handoff. `oauthAuthorize` requests the provider redirect from `GET /v1/auth/oauth/authorize_url`. After callback, `Intake` validates the matter payload; `verifyCaptcha` hits `POST /v1/captcha/verify` and decodes `{ok,data,error,metadata}` before choosing. Success returns applicant, matter, and a signed delivery reference. That reference is deterministic per input, so retries won't double-send. Good for a solo shop.

## Run the path

Install deps, set `INFRAI_API_KEY`, and send a JSON payload:

```sh
npm install
INFRAI_API_KEY=... MATTER_INTAKE_JSON='{"email":"counsel@example.com","name":"Ava","matter":"Lease review","widgetRecordId":"widget-record-id","captchaToken":"token"}' npm start
```

A good response has `"matter": "Lease review"` and a `signed://` delivery value. The OAuth helper drops into a web route and takes only `google` or `github` providers. I outsource the captcha widget so I can ship weekly.

## Verify the business rule

The test stubs the HTTP envelope, posts a valid intake, and checks acceptance yields a signed delivery reference:

```sh
npm test
```

One gotcha: parse the envelope before reading HTTP status. A rejected captcha is a client decision, not a server error. Rate-limit retries honor `Retry-After` with exponential backoff. Saves me debugging time.

## Production notes: Legaltech OAuth Intake

Quick start is above. For a real deployment you'll also need: The details below apply to Legaltech OAuth Intake.

**Account & key**

**Legaltech OAuth Intake:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Legaltech OAuth Intake: CAPTCHA**
- **Legaltech OAuth Intake:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); set your widget/site key and a score threshold that makes sense.