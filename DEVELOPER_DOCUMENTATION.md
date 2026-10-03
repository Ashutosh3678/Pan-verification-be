# OneInfo Verification Platform — Comprehensive Developer Documentation

> **Zero-PII Identity Verification, Biometrics & Electronic Signature Gateway**  
> Complete technical reference, architectural overview, service specifications, and developer guide for the OneInfo backend platform.

---

## Table of Contents

1. [Platform Overview & Architecture](#1-platform-overview--architecture)
2. [Core Principles & Design Decisions](#2-core-principles--design-decisions)
3. [Authentication & Multi-Tenant Credentials](#3-authentication--multi-tenant-credentials)
4. [Environments & Routing Structure](#4-environments--routing-structure)
5. [Complete Service Catalog & API Reference](#5-complete-service-catalog--api-reference)
   - [5.1 Client Registration & Credential Issuance](#51-client-registration--credential-issuance)
   - [5.2 PAN Verification](#52-pan-verification)
   - [5.3 Aadhaar Verification & DigiLocker Flow](#53-aadhaar-verification--digilocker-flow)
   - [5.4 Aadhaar E-Sign (Electronic Document Signing)](#54-aadhaar-e-sign-electronic-document-signing)
   - [5.5 Face Liveness & Biometric Detection](#55-face-liveness--biometric-detection)
   - [5.6 GSTIN Verification](#56-gstin-verification)
   - [5.7 Mobile 360 OTP & Intelligence Flow](#57-mobile-360-otp--intelligence-flow)
   - [5.8 Telemetry & Analytics Dashboard](#58-telemetry--analytics-dashboard)
6. [Security Guardrails, Rate Limiting & Safety Controls](#6-security-guardrails-rate-limiting--safety-controls)
7. [Codebase Architecture & Directory Map](#7-codebase-architecture--directory-map)
8. [Configuration & Environment Variables](#8-configuration--environment-variables)
9. [Local Development & Verification Testing](#9-local-development--verification-testing)

---

## 1. Platform Overview & Architecture

OneInfo is an enterprise-grade KYC, identity verification, biometrics, and electronic signature platform. It acts as an intelligent, secure abstraction layer between client applications (fintechs, NBFCs, banks, marketplaces) and statutory/government identity databases in India (Income Tax Department, UIDAI, DigiLocker, GSTN, telecom registries).

```
┌─────────────────────────────────┐
│       Client Application        │
│   (Web, Mobile, Backend API)    │
└────────────────┬────────────────┘
                 │ HTTPS (TLS 1.3)
                 │ Headers: x-client-id, x-client-secret, x-environment
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 OneInfo Gateway (Node.js / Express)             │
│                                                                 │
│  ┌─────────────────────────┐     ┌───────────────────────────┐  │
│  │   Client Auth & Guard   │     │   Request Sanitization    │  │
│  │  (authenticateClient)   │────▶│    & Joi Validation       │  │
│  └─────────────────────────┘     └─────────────┬─────────────┘  │
│                                                │                │
│                                                ▼                │
│  ┌─────────────────────────┐     ┌───────────────────────────┐  │
│  │   In-Memory Multer      │     │  White-Labeling & Masking │  │
│  │  (Zero Disk Retention)  │◀───▶│  (URL & Email Rewriter)   │  │
│  └─────────────────────────┘     └─────────────┬─────────────┘  │
│                                                │                │
│                                                ▼                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │       Async Analytics Collector (Fire-and-Forget)         │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │                           │                           │
     ▼                           ▼                           ▼
┌──────────────┐         ┌───────────────┐           ┌──────────────┐
│  Income Tax  │         │ UIDAI / eSign │           │  GSTN / Telco│
│   (PAN DB)   │         │  (DigiLocker) │           │  (Mobile360) │
└──────────────┘         └───────────────┘           └──────────────┘
```

---

## 2. Core Principles & Design Decisions

### 2.1 Zero Data Retention (Zero-PII Storage)
- **In-Memory Buffer Streaming**: Document uploads (PDF contracts, face images) are processed entirely in transient RAM via `multer.memoryStorage()`. Once sent to upstream statutory providers, buffers are released and garbage-collected immediately.
- **No Identity Storage**: No PAN numbers, Aadhaar numbers, biometric selfies, signed contracts, or personal identity records are persisted to MongoDB or filesystem disks.
- **Aggregate Analytics Only**: Telemetry logs record only aggregate operational metrics: client identifier, service name, endpoint, latency (ms), HTTP status code, and timestamp.

### 2.2 Complete White-Labeling (Zero Upstream Provider Branding)
- **Sanitized Responses**: Raw provider references, vendor keys, and internal provider identifiers are stripped or mapped into clean OneInfo standard models.
- **Rewritten E-Sign URLs**: Signing links generated for signers are dynamically rewritten from upstream domains to `https://kyc.oneinfo.ai/esign?shortCode=...`.
- **White-Labeled Proxy Downloads**: Signed PDFs are downloaded via a dedicated gateway endpoint (`/api/esign/download/:verificationId`) which streams binary PDFs directly to the client without exposing third-party cloud buckets.
- **Provider Notification Suppression**: E-sign request payloads automatically suppress third-party vendor emails, ensuring signers only receive communications branded by the merchant.

### 2.3 Single Unified Route Structure (`/api/...`)
All services are mounted under a clean, unified RESTful prefix:
- Primary: `https://kyc.oneinfo.ai/api/<service>/<action>`
- Example: `https://kyc.oneinfo.ai/api/face/liveness`, `https://kyc.oneinfo.ai/api/pan/verify`
- Backwards compatibility is preserved for legacy `/api/oneinfo/...` callers.

### 2.4 Auto-Synchronized Timestamps
Upstream providers (such as Mobile 360) mandate timestamps within a strict 5-minute window. The gateway automatically injects current UTC timestamps (`new Date().toISOString()`) on incoming requests, eliminating client-side clock drift failures.

---

## 3. Authentication & Multi-Tenant Credentials

### 3.1 Authentication Scheme
Authentication uses client credential headers. The legacy single API key (`x-api`) feature has been completely retired in favor of strong two-factor client credentials:

| Header Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `x-client-id` | string | **Yes** | Public unique client identifier (`oi_cli_...`) |
| `x-client-secret` | string | **Yes** | Private secret key (`oi_sec_...`) |
| `x-environment` | string | **Yes** | Target environment: `sandbox` or `prod` (also accepts `x-mode`) |
| `Content-Type` | string | **Yes** | `application/json` (or `multipart/form-data` for file uploads) |

### 3.2 Master Admin Access
Internal administrative operations (e.g., viewing registered client lists) can authenticate using the `ONEINFO_MASTER_API_KEY` via `x-admin-key` or `x-api-key`.

---

## 4. Environments & Routing Structure

### 4.1 Environments
| Environment | Header Value | Description |
| :--- | :--- | :--- |
| **Sandbox** | `sandbox` | Safe test mode with predefined test data (UTAs), mock OTPs, and zero statutory charges |
| **Production** | `prod` or `production` | Live mode executing real-time queries against statutory databases |

### 4.2 Endpoint Overview Map

| Feature | HTTP Method | Path |
| :--- | :--- | :--- |
| **Register Client** | `POST` | `/api/clients/register` *(or `/api/register`)* |
| **PAN Verification** | `POST` | `/api/pan/verify` |
| **Aadhaar Verification** | `POST` | `/api/aadhaar/verify` |
| **Aadhaar DigiLocker Link** | `POST` | `/api/aadhaar/initiate` |
| **Aadhaar Live Status** | `GET` | `/api/aadhaar/status/:verificationId` |
| **Aadhaar Document Fetch** | `GET` | `/api/aadhaar/document/:verificationId` |
| **E-Sign Document Upload** | `POST` | `/api/esign/document/upload` |
| **E-Sign Create Request** | `POST` | `/api/esign/request` *(or `/api/esign/create`)* |
| **E-Sign Status Check** | `GET` | `/api/esign/status/:verificationId` |
| **E-Sign Gateway Redirect** | `GET` | `/esign` *(rewritten signer UI)* |
| **E-Sign Document Download** | `GET` | `/api/esign/download/:verificationId` |
| **Face Liveness Check** | `POST` | `/api/face/liveness` *(or `/api/face/check`)* |
| **GSTIN Verification** | `POST` | `/api/gstin/verify` *(or `/api/gstin`)* |
| **Mobile 360 Send OTP** | `POST` | `/api/mobile360/otp/send` |
| **Mobile 360 Verify OTP** | `POST` | `/api/mobile360/otp/verify` |
| **Analytics Summary** | `GET` | `/api/analytics/summary` |

---

## 5. Complete Service Catalog & API Reference

### 5.1 Client Registration & Credential Issuance

Generates an active `clientId` and `clientSecret` pair for a new tenant/organization.

* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/clients/register`
* **Auth**: Public or Admin key

#### Request Body
```json
{
  "name": "Fintech Solutions India Pvt Ltd",
  "allowedModes": ["sandbox", "production"]
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "message": "OneInfo API Credentials generated successfully. Keep your clientSecret safe.",
  "data": {
    "id": "6ac0bc799907d50c040bd48a",
    "name": "Fintech Solutions India Pvt Ltd",
    "clientId": "oi_cli_b5276979778a88ad",
    "clientSecret": "oi_sec_bc925441b680cde3806bb56cc241429d4cddecd159df2e5e",
    "allowedModes": ["sandbox", "production"],
    "isActive": true
  }
}
```

---

### 5.2 PAN Verification

Validates an individual or corporate Permanent Account Number against Income Tax Department records, verifying name match and Aadhaar-seeding status.

* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/pan/verify`

#### Request Body
```json
{
  "pan": "ABCPV1234D",
  "name": "John Doe",
  "verificationId": "custom_pan_ref_001"
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `pan` | string | **Yes** | 10-character alphanumeric PAN |
| `name` | string | Optional | Name to calculate fuzzy match score |
| `verificationId` | string | Optional | Custom reference ID for tracking |

#### Response (`200 OK`)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "custom_pan_ref_001",
    "referenceId": 91827364,
    "pan": "ABCPV1234D",
    "type": "Individual",
    "nameProvided": "John Doe",
    "registeredName": "JOHN DOE",
    "valid": true,
    "message": "PAN is valid",
    "nameMatchScore": 100,
    "nameMatchResult": "EXACT",
    "panStatus": "VALID",
    "aadhaarSeedingStatus": "LINKED",
    "aadhaarSeedingStatusDesc": "Aadhaar is linked with PAN",
    "lastUpdatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Sandbox Test UTA
- **Valid Individual PAN**: `ABCPV1234D` (Name: `John Doe`)
- **Valid Company PAN**: `AAACB1234C`
- **Invalid PAN**: `ABCDE1234F`

---

### 5.3 Aadhaar Verification & DigiLocker Flow

Provides direct verification and a 3-step legally compliant DigiLocker consent flow.

#### Step 1: Initiate DigiLocker Link
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/aadhaar/initiate`

```json
{
  "verificationId": "digi_session_1001",
  "redirectUrl": "https://yourapp.com/kyc-callback"
}
```

```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "digi_session_1001",
    "referenceId": 76030,
    "url": "https://kyc.oneinfo.ai/dgl?shortCode=t59hasdku7l0&env=sandbox",
    "status": "PENDING",
    "userFlow": "signup",
    "documentRequested": ["AADHAAR"],
    "redirectUrl": "https://yourapp.com/kyc-callback"
  }
}
```

Response returns a fully white-labeled `url` (`https://kyc.oneinfo.ai/dgl?shortCode=...`) to redirect the user to complete Aadhaar OTP consent. Gateway automatically redirects the browser securely to the verification flow.

#### Step 2: Check Status
* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/api/aadhaar/status/:verificationId`

Response returns `status: "AUTHENTICATED"`, `"PENDING"`, or `"EXPIRED"`.

#### Step 3: Fetch Verified Document
* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/api/aadhaar/document/:verificationId`

Returns parsed Aadhaar data: name, date of birth, gender, full address, split address components, and base64 photograph.

#### Sandbox Test UTA
- **Test Aadhaar Number**: `723829102938`
- **Test OTP**: `123456`

---

### 5.4 Aadhaar E-Sign (Electronic Document Signing)

End-to-end legally binding electronic signature execution under the Information Technology Act.

#### Step 1: Upload Document
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/esign/document/upload`
* **Headers**: `Content-Type: multipart/form-data`

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `document` | File (PDF) | **Yes** | PDF file binary |
| `document_name` | string | Optional | Friendly document title |

Returns `documentId` (integer reference for Step 2).

#### Step 2: Create E-Sign Request
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/esign/request`

```json
{
  "verificationId": "contract_emp_1001",
  "documentId": 70694,
  "notificationModes": [],
  "authType": "AADHAAR",
  "expiryInDays": "3",
  "captureLocation": false,
  "redirectUrl": "https://yourapp.com/sign-complete",
  "signers": [
    {
      "name": "Ajay Sharma",
      "phone": "9876543210",
      "sequence": 1,
      "aadhaarLastFourDigit": "2941",
      "signPositions": [
        {
          "page": 1,
          "topLeftXCoordinate": 100,
          "bottomRightXCoordinate": 250,
          "topLeftYCoordinate": 180,
          "bottomRightYCoordinate": 120
        }
      ]
    }
  ]
}
```

> **Engineering Note**: `notificationModes` can be left empty (`[]`) to completely suppress third-party provider emails. The returned `signingLink` is automatically rewritten to `https://kyc.oneinfo.ai/esign?shortCode=...`.

#### Step 3: Check Signature Status
* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/api/esign/status/:verificationId`

#### Step 4: Download Signed Document
* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/api/esign/download/:verificationId`
* **Stream**: Binary PDF returned with headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="signed_document_<verificationId>.pdf"`

---

### 5.5 Face Liveness & Biometric Detection

Performs AI biometric analysis to prevent spoofing (screen replays, printouts, masks) and verifies real human presence.

* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/face/liveness`
* **Payload**: Accepts either `multipart/form-data` (`image` or `file` field) OR `application/json` with Base64 string (`image`).

#### Request Body (JSON Base64)
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "verificationId": "face_check_501"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "status": "SUCCESS",
    "verificationId": "face_check_501",
    "referenceId": 247512,
    "liveness": true,
    "livenessScore": 0.98,
    "gender": { "value": "FEMALE", "confidence": 98.4 },
    "ageRange": { "min": 25, "max": 34 },
    "eyeWear": { "value": false, "confidence": 96.4 },
    "faceOccluded": { "value": false, "confidence": 98.7 },
    "quality": { "blur": false, "bright": true, "exposure": "NEUTRAL" },
    "pose": { "faceAlignment": "CENTRE", "headTurned": false },
    "eyesOpen": { "value": true, "confidence": 95.5 }
  }
}
```

---

### 5.6 GSTIN Verification

Validates any 15-character Goods and Services Tax Identification Number against the GST Network.

* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/gstin/verify`

#### Request Body
```json
{
  "GSTIN": "29AABCU9603R1ZJ",
  "verificationId": "gst_audit_102"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "gst_audit_102",
    "referenceId": 98124,
    "valid": true,
    "gstin": "29AABCU9603R1ZJ",
    "legalNameOfBusiness": "ONEINFO DIGITAL LABS PVT LTD",
    "tradeName": "ONEINFO",
    "gstinStatus": "Active",
    "constitutionOfBusiness": "Private Limited Company",
    "taxpayerType": "Regular",
    "dateOfRegistration": "2021-06-18",
    "stateJurisdiction": "Ward 10 Bangalore",
    "centerJurisdiction": "Range 3 Division 1",
    "principalPlaceOfBusiness": "100 Outer Ring Road, Bellandur, Bangalore, Karnataka, 560103"
  }
}
```

#### Sandbox Test UTA
- **Valid Active GSTIN**: `29AABCU9603R1ZJ`
- **Invalid GSTIN**: `07AAAAA0000A1Z5`

---

### 5.7 Mobile 360 OTP & Intelligence Flow

Generates and delivers a One-Time Password to a mobile device with timestamp synchronization, and upon verification returns telecom profile intelligence.

#### Step 1: Send OTP
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/mobile360/otp/send`

```json
{
  "mobile_number": "9876543210",
  "notification_modes": ["SMS"],
  "consent": "Y",
  "consent_purpose": "Customer KYC Verification"
}
```

Response gives:
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "mob360_1791016078480_8h4xd",
    "mobileNumber": "9876543210",
    "status": "OTP_GENERATED",
    "referenceId": 151169,
    "notificationModes": ["SMS"]
  }
}
```

#### Step 2: Verify OTP & Retrieve Profile
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/mobile360/otp/verify`

```json
{
  "otp": "123456",
  "verificationId": "mob360_1791016078480_8h4xd"
}
```

Response gives:
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "mob360_1791016078480_8h4xd",
    "referenceId": 151169,
    "status": "SUCCESS",
    "creditScore": 805,
    "personalDetails": {
      "fullName": "JOHN SNOW",
      "gender": "MALE",
      "totalIncome": "1000000",
      "occupation": "Software Engineer",
      "age": "30",
      "dob": "1996-10-02"
    },
    "phoneNumbers": [
      { "type": "MOBILE", "phone": "9876543210", "linkedTo": "PAN" },
      { "type": "MOBILE", "phone": "9988775566", "linkedTo": "UAN" }
    ],
    "emails": [
      { "email": "johnsnow@example.com", "linkedTo": "CREDIT" }
    ],
    "addresses": [
      {
        "address": "123 Main Street, Cityville",
        "type": "Home",
        "state": "StateName",
        "pincode": "123456",
        "linkedTo": "CREDIT"
      }
    ],
    "panDetails": [
      { "panNumber": "ABCPV1234D" }
    ],
    "bankAccountDetails": [
      {
        "bankAccount": "20329012345",
        "ifsc": "SBIN0012345",
        "bankAddress": "STATE BANK OF INDIA",
        "linkedTo": "UAN"
      }
    ],
    "mobileNumberIntelligence": {
      "isValidNumber": true,
      "subscriberStatus": "CONNECTED",
      "connectionType": "PREPAID",
      "currentServiceProvider": "AIRTEL",
      "networkRegion": "India",
      "isPorted": false
    },
    "riskIntelligence": {
      "isSafe": true,
      "riskLevel": "LOW",
      "overallRiskLevel": "LOW"
    }
  }
}
```

> **Interpreting `creditScore: null` (New to Credit / Alternate Data Sources)**:
> - **What it means**: When `creditScore` is `null`, it indicates the applicant has **no existing formal credit bureau history** (CIBIL / Experian) and is **New to Credit (NTC)**.
> - **Not an error**: The verification request is successful (`status: "SUCCESS"`).
> - **Source of Profile Data**: Even with `creditScore: null`, all demographic, employment, and telecom intelligence is populated from alternative verified national sources:
>   - **EPFO / UAN Records** (`linkedTo: "UAN"`): Employment history, organization name, and salary bank accounts.
>   - **Income Tax / PAN Registry** (`linkedTo: "PAN"`): Verified legal name, PAN number, and date of birth.
>   - **Telecom Operator Networks**: Live SIM status, carrier network (Airtel, Jio, Vi), subscriber active status, and fraud risk score.
>   - **Alternate Consumer Footprints** (`linkedTo: "CREDIT"`): Verified contact email addresses and residential/work addresses recorded across digital services.

#### Sandbox Test UTA
- **Test Mobile Number**: `9876543210`
- **Test OTP**: `123456`

---

### 5.8 Telemetry & Analytics Dashboard

Provides real-time visibility into verification volume, success rates, average response latency, and per-service breakdown.

* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/api/analytics/summary`
* **Query Parameters**:
  - `service`: Filter by service (`PAN`, `AADHAAR`, `ESIGN`, `FACE`, `GSTIN`, `MOBILE360`)
  - `days`: Rolling lookback window (default: 7)

```json
{
  "success": true,
  "data": {
    "totalRequests": 1420,
    "successRate": 99.4,
    "avgResponseTimeMs": 248,
    "breakdown": [
      { "service": "PAN", "count": 680, "avgMs": 180 },
      { "service": "FACE", "count": 340, "avgMs": 420 },
      { "service": "AADHAAR", "count": 220, "avgMs": 310 },
      { "service": "ESIGN", "count": 120, "avgMs": 290 },
      { "service": "GSTIN", "count": 60, "avgMs": 210 }
    ]
  }
}
```

---

## 6. Security Guardrails, Rate Limiting & Safety Controls

Located in [src/middleware/guardrails.middleware.js](file:///c:/Users/PC/Desktop/Pan_verification/src/middleware/guardrails.middleware.js), these controls prevent runaway API costs and operational anomalies:

1. **Service Kill Switches**:
   - Independent environment toggles (`ENABLE_PROD_PAN`, `ENABLE_PROD_ESIGN`, etc.) allowing instantaneous shutdown of a specific service without stopping the server.
2. **Daily Production Quota Enforcers**:
   - Hard daily ceiling per service (`PROD_PAN_DAILY_LIMIT`, etc.) resetting at midnight UTC.
3. **Per-Minute Sliding Rate Limiters**:
   - Limits burst calls per client (`PROD_RATE_LIMIT_PER_MINUTE`) with `429 Too Many Requests` responses.

---

## 7. Codebase Architecture & Directory Map

```
Pan_verification/
├── package.json                          # Dependencies & build scripts
├── .env.example                          # Environment template
├── ONEINFO_API_GUIDE.md                  # Client integration reference guide
├── DEVELOPER_DOCUMENTATION.md            # Complete developer & architecture guide
└── src/
    ├── index.js                          # Express application entry & route binder
    ├── config/
    │   └── db.js                         # MongoDB Atlas connection manager
    ├── controllers/
    │   ├── oneinfo.controller.js         # Unified controller orchestrating all services
    │   ├── pan.controller.js             # PAN verification handlers
    │   ├── aadhaar.controller.js         # DigiLocker & Aadhaar handlers
    │   ├── esign.controller.js           # E-Sign handlers & download proxy
    │   ├── face.controller.js            # Face liveness handlers
    │   ├── gstin.controller.js           # GSTIN verification handlers
    │   └── mobile360.controller.js       # Mobile 360 OTP handlers
    ├── middleware/
    │   ├── authenticateClient.js         # Client authentication (x-client-id/secret)
    │   ├── guardrails.middleware.js      # Production quotas, rate limits, kill-switches
    │   ├── upload.js                     # In-memory multer file handlers (PDF & image)
    │   ├── validatePan.js                # PAN regex & payload validation
    │   ├── validateAadhaar.js            # Aadhaar & DigiLocker schema validators
    │   ├── validateEsign.js              # E-Sign signer coordinate & file validators
    │   ├── validateFace.js               # Face image base64/multipart validators
    │   ├── validateGstin.js              # GSTIN 15-character checksum validators
    │   └── validateMobile360.js          # Mobile number & OTP validators
    ├── models/
    │   ├── ApiClient.js                  # Registered tenants & client credentials
    │   └── Analytics.js                  # Operational telemetry & latency events
    ├── routes/
    │   ├── oneinfo.routes.js             # Central unified router (/api/...)
    │   ├── pan.routes.js                 # PAN routes
    │   ├── aadhaar.routes.js             # Aadhaar routes
    │   ├── esign.routes.js               # E-Sign routes
    │   ├── face.routes.js                # Face routes
    │   ├── gstin.routes.js               # GSTIN routes
    │   └── mobile360.routes.js           # Mobile 360 routes
    └── services/
        ├── cashfree.service.js           # Provider integration adapter (pure upstream)
        └── analytics.service.js          # Asynchronous fire-and-forget event recorder
```

---

## 8. Configuration & Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/oneinfo_db

# OneInfo Master Admin & Public Gateway URL
ONEINFO_MASTER_API_KEY=your_secure_master_key
ONEINFO_BASE_URL=https://kyc.oneinfo.ai

# Upstream Sandbox Provider Credentials
CASHFREE_SANDBOX_CLIENT_ID=your_sandbox_app_id
CASHFREE_SANDBOX_CLIENT_SECRET=your_sandbox_secret_key

# Upstream Production Provider Credentials
CASHFREE_PROD_CLIENT_ID=your_prod_app_id
CASHFREE_PROD_CLIENT_SECRET=your_prod_secret_key

# Production Guardrails & Feature Flags
ENABLE_PROD_PAN=true
ENABLE_PROD_AADHAAR=true
ENABLE_PROD_ESIGN=true
ENABLE_PROD_FACE=true
ENABLE_PROD_GSTIN=true
ENABLE_PROD_MOBILE360=true

# Production Quotas & Rate Limits
PROD_PAN_DAILY_LIMIT=100
PROD_AADHAAR_DAILY_LIMIT=50
PROD_ESIGN_DAILY_LIMIT=50
PROD_FACE_DAILY_LIMIT=50
PROD_GSTIN_DAILY_LIMIT=100
PROD_MOBILE360_DAILY_LIMIT=50
PROD_RATE_LIMIT_PER_MINUTE=10
```

---

## 9. Local Development & Verification Testing

### 9.1 Starting the Development Server
```bash
npm install
npm run dev
```
The server will start on `http://127.0.0.1:5000`.

### 9.2 Quick Health Check
```bash
curl http://127.0.0.1:5000/api/health
```
Response:
```json
{"success": true, "message": "OneInfo Verification Gateway is running"}
```

### 9.3 Client Credential Creation Test
```bash
curl -X POST http://127.0.0.1:5000/api/clients/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Local Test App"}'
```

### 9.4 Verification Call Test (PAN)
```bash
curl -X POST http://127.0.0.1:5000/api/pan/verify \
  -H "Content-Type: application/json" \
  -H "x-client-id: <YOUR_CLIENT_ID>" \
  -H "x-client-secret: <YOUR_CLIENT_SECRET>" \
  -H "x-environment: sandbox" \
  -d '{"pan": "ABCPV1234D", "name": "John Doe"}'
```

---

*OneInfo Platform Engineering Team*
