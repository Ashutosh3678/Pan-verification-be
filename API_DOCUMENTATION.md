# OneInfo Verification Gateway — API Documentation

> **Secure, Zero-Storage Identity Verification API**  
> Verifies PAN and Aadhaar identity documents on-the-fly through Cashfree without storing any customer personal data or PII in the database.

---

## 1. System Architecture & Privacy Policy

```
[User / Client Application]
          │
          ▼  (Headers: x-client-id, x-client-secret, x-environment)
┌────────────────────────────────────────────────────────┐
│             OneInfo Verification Gateway               │
├────────────────────────────────────────────────────────┤
│  1. Authenticates Client Credentials in Database       │
│  2. Resolves Environment Mode (Sandbox vs Prod)        │
│  3. Forwards Verification Request to Provider          │
│  4. Sanitizes Response (No Provider Branding Exposed)  │
│  5. Logs NON-PII Analytics (Clicks, Success, Failure)  │
│  6. ZERO Customer Data / KYC / PII Stored              │
└────────────────────────────────────────────────────────┘
          │
          ▼
[Verification Provider] (Cashfree Sandbox or Production)
```

### What Is Stored vs What Is NOT Stored
* ❌ **NOT Stored (0% Data Retention)**: No PAN numbers, Aadhaar numbers, names, dates of birth, photos, addresses, or raw KYC response payloads are saved to MongoDB or disk.
* ✅ **Stored**:
  1. **API Clients**: Registered client credentials (`clientId`, `clientSecret`, name, active status).
  2. **Analytics / Telemetry**: Request counts, link generations, success/failure counts, response times, and HTTP status codes (strictly without PII).

---

## 2. Authentication & Request Headers

Every request to the OneInfo Verification API must include the following headers:

| Header Name | Type | Description |
| :--- | :--- | :--- |
| `x-client-id` | String | Your OneInfo Client ID (e.g. `oi_cli_a1b2c3d4`) |
| `x-client-secret` | String | Your OneInfo Client Secret (e.g. `oi_sec_...`) |
| `x-api-key` | String | *(Alternative)* Single-header API key (e.g. `oi_live_...` or master key) |
| `x-environment` | String | **`sandbox`** (default) or **`prod`** |
| `Content-Type` | String | `application/json` |

---

## 3. Client Management API

### Register a New Client (Get Client ID & Secret)
Generate OneInfo credentials for an organization or consumer application.

* **Endpoint**: `POST /api/oneinfo/admin/clients`
* **Headers**: `x-admin-key: <master_api_key>`
* **Request Body**:
```json
{
  "name": "Fintech App Inc",
  "allowedModes": ["sandbox", "production"]
}
```

* **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "OneInfo API Credentials generated successfully. Keep your clientSecret safe.",
  "data": {
    "name": "Fintech App Inc",
    "clientId": "oi_cli_49e8a1d2e9f012b3",
    "clientSecret": "oi_sec_a7f89c0123de45fa67b89c0123de45fa67b89c01",
    "apiKey": "oi_live_b90123defa4567890123defa4567890123defa45",
    "allowedModes": ["sandbox", "production"],
    "isActive": true
  }
}
```

---

## 4. PAN Verification API

Validates a 10-digit PAN number and returns registered name and status directly from the tax authority database.

* **Endpoint**: `POST /api/oneinfo/pan/verify`
* **Headers**:
  ```http
  Content-Type: application/json
  x-client-id: oi_cli_49e8a1d2e9f012b3
  x-client-secret: oi_sec_a7f89c0123de45fa67b89c0123de45fa67b89c01
  x-environment: sandbox
  ```
* **Request Body**:
```json
{
  "pan": "ABCPV1234D",
  "name": "John Doe"
}
```

* **Success Response (200 OK)**:
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "oneinfo-pan-1727768400000",
    "referenceId": 98765,
    "pan": "ABCPV1234D",
    "type": "Individual",
    "nameProvided": "John Doe",
    "registeredName": "JOHN DOE",
    "valid": true,
    "message": "PAN is valid",
    "nameMatchScore": "1.00",
    "nameMatchResult": "DIRECT_MATCH",
    "panStatus": "VALID",
    "aadhaarSeedingStatus": "SUCCESS",
    "aadhaarSeedingStatusDesc": "Aadhaar is linked with PAN"
  }
}
```

* **Validation Failure (400 Bad Request)**:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "pan is required and must be a valid 10-character PAN (e.g. ABCPV1234D)"
  ]
}
```

---

## 5. Aadhaar Verification APIs (DigiLocker Flow)

### Step 1: Verify Account Existence
Check if an Aadhaar number or mobile number is registered with DigiLocker before generating a consent journey.

* **Endpoint**: `POST /api/oneinfo/aadhaar/verify`
* **Request Body**:
```json
{
  "aadhaarNumber": "655675523712"
}
```
*(Or use `"mobileNumber": "9988112233"`)*

* **Success Response (200 OK)**:
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "oneinfo-aadhaar-1727768500000",
    "referenceId": 12345,
    "aadhaarNumber": "XXXXXXXX3712",
    "status": "ACCOUNT_EXISTS",
    "valid": true,
    "message": "Aadhaar account is registered with DigiLocker",
    "digilockerId": "8aa626bf-34aa-5ffc-a123-f69207e129a7"
  }
}
```

---

### Step 2: Generate DigiLocker Consent Link
Generates an authenticated URL to redirect the customer for consent-based Aadhaar verification.

* **Endpoint**: `POST /api/oneinfo/aadhaar/initiate`
* **Request Body**:
```json
{
  "redirectUrl": "https://yourapp.com/kyc-callback",
  "userFlow": "signup"
}
```

* **Success Response (200 OK)**:
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "oneinfo-dgl-1727768600000",
    "referenceId": 40801,
    "url": "https://verification-test.cashfree.com/dgl/h7562ci7us0",
    "status": "PENDING",
    "userFlow": "signup",
    "documentRequested": ["AADHAAR"],
    "redirectUrl": "https://yourapp.com/kyc-callback"
  }
}
```

---

### Step 3: Check Live Verification Status
Poll or query verification status using the `verificationId` received during link generation.

* **Endpoint**: `GET /api/oneinfo/aadhaar/status/:verificationId`
* **Example**: `GET /api/oneinfo/aadhaar/status/oneinfo-dgl-1727768600000`

* **Success Response (200 OK)**:
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "oneinfo-dgl-1727768600000",
    "referenceId": 40801,
    "status": "AUTHENTICATED",
    "valid": true,
    "userDetails": {
      "name": "John Doe",
      "dob": "02-02-1995",
      "gender": "M",
      "mobile": "9988112233",
      "eaadhaar": "Y"
    },
    "documentRequested": ["AADHAAR"],
    "documentConsent": ["AADHAAR"],
    "documentConsentValidity": "2026-10-01T15:00:00.000Z"
  }
}
```

---

### Step 4: Retrieve Verified Document & Demographic Details
Once status is `AUTHENTICATED`, call this endpoint to retrieve official demographic data and address.

* **Endpoint**: `GET /api/oneinfo/aadhaar/document/:verificationId`
* **Example**: `GET /api/oneinfo/aadhaar/document/oneinfo-dgl-1727768600000`

* **Success Response (200 OK)**:
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "oneinfo-dgl-1727768600000",
    "referenceId": 40801,
    "status": "SUCCESS",
    "valid": true,
    "aadhaarNumber": "XXXXXXXX5647",
    "registeredName": "Mallesh Fakkirappa Dollin",
    "careOf": "S/O: Fakkirappa Dollin",
    "dob": "02-02-1995",
    "gender": "M",
    "yearOfBirth": 1995,
    "photoLink": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "splitAddress": {
      "country": "India",
      "state": "Karnataka",
      "dist": "Haveri",
      "subdist": "Ranibennur",
      "pincode": "581115",
      "street": "Umashankar Nagar 1st Main"
    },
    "message": "Aadhaar document retrieved successfully"
  }
}
```

---

## 6. Analytics & Telemetry API

Access real-time aggregated metrics, click tracking, success/failure rates, endpoint-by-endpoint breakdowns, and live production quota/guardrail status.

* **Endpoint**: `GET /api/oneinfo/analytics/summary`
* **Headers**: `x-client-id`, `x-client-secret` (or `x-api-key`)
* **Query Parameters**:
  * `environment`: `sandbox` | `production` (optional filter)
  * `timeframeDays`: `7` | `30` | `90` (default: 30)

* **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "timeframe": "Past 30 days",
    "guardrails": {
      "production": {
        "pan": {
          "enabled": true,
          "todayUsed": 12,
          "dailyLimit": 100,
          "remaining": 88
        },
        "aadhaar": {
          "enabled": true,
          "todayUsed": 9,
          "dailyLimit": 50,
          "remaining": 41
        }
      }
    },
    "totalsByEnvironment": {
      "sandbox": {
        "totalRequests": 14,
        "success": 14,
        "failure": 0,
        "successRate": "100.00%"
      },
      "production": {
        "totalRequests": 21,
        "success": 16,
        "failure": 5,
        "successRate": "76.19%"
      }
    },
    "aadhaarEndpointBreakdown": {
      "/aadhaar/verify": {
        "sandbox": { "requests": 3, "success": 3, "failure": 0, "avgLatencyMs": 486 },
        "production": { "requests": 5, "success": 1, "failure": 4, "avgLatencyMs": 754 }
      },
      "/aadhaar/initiate": {
        "sandbox": { "requests": 4, "success": 4, "failure": 0, "avgLatencyMs": 120 },
        "production": { "requests": 2, "success": 2, "failure": 0, "avgLatencyMs": 124 }
      },
      "/aadhaar/status": {
        "sandbox": { "requests": 4, "success": 4, "failure": 0, "avgLatencyMs": 95 },
        "production": { "requests": 2, "success": 2, "failure": 0, "avgLatencyMs": 109 }
      },
      "/aadhaar/document": {
        "sandbox": { "requests": 3, "success": 3, "failure": 0, "avgLatencyMs": 210 },
        "production": { "requests": 2, "success": 1, "failure": 1, "avgLatencyMs": 232 }
      }
    },
    "panEndpointBreakdown": {
      "/pan/verify": {
        "sandbox": { "requests": 8, "success": 8, "failure": 0, "avgLatencyMs": 179 },
        "production": { "requests": 12, "success": 11, "failure": 1, "avgLatencyMs": 240 }
      }
    },
    "recentActivity": [
      {
        "clientId": "oi_cli_fb890847ebf9cf4a",
        "clientName": "Fintech App Inc",
        "service": "AADHAAR",
        "action": "DOCUMENT_FETCH",
        "endpoint": "/aadhaar/document",
        "environment": "production",
        "status": "SUCCESS",
        "statusCode": 200,
        "responseTimeMs": 1474,
        "createdAt": "2026-10-01T10:09:17.777Z"
      }
    ]
  }
}
```

---

## 7. Production Guardrails & Quotas

OneInfo provides built-in enterprise safety guardrails to protect against unexpected production costs, accidental loops, or rogue traffic.

### Configuration Variables (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ENABLE_PROD_PAN` | `true` | Emergency Kill-Switch for Live PAN verification (`true` / `false`) |
| `ENABLE_PROD_AADHAAR` | `true` | Emergency Kill-Switch for Live Aadhaar verification (`true` / `false`) |
| `PROD_PAN_DAILY_LIMIT` | `100` | Max live PAN verification requests per calendar day |
| `PROD_AADHAAR_DAILY_LIMIT` | `50` | Max live Aadhaar verification requests per calendar day |
| `PROD_RATE_LIMIT_PER_MINUTE` | `10` | Max live verification requests per minute per client |

> [!NOTE]
> **Dynamic Reloading**: Edits to `.env` guardrail settings apply instantly on the fly without needing to restart the backend Node.js process.
> **Sandbox Exemption**: Sandbox mode (`x-environment: sandbox`) is **completely unrestricted** by these guardrails and quotas, allowing unlimited testing.

### Guardrail Error Responses

* **Kill-Switch Triggered (`403 Forbidden`)**:
  ```json
  {
    "success": false,
    "environment": "production",
    "message": "Guardrail Blocked: Production PAN verification is currently disabled by system policy."
  }
  ```

* **Daily Quota Reached (`429 Too Many Requests`)**:
  ```json
  {
    "success": false,
    "environment": "production",
    "message": "Guardrail Blocked: Daily production limit of 50 AADHAAR verifications reached for today. (Current usage: 50/50)."
  }
  ```

* **Rate Limit Exceeded (`429 Too Many Requests`)**:
  ```json
  {
    "success": false,
    "environment": "production",
    "message": "Rate limit exceeded: Maximum 10 production AADHAAR requests per minute allowed."
  }
  ```

---

## 8. Sandbox Test Data Reference

Use these mock values to simulate verification flows in `sandbox` mode:

| Document / Service | Test Parameter | Expected Outcome |
| :--- | :--- | :--- |
| **Aadhaar Number** | `655675523712` | Valid (`ACCOUNT_EXISTS`) |
| **Aadhaar Number** | `655675523711` | Valid (`ACCOUNT_EXISTS`) |
| **Aadhaar Number** | `655675523710` | Invalid (`ACCOUNT_NOT_FOUND`) |
| **Mobile Number** | `9988112233` (any `9988xxxxxx`) | Valid DigiLocker Account |
| **Sandbox OTP** | **`111000`** | Universal OTP for all simulated consent flows |
| **Individual PAN** | `ABCPV1234D` | Valid (Name: `JOHN DOE`) |
| **Individual PAN** | `XYZPP4321W` | Valid |
| **Business PAN** | `ABCCD8000T` | Valid |
| **Invalid PAN** | `DEFPV0126D` | Invalid / Failed verification |

---

## 9. Switching to Live Production

To verify **real-world identity documents**:
1. Configure your Production credentials in [`.env`](file:///.env):
   ```env
   CASHFREE_PROD_CLIENT_ID=your_actual_prod_id
   CASHFREE_PROD_CLIENT_SECRET=your_actual_prod_secret
   ```
2. Whitelist your server's public IP address in your verification partner dashboard.
3. In your API request headers, specify:
   ```http
   x-environment: prod
   ```
4. Real UIDAI and Income Tax department servers will be queried directly. Live OTPs will be sent via SMS to the citizen's Aadhaar-linked mobile phone.

