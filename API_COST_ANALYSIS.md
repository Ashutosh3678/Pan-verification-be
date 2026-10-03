# OneInfo API Cost & Upstream Billing Analysis

> **Comprehensive Cost Breakdown & Upstream Billing Architecture**  
> Detailed per-API cost analysis, free vs. billable classification, workflow unit economics, and client pricing recommendations across all 13 verification endpoints.

---

## 1. Executive Summary & Billing Model

Cashfree Payments operates its **Secure ID (Verification Suite)** on a **hybrid consumption model** (per-query / per-successful-verification). While Cashfree provides sandbox testing free of charge, production usage is subject to custom enterprise rate cards based on monthly volume commitments.

### Key Billing Highlights:
* **Sandbox Environment**: **100% FREE** across all endpoints. No charges apply to mock calls or test UTAs.
* **Internal Platform Operations**: **100% FREE** (Client registration, API key generation, and aggregate analytics run entirely on OneInfo infrastructure with zero upstream vendor fees).
* **Non-Billable Upstream Endpoints**: Document staging uploads, signed PDF downloads, and status polling are typically **free of cost** (preventing double-billing).
* **Billable Upstream Events**: Real-time database queries against statutory registries (ITD, UIDAI, GSTN, Telecom) and biometric AI inferences.

---

## 2. Free vs. Billable Classification Matrix

| Category | Endpoint Type | Upstream Cost | Rationale |
| :--- | :--- | :--- | :--- |
| **FREE (Internal)** | Client Registration, Analytics | **₹0.00** | Handled natively by OneInfo MongoDB. No vendor call. |
| **FREE (Sandbox)** | All 13 Endpoints in Sandbox Mode | **₹0.00** | Cashfree does not charge for test environment transactions. |
| **FREE (Staging)** | E-Sign PDF Document Upload | **₹0.00** | Only stages the document buffer; not an executed signature. |
| **FREE (Polling)** | DigiLocker Status, E-Sign Status | **₹0.00** | Polling endpoints are non-billable; charges apply on action/success. |
| **FREE (Delivery)** | E-Sign Signed PDF Download | **₹0.00** | Post-signature binary PDF download is unmetered. |
| **PAID (Query)** | PAN, GSTIN, Direct Aadhaar | **₹1.00 – ₹2.50** | Real-time statutory database query. |
| **PAID (Biometric)**| Face Liveness Detection | **₹1.50 – ₹3.50** | AI neural network inference for anti-spoofing. |
| **PAID (Signature)**| Aadhaar E-Sign Execution | **₹15.00 – ₹25.00**| Covers statutory UIDAI ESP & CA certificate fees (eMudhra/NSDL). |
| **PAID (Data Hub)** | Mobile 360 (OTP + Profile) | **₹8.00 – ₹15.00** | Multi-bureau telecom & credit intelligence aggregation. |

---

## 3. Comprehensive Analysis of All 13 Endpoints

Below is the detailed cost breakdown for each of the 13 verification endpoints:

| # | Endpoint URL | HTTP Method | Billable in Prod? | Upstream Cost per Call (INR) | Billing Trigger / Condition | Sandbox Cost |
| :-: | :--- | :-: | :-: | :-: | :--- | :-: |
| **1** | `/api/clients/register` | `POST` | **NO (FREE)** | **₹0.00** | Pure OneInfo internal database credential generation. | **₹0.00** |
| **2** | `/api/pan/verify` | `POST` | **YES** | **₹1.00 – ₹2.00** | Charged per lookup query against Income Tax Department records. | **₹0.00** |
| **3** | `/api/aadhaar/verify` | `POST` | **YES** | **₹1.50 – ₹2.50** | Charged per direct Aadhaar verification query. | **₹0.00** |
| **4** | `/api/aadhaar/initiate` | `POST` | **NOMINAL / FREE** | **₹0.00 – ₹0.50** | Generates DigiLocker session URL (often free if document is fetched). | **₹0.00** |
| **5** | `/api/aadhaar/status/:id` | `GET` | **NO (FREE)** | **₹0.00** | Polling session state is non-billable. | **₹0.00** |
| **6** | `/api/aadhaar/document/:id` | `GET` | **YES** | **₹3.00 – ₹6.00** | Charged upon successful retrieval and extraction of verified e-Aadhaar profile. | **₹0.00** |
| **7** | `/api/esign/document/upload` | `POST` | **NO (FREE)** | **₹0.00** | Document buffer upload and ID generation is non-billable. | **₹0.00** |
| **8** | `/api/esign/request` | `POST` | **YES** | **₹15.00 – ₹25.00** | Charged per completed Aadhaar signature (includes statutory ESP charges). | **₹0.00** |
| **9** | `/api/esign/status/:id` | `GET` | **NO (FREE)** | **₹0.00** | Polling signature status is non-billable. | **₹0.00** |
| **10** | `/api/esign/download/:id` | `GET` | **NO (FREE)** | **₹0.00** | Streaming and downloading the signed document is non-billable. | **₹0.00** |
| **11** | `/api/face/liveness` | `POST` | **YES** | **₹1.50 – ₹3.50** | Charged per AI anti-spoofing biometric evaluation. | **₹0.00** |
| **12** | `/api/gstin/verify` | `POST` | **YES** | **₹1.00 – ₹2.50** | Charged per GSTIN registry lookup. | **₹0.00** |
| **13** | `/api/mobile360/otp/send` | `POST` | **YES** | **₹0.20 – ₹0.50** | Charged per OTP SMS/WhatsApp dispatch gateway cost. | **₹0.00** |
| *14* | `/api/mobile360/otp/verify` | `POST` | **YES** | **₹8.00 – ₹15.00** | Charged per verified telecom & credit profile intelligence generation. | **₹0.00** |

*(Note: High-volume enterprise commitments reduce unit costs by 20% to 40% below standard rate cards).*

---

## 4. End-to-End Workflow Unit Economics

In practical customer journeys, services are typically invoked as multi-step workflows. Here is the cumulative unit cost to process an applicant from start to finish:

### Workflow A: Complete Individual Digital Onboarding (KYC + Liveness)
1. **PAN Verification** (`/api/pan/verify`): **₹1.50**
2. **Aadhaar DigiLocker Consent Flow** (`/api/aadhaar/initiate` + `/document`): **₹4.50**
3. **Face Liveness Anti-Spoofing** (`/api/face/liveness`): **₹2.50**
* **Total Upstream Cost per Verified Applicant**: **₹8.50**

### Workflow B: Digital Loan / Vendor Contract Execution (E-Sign)
1. **Upload Contract PDF** (`/api/esign/document/upload`): **₹0.00**
2. **Create E-Sign Request** (`/api/esign/request`): **₹18.00**
3. **Check Signature Status** (`/api/esign/status/:id`): **₹0.00**
4. **Download Signed PDF** (`/api/esign/download/:id`): **₹0.00**
* **Total Upstream Cost per Executed Agreement**: **₹18.00**

### Workflow C: Corporate Merchant / Vendor Due Diligence
1. **GSTIN Business Verification** (`/api/gstin/verify`): **₹1.80**
2. **Director PAN Verification** (`/api/pan/verify`): **₹1.50**
* **Total Upstream Cost per Verified Merchant**: **₹3.30**

### Workflow D: Mobile Identity & Credit Pre-Qualification
1. **Send OTP** (`/api/mobile360/otp/send`): **₹0.30**
2. **Verify OTP & Pull Profile** (`/api/mobile360/otp/verify`): **₹10.00**
* **Total Upstream Cost per Qualified Lead**: **₹10.30**

---

## 5. OneInfo Reselling & Monetization Strategy

To build a high-margin SaaS/API business on top of OneInfo, the table below outlines recommended selling price tiers to clients:

| Service / Endpoint | Estimated Upstream Cost (INR) | Recommended Client Price (INR) | OneInfo Gross Margin (%) |
| :--- | :---: | :---: | :---: |
| **Client Registration** | ₹0.00 | **₹0.00** *(Free Onboarding)* | N/A |
| **PAN Verification** | ₹1.50 | **₹3.00 – ₹4.00** | **50% – 62%** |
| **Aadhaar OKYC / DigiLocker** | ₹4.50 | **₹8.00 – ₹10.00** | **44% – 55%** |
| **Aadhaar E-Sign** | ₹18.00 | **₹28.00 – ₹35.00** | **35% – 48%** |
| **Face Liveness Check** | ₹2.50 | **₹5.00 – ₹6.50** | **50% – 61%** |
| **GSTIN Verification** | ₹1.80 | **₹3.50 – ₹5.00** | **48% – 64%** |
| **Mobile 360 Full Flow** | ₹10.30 | **₹18.00 – ₹25.00** | **42% – 58%** |

---

## 6. Built-in Cost Protection & Safety Controls

To ensure production costs remain strictly bounded and predictable, OneInfo includes several protective layers in [src/middleware/guardrails.middleware.js](file:///c:/Users/PC/Desktop/Pan_verification/src/middleware/guardrails.middleware.js):

1. **Service-Level Kill Switches**:
   - `ENABLE_PROD_PAN`, `ENABLE_PROD_ESIGN`, `ENABLE_PROD_FACE`, etc.
   - Allows instant deactivation of costly endpoints without downtime if spending limits are approached.
2. **Daily Production Volume Caps**:
   - `PROD_PAN_DAILY_LIMIT=100`
   - `PROD_ESIGN_DAILY_LIMIT=50`
   - `PROD_FACE_DAILY_LIMIT=50`
   - `PROD_GSTIN_DAILY_LIMIT=100`
   - Automatically rejects traffic with `429 Daily production quota reached` once the daily budget is hit.
3. **Sliding Per-Minute Rate Limits**:
   - `PROD_RATE_LIMIT_PER_MINUTE=10`
   - Throttles burst automated loops to prevent billing spikes.
4. **Zero-PII Storage (Zero Infrastructure Liability)**:
   - Since no identity documents or sensitive payload buffers are stored in databases or S3 buckets, OneInfo incurs **₹0.00 in cloud storage or document archival costs**.

---

*OneInfo FinTech Engineering & Operations Team*
