# Helix Connect: generic secret intake

For a bot that needs a username, password, API key, or OTP, create a Helix secret intake and give the customer its link. The customer fills in a Helix-hosted form. Values go to Helix directly, outside this demo's chat endpoint and outside MCP tool results. The bot can request an intake and check its status, but cannot retrieve submitted values through these tools.

Enable Helix with `HELIX_SECRET_INTAKE_ENABLED=1`, a deployment-specific `HELIX_ENCRYPTION_KEY`, and an HTTPS `SERVER_URL` (loopback HTTP is allowed for local development).

## Create an intake through the project API

Use a Helix bearer key from a trusted server. Derive the customer and conversation IDs from your authenticated customer session, not from model output. Helix stores them with the intake ID, which ties the link and submitted values to the requesting project and conversation; the URL alone does not authenticate the customer.

```http
POST /api/v1/projects/{project_id}/secret-intakes
Authorization: Bearer <server-side Helix key>
Content-Type: application/json

{
  "customer_id":"customer-123",
  "conversation_id":"conversation-456",
  "title":"Connect your portal",
  "brand_name":"Example Support",
  "accent_color":"#20a5a1",
  "fields":[
    {"name":"username","label":"Username","type":"text","required":true,"autocomplete":"username"},
    {"name":"password","label":"Password","type":"password","required":true,"autocomplete":"current-password"}
  ]
}
```

The `201` response contains `intake` metadata and `invite_url`, shaped like `https://<helix-host>/connect/intake/<intake_id>#<token>`. Show the URL to the customer as a link or button. The token is a one-time bearer invitation in the URL fragment. Opening the link automatically exchanges the intake ID and token for a short-lived HttpOnly cookie, then renders the requested fields and receives the form POST. The visible ID identifies the request; the token proves possession of its invitation. The invitation lasts 10 minutes and the form flow lasts 20 minutes. Submitted values are encrypted at rest, expire after one hour, and are cleared sooner when a trusted connector consumes or revokes them.

`fields` has 1 to 8 caller-defined entries; the form is not tied to a particular website or credential type. Names use lowercase letters, digits, and underscores; types are `text` or `password`. Labels, `required`, and supported autocomplete hints drive the trusted form. For a later OTP, create a second intake with a field such as `{"name":"otp","label":"Code","type":"password","required":true,"autocomplete":"one-time-code"}`.

## Status, direct submission, and revocation

```http
GET /api/v1/projects/{project_id}/secret-intakes/{intake_id}
Authorization: Bearer <server-side Helix key>
```

Status is `pending`, `submitted`, `consumed`, `expired`, or `revoked`. Responses include no values. A trusted third-party backend with project Update access can submit directly over HTTPS:

```http
POST /api/v1/projects/{project_id}/secret-intakes/{intake_id}/submissions
Authorization: Bearer <server-side Helix key>
Content-Type: application/json

{"values":{"username":"alice","password":"..."}}
```

The response is `204` with no body. Extra or missing required fields are rejected. Revoke with `DELETE /api/v1/projects/{project_id}/secret-intakes/{intake_id}`; this clears any ciphertext. Never put the Helix bearer key in browser JavaScript or a model-visible tool.

## MCP tools

The Helix owner bot receives `request_secret_intake` and `get_secret_intake_status`; attach them explicitly to other bots. The request tool accepts the create body above and returns `{id,status,invite_url}`. The status tool accepts `{"intake_id":"sci_..."}` and returns status and expiry only. Helix binds both calls to the authenticated bot's own project. The bot can give the user a link, then check whether it was submitted. Submitted values require a trusted server-side connector using Helix's one-time `ConsumeSecretIntake` method; no plaintext read API or MCP tool is provided. That connector can log into the destination service and expose narrow, safe operations to the bot. The generic intake itself does not implement a portal login.

## Artifact page copy

Optionally set `artifact_id` when creating the intake. It must refer to a single-file HTML Artifact in the same project, with one `<div data-helix-form></div>` placeholder. Helix snapshots safe static copy from the artifact and inserts its own form there. Scripts, styles, attributes, external media, and artifact-supplied input controls are stripped; the artifact cannot receive or redirect credentials. Use `brand_name` and `accent_color` for the supported white-label styling. New artifact versions affect new invitations only.

This demo has no authenticated customer mapping yet, so it documents the API without creating a customer-facing Connect button. A production gateway must bind each intake to its authenticated customer and conversation before presenting the link or status.
