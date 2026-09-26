# Portal connection handoff (Helix mock API)

Helix can host a separate credential form for a portal connection. The webchat
should render a **Connect portal** action from its own backend. Password and
OTP are entered on the Helix `/connect` page and never pass through this
demo's `/api/chat` endpoint or a Helix chat message.

The current Helix implementation is a **mock portal only**. It is for testing
the handoff; never ask a customer for real portal credentials with it. The
mock is disabled unless Helix runs with both
`HELIX_PORTAL_MOCK_ENABLED=1` and a non-empty `HELIX_ENCRYPTION_KEY`. Set
`SERVER_URL` to the public Helix origin used by the browser. The form displays
the test username `demo`, password `demo-password`, and OTP `123456`.

## API

All project endpoints require a Helix bearer key with access to the named
project. Use that key only in a trusted gateway or this demo's server routes,
never in browser JavaScript or a bot sandbox.

### Create a connection

```http
POST /api/v1/projects/{project_id}/portal-connections
Authorization: Bearer <server-side Helix key>
Content-Type: application/json

{
  "customer_id": "customer-123",
  "conversation_id": "conversation-456",
  "portal": "mock",
  "brand_name": "Example Support",
  "accent_color": "#20a5a1"
}
```

Returns `201` with a `connection` object (`id`, project/customer/conversation
IDs, portal, status, expiry) and `invite_url`. The URL has the shape
`https://<helix-host>/connect#<random-token>`. The token is in the fragment,
which a browser does not send with its initial HTTP request. The page removes
it from browser history and exchanges it once, after the customer clicks
**Continue**, for a short-lived, HttpOnly connection-flow cookie. Invitations expire after 10 minutes; the
form flow expires after 20 minutes.

Display `invite_url` as a **Connect portal** button or send it directly through
your customer channel. Keep it out of the bot's prompt and Helix chat history.
Treat it as a bearer link until it is redeemed. The gateway must derive
`customer_id` and `conversation_id` from its authenticated customer session,
not from a chat message or model output.

### Read status

```http
GET /api/v1/projects/{project_id}/portal-connections/{connection_id}
Authorization: Bearer <server-side Helix key>
```

The `status` starts at `password_pending`, changes to `otp_pending`, then
`connected`; it may also be `failed`, `expired`, or `revoked`. Poll from the
gateway and show only a safe status to the chat UI. No response includes the
password, OTP, or portal session. A connected mock session expires after one
hour.

### Use the bounded mock operation

```http
GET /api/v1/projects/{project_id}/portal-connections/{connection_id}/account-status
Authorization: Bearer <server-side Helix key>
```

Returns `{"customer_id":"customer-123","portal":"mock","account_status":"active"}`
only when the connection is active. The gateway may pass this sanitized result
to the bot. Do not expose the Helix key or the connection operation endpoint
as an unrestricted model tool; the gateway must bind the operation to its
current customer and conversation.

### Revoke

```http
DELETE /api/v1/projects/{project_id}/portal-connections/{connection_id}
Authorization: Bearer <server-side Helix key>
```

Returns `204` and clears the mock session and flow tokens.

## Try it

Create an invitation with a server-side key, open `invite_url` in a browser,
enter the demo credentials and OTP shown on the page, then call the status and
account-status endpoints. A second exchange of the same URL fails. Revoking
the connection makes the account-status operation fail.

This demo currently has no authenticated customer identity or server-owned
conversation mapping; its Helix session ID is kept in browser storage. Wire
those boundaries before adding a customer-facing Connect button. The mock
API does not log in to a real portal, and custom domains and Artifact-based
theme previews are not part of this first implementation.
