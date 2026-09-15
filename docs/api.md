# API

Every handler returns the same envelope (`src/types/api.ts`):

```ts
{
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;   // field name -> messages
}
```

---

## `POST /api/inquiries`

Accepts a trade inquiry. Public, rate limited, no authentication.

### Request

```jsonc
{
  "contactName": "Ayesha Malik",
  "businessName": "Vision Care Associates",
  "email": "ayesha@example.pk",
  "phone": "0300 1234567",
  "city": "Islamabad",
  "businessType": "practice", // practice | retailer | lab | hospital | distributor | other
  "notes": "Need progressive 1.60 in volume.",
  "lines": [{ "productId": "lns-160-prog", "quantity": 40 }],
  "company": "", // honeypot - must stay empty
}
```

### Validation

Defined once in `src/lib/validations/inquiry.ts` and run by both the form and
this handler.

| Field          | Rule                                                 |
| -------------- | ---------------------------------------------------- |
| `contactName`  | 2-80 characters                                      |
| `businessName` | 2-120 characters                                     |
| `email`        | Valid email, 160 characters max, lowercased          |
| `phone`        | Pakistani format, with or without `+92` / `0` prefix |
| `city`         | 2-60 characters                                      |
| `businessType` | One of the six enum values                           |
| `notes`        | Optional, 2000 characters max                        |
| `lines`        | 40 entries max; unknown `productId`s are dropped     |

### Responses

| Status | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| `200`  | Accepted. `data.reference` is the customer-quotable ref. |
| `400`  | Body was not valid JSON.                                 |
| `422`  | Validation failed. `errors` is keyed by form field name. |
| `429`  | Rate limited. `Retry-After` header carries seconds.      |
| `500`  | Unexpected failure. Nothing internal is exposed.         |

A submission that trips the honeypot returns `200` with a normal success
message and is never processed — the bot learns nothing from the response.

Notification failure still returns `200`, with a message telling the visitor
to call if they do not hear back within one working day. The submission is
logged with its reference either way.

### Rate limit

5 requests per 10 minutes per client IP, fixed window. Process-local — see
_Known ceilings_ in [`architecture.md`](architecture.md).

---

## `GET /api/health`

Liveness probe.

```json
{
  "success": true,
  "message": "Service is healthy.",
  "data": { "status": "ok" }
}
```

Deliberately reports nothing about versions, dependencies or internals.
