# OneInfo Verification API — Client Integration Reference

---

## Base URLs & Required Headers

### Base URL
* **Sandbox**: `https://kyc.oneinfo.ai` (Test environment with mock data and test OTPs) - Free 
* **Production**: `https://kyc.oneinfo.ai` (Live environment) - Charge

### Request Headers
Every request must include your client credentials in the HTTP headers:

| Header | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `x-client-id` | string | **Yes** | Your issued OneInfo Client ID |
| `x-client-secret` | string | **Yes** | Your private OneInfo Client Secret |
| `x-environment` | string | **Yes** | `sandbox` for testing, `prod` for live operations |
| `Content-Type` | string | **Yes** | `application/json` (or `multipart/form-data` for file uploads) |

## 1. PAN Verification

Validates an individual or corporate Permanent Account Number (PAN) against the Income Tax registry, returning registered taxpayer name, match score, and Aadhaar linkage status.

### Integration Flow
* **Direct Call (`/pan/verify`)** ➔ Submit PAN ➔ Receive verified taxpayer status and details.

---

### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/pan/verify`

---

### Takes In (Request Body)
```json
{
  "pan": "ABCPV1234D",
  "name": "John Doe",
  "verificationId": "pan_check_101"
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `pan` | string | **Yes** | 10-character alphanumeric PAN (e.g., `ABCPV1234D`) |
| `name` | string | Optional | Name to verify match against official tax records |
| `verificationId` | string | Optional | Custom session reference identifier |

---

### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "pan_check_101",
    "referenceId": 91827364,
    "pan": "ABCPV1234D",
    "type": "Individual",
    "nameProvided": "John Doe",
    "registeredName": "JOHN DOE",
    "namePanCard": "JOHN DOE",
    "fatherName": "ROBERT DOE",
    "valid": true,
    "message": "PAN is valid",
    "nameMatchScore": "1.00",
    "nameMatchResult": "DIRECT_MATCH",
    "panStatus": "VALID",
    "aadhaarSeedingStatus": "Y",
    "aadhaarSeedingStatusDesc": "Aadhaar is linked to PAN",
    "lastUpdatedAt": "2026-10-01"
  }
}
```

---

### Sandbox Test Data

| PAN Number | Type | Applicant Name | Expected Result | Remarks |
| :--- | :--- | :--- | :--- | :--- |
| `ABCPV1234D` | Individual | `John Doe` | `DIRECT_MATCH` (`valid: true`) | Valid individual PAN with linked Aadhaar |
| `XYZPP4321W` | Individual | `Jane Doe` | `DIRECT_MATCH` (`valid: true`) | Valid individual PAN |
| `ABCCD8000T` | Company | `Acme Corp` | `DIRECT_MATCH` (`valid: true`) | Valid corporate PAN |
| `DEFPV0126D` | Individual | — | Invalid (`valid: false`) | Simulates non-existent PAN |

---

## 2. Aadhaar Account Verification (Direct Check)

Rapidly checks if an Aadhaar number or phone number already has an active DigiLocker account before initiating a full KYC consent flow.

### Integration Flow
* **Direct Call (`/aadhaar/verify`)** ➔ Submit Aadhaar or Mobile ➔ Check `data.accountExists` boolean to decide whether to prompt user for sign-up or sign-in.

---

### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/aadhaar/verify`

---

### Takes In (Request Body)
```json
{
  "aadhaarNumber": "655675523712",
  "verificationId": "aadhaar_check_102"
}
```
`Pass Aadhaar Number or Mobile number`

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `aadhaarNumber` | string | optional* | 12-digit Aadhaar number |
| `mobileNumber` | string | Optional* | 10-digit mobile number linked to Aadhaar |
| `verificationId` | string | Optional | Custom session reference identifier |

*\*Provide at least one of `aadhaarNumber` or `mobileNumber`.*

---

### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "aadhaar_check_102",
    "referenceId": 54321,
    "status": "ACCOUNT_EXISTS",
    "accountExists": true,
    "message": "DigiLocker account exists for the provided details."
  }
}
```

---

### Sandbox Test Data

| Field | Test Value | Expected Result | Remarks |
| :--- | :--- | :--- | :--- |
| `aadhaarNumber` | `655675523712` | `ACCOUNT_NOT_FOUND` (`accountExists: true`) | Active registered citizen account |
| `aadhaarNumber` | `655675523710` | `ACCOUNT_NOT_FOUND` (`accountExists: false`) | Unregistered citizen account |
| `mobileNumber` | `9988112233` (any `9988xxxxxx`) | `ACCOUNT_EXISTS` (`accountExists: true`) | Registered citizen phone |

---

## 3. Aadhaar DigiLocker Verification (3-Step KYC Flow)

Full citizen KYC journey via DigiLocker consent, retrieving verified identity details, split address, and photograph.

### Integration Flow
* **Step 1 (`/aadhaar/initiate`)** ➔ From response, take **`data.url`** (redirect user to complete OTP consent) and **`data.verificationId`** (pass to Step 2 & 3).
* **Step 2 (`/aadhaar/status/:verificationId`)** ➔ Pass **`verificationId`**. When response returns **`data.status = "AUTHENTICATED"`**, proceed to Step 3.
* **Step 3 (`/aadhaar/document/:verificationId`)** ➔ Pass **`verificationId`** to retrieve complete verified Aadhaar KYC details and photo.

---

### Step 1: Initiate DigiLocker Session

Generates a secure verification link where the user authenticates via Aadhaar OTP.

#### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/aadhaar/initiate`

#### Takes In (Request Body)
```json
{
  "redirectUrl": "https://yourapp.com/kyc/callback",
  "userFlow": "signup",
  "documentRequested": ["AADHAAR"],
  "verificationId": "aadhaar_session_201"
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `redirectUrl` | string | **Yes** | Web URL where user will return after submitting OTP |
| `userFlow` | string | Optional | `signup` or `signin` (default: `signup`) |
| `documentRequested` | array | Optional | Documents requested (default: `["AADHAAR"]`) |
| `verificationId` | string | Optional | Unique reference ID to track this session |

#### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "aadhaar_session_201",
    "referenceId": 981274,
    "status": "PENDING",
    "url": "https://kyc.oneinfo.ai/dgl?shortCode=t59hasdku7l0&env=sandbox",
    "userFlow": "signup",
    "documentRequested": ["AADHAAR"],
    "redirectUrl": "https://yourapp.com/kyc/callback"
  }
}
```
* **Take from this response**:
  * `data.url`: Redirect your user's browser to this link to complete Aadhaar OTP.
  * `data.verificationId`: Use this ID in Step 2 and Step 3.

---

### Step 2: Check Session Status

Checks if the user has completed OTP verification on the portal.

#### Endpoint
* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/aadhaar/status/:verificationId`

#### Takes In
* **Path Parameter**: `verificationId` (obtained from Step 1)

#### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "aadhaar_session_201",
    "referenceId": 981274,
    "status": "AUTHENTICATED",
    "documentRequested": ["AADHAAR"],
    "message": "User has successfully authenticated via DigiLocker"
  }
}
```
* **Take from this response**:
  * When `data.status === "AUTHENTICATED"`, proceed to Step 3.

---

### Step 3: Fetch Verified Aadhaar Document

Retrieves complete verified demographic identity, split address components, and base64 photograph.

#### Endpoint
* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/aadhaar/document/:verificationId`

#### Takes In
* **Path Parameter**: `verificationId` (obtained from Step 1)

#### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "aadhaar_session_201",
    "referenceId": 981274,
    "status": "VALID",
    "documentType": "AADHAAR",
    "name": "Jane Doe",
    "dob": "1992-05-15",
    "gender": "F",
    "maskedAadhaar": "XXXXXXXX8848",
    "careOf": "D/O Robert Doe",
    "address": "Flat 404, Green Towers, MG Road, Bangalore 560001",
    "splitAddress": {
      "houseNumber": "Flat 404",
      "building": "Green Towers",
      "street": "MG Road",
      "landmark": "Near City Metro",
      "locality": "Shivaji Nagar",
      "district": "Bangalore",
      "state": "Karnataka",
      "pincode": "560001"
    },
    "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
  }
}
```

---

### Sandbox Test Data for DigiLocker

| Step | Parameter | Test Value | Description |
| :--- | :--- | :--- | :--- |
| Portal Login | Mobile Number | `9988112233` (any `9988xxxxxx`) | Simulates registered citizen account |
| Consent Verification | Universal Sandbox OTP | **`111000`** | Universal OTP for all simulated consent screens |
| Verification ID | `verificationId` | Any unique alphanumeric string | Identifies your session |

---

## 4. Aadhaar E-Sign (Electronic Signature Flow)

Enables legally binding electronic signatures on PDF agreements using Aadhaar OTP verification.

### Integration Flow
* **Step 1 (`/esign/document/upload`)** ➔ Upload PDF agreement ➔ From response, take **`data.documentId`** (pass to Step 2).
* **Step 2 (`/esign/request`)** ➔ Pass **`documentId`** & signer details ➔ From response, take **`data.signingLink`** (send to signer) and **`data.verificationId`** (pass to Step 3 & 4).
* **Step 3 (`/esign/status/:verificationId`)** ➔ Pass **`verificationId`**. When response returns **`data.status = "SIGNED"`**, proceed to Step 4.
* **Step 4 (`/esign/download/:verificationId`)** ➔ Pass **`verificationId`** to stream and save the final signed PDF.

---

### Step 1: Upload Document for E-Sign

Uploads the PDF agreement and generates a numeric `documentId`.

#### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/esign/document/upload`
* **Headers**: `Content-Type: multipart/form-data`

#### Takes In (Form Data)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `document` | Binary File | **Yes** | PDF agreement file (max 10MB) |

#### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "documentId": 70690,
    "filename": "partnership_agreement.pdf",
    "pages": 3,
    "sizeBytes": 204850,
    "message": "Document uploaded successfully."
  }
}
```
* **Take from this response**:
  * `data.documentId`: Pass this integer into Step 2.

---

### Step 2: Create E-Sign Request

Sets up signer details, defined signature stamp positions, and generates a white-labeled signing link.

#### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/esign/request`

#### Takes In (Request Body)
```json
{
  "verificationId": "contract_emp_1001",
  "documentId": 70690,
  "authType": "AADHAAR",
  "expiryInDays": "3",
  "captureLocation": false,
  "redirectUrl": "https://yourapp.com/signed/callback",
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

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `verificationId` | string | **Yes** | Your unique reference identifier for this contract |
| `documentId` | integer | **Yes** | Document ID received from Step 1 |
| `authType` | string | Optional | `AADHAAR` (default) |
| `expiryInDays` | string | Optional | Validity period of the signing link (default: `"3"`) |
| `captureLocation` | boolean | Optional | Captures GPS coordinates during signing (default: `false`) |
| `redirectUrl` | string | Optional | URL where signer returns after completing signature |
| `signers` | array | **Yes** | Array of signer objects (contains name, phone, stamp coordinates) |

#### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "contract_emp_1001",
    "referenceId": 48115,
    "documentId": 70690,
    "status": "SUCCESS",
    "signingLink": "https://kyc.oneinfo.ai/esign?shortCode=z59gcmhle3e0&captureLocation=false",
    "expiryInDays": "3",
    "authType": "AADHAAR",
    "signersCount": 1,
    "message": "E-sign request created successfully"
  }
}
```
* **Take from this response**:
  * `data.signingLink`: Deliver this link to the signer to complete their electronic signature.
  * `data.verificationId`: Use this ID in Step 3 and Step 4.

---

### Step 3: Check E-Sign Status

Queries completion status across all signers.

#### Endpoint
* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/esign/status/:verificationId`

#### Takes In
* **Path Parameter**: `verificationId` (e.g., `contract_emp_1001`)

#### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "contract_emp_1001",
    "referenceId": 48115,
    "status": "SIGNED",
    "documentId": 70690,
    "signers": [
      {
        "name": "Ajay Sharma",
        "phone": "9876543210",
        "status": "SIGNED",
        "signedAt": "2026-10-03T11:45:10Z"
      }
    ],
    "downloadUrl": "https://kyc.oneinfo.ai/esign/download/contract_emp_1001"
  }
}
```
* **Take from this response**:
  * When `data.status === "SIGNED"`, proceed to Step 4 to download the executed PDF.

---

### Step 4: Download Signed Document

Downloads the finalized legally binding PDF containing statutory audit stamps.

#### Endpoint
* **Method**: `GET`
* **URL**: `https://kyc.oneinfo.ai/esign/download/:verificationId`

#### Takes In
* **Path Parameter**: `verificationId`

#### Gives Out
* **Content-Type**: `application/pdf` (binary PDF download stream).

---

### Sandbox Test Notes for E-Sign

| Step | Test Action | Expected Result |
| :--- | :--- | :--- |
| Step 1 (Upload) | Upload any standard PDF up to 10MB | Generates valid `documentId` |
| Step 2 (Create) | Pass valid `documentId` with signer array | Generates active `signingLink` |
| Step 3 (Sign) | Open link in browser and submit OTP **`111000`** | Signature confirmed |
| Step 4 (Status) | Query status for `verificationId` | Returns `status: "SIGNED"` |

---

## 5. Face Liveness & Anti-Spoofing Verification

Analyses a photograph or selfie to determine genuine human presence in real time, detecting spoof attacks (masks, paper prints, digital screen replays) while extracting facial attributes.

### Integration Flow
* **Direct Call (`/face/liveness`)** ➔ Submit image (file or Base64) ➔ Receive `data.liveness` boolean, anti-spoofing signals, and facial quality analysis.

---

### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/face/liveness`

---

### Takes In: Option A (Multipart File Upload)
* **Headers**: `Content-Type: multipart/form-data`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `image` | Binary File | **Yes** | Image file (JPEG or PNG, max 5MB) |
| `verification_id` | string | Optional | Custom session reference identifier |

---

### Takes In: Option B (JSON with Base64 String)
* **Headers**: `Content-Type: application/json`

```json
{
  "verification_id": "face_check_301",
  "image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `image` | string | **Yes** | Base64-encoded image string |
| `verification_id` | string | Optional | Custom session reference identifier |

---

### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "face_check_301",
    "referenceId": 381920,
    "status": "SUCCESS",
    "liveness": true,
    "livenessScore": 0.98,
    "faceDetected": true,
    "faceQuality": "GOOD",
    "eyesOpen": true,
    "mouthClosed": true,
    "estimatedAge": "25-32",
    "estimatedGender": "MALE",
    "antiSpoofingSignals": {
      "screenReplayDetected": false,
      "printedPhotoDetected": false,
      "maskDetected": false
    },
    "message": "Genuine human face verified successfully."
  }
}
```

---

### Sandbox Test Data for Face Liveness

| `verification_id` Prefix | Expected `status` | `liveness` | Description |
| :--- | :--- | :--- | :--- |
| Standard ID (e.g., `face_101`) | `SUCCESS` | `true` | Real human face confirmed (`livenessScore: >0.90`) |
| Prefix `4444...` (e.g., `444498765`) | `REAL_FACE_NOT_DETECTED` | `false` | Simulates digital screen or print photo spoof attempt |
| Prefix `2222...` (e.g., `222212345`) | `MULTIPLE_FACES_DETECTED` | `false` | Simulates multiple people detected in frame |
| Prefix `3333...` (e.g., `333354321`) | `FACE_NOT_DETECTED` | `false` | Simulates blank photo or face not visible |

---

## 6. GSTIN Business Verification

Validates a 15-character Goods and Services Tax Identification Number (GSTIN) directly against the GST Network (GSTN), returning active business registration status, jurisdiction, registration date, taxpayer category, and split addresses.

### Integration Flow
* **Direct Call (`/gstin/verify`)** ➔ Submit 15-character GSTIN ➔ Receive registered business profile, jurisdiction, and split addresses.

---

### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/gstin/verify`

---

### Takes In (Request Body)
```json
{
  "gstin": "29AAICP2912R1ZR",
  "businessName": "UJJIVAN SMALL FINANCE BANK",
  "verificationId": "vendor_check_401"
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `gstin` | string | **Yes** | 15-character alphanumeric GSTIN |
| `businessName` | string | Optional | Business trade or legal name to verify match |
| `verificationId` | string | Optional | Custom session reference identifier |

---

### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "vendor_check_401",
    "referenceId": 298220,
    "gstin": "29AAICP2912R1ZR",
    "legalNameOfBusiness": "UJJIVAN SMALL FINANCE BANK LIMITED",
    "tradeNameOfBusiness": "UJJIVAN SMALL FINANCE BANK",
    "centerJurisdiction": "I-A RANGE",
    "stateJurisdiction": "GUWAHATI - A - 1",
    "dateOfRegistration": "2017-09-30",
    "constitutionOfBusiness": "Public Limited Company",
    "taxpayerType": "Regular",
    "gstInStatus": "Active",
    "lastUpdateDate": "2022-03-01",
    "natureOfBusinessActivities": [
      "Retail Business",
      "Supplier of Services",
      "Recipient of Goods or Services"
    ],
    "principalPlaceAddress": "First Floor 3512-DISPUR Prithivi Mansion opp. KFC building G.S. Road, Lachit Nagar Assam 781007",
    "principalPlaceSplitAddress": {
      "buildingName": "Prithivi Mansion",
      "street": "G.S. Road",
      "location": "Lachit Nagar",
      "buildingNumber": "3512-DISPUR",
      "district": "Guwahati",
      "state": "Assam",
      "city": "Dispur",
      "flatNumber": "First Floor",
      "pincode": "781007"
    },
    "valid": true,
    "message": "GSTIN Exists"
  }
}
```

---

### Sandbox Test Data for GSTIN

| GSTIN | Business Name | Expected Result | Remarks |
| :--- | :--- | :--- | :--- |
| `29AAICP2912R1ZR` | `UJJIVAN SMALL FINANCE BANK` | Valid (`valid: true`) | Active registered corporate entity with split address |
| `22ABCDE1234F1Z5` | — | Non-Existent (`valid: false`) | Simulates unregistered GSTIN |

---

## 7. Account Aggregator & Credit Score (CIBIL) Verification

Dispatches an OTP to an applicant's mobile number via SMS or WhatsApp, captures user consent, and validates the OTP to retrieve verified personal intelligence including **Credit Score (CIBIL)**, employment history, linked accounts, addresses, and risk signals via Account Aggregator intelligence.

### Integration Flow
* **Step 1 (`/account-aggregator/otp/send`)** ➔ Submit applicant mobile number ➔ User receives OTP. From response, take **`data.verificationId`** (pass to Step 2).
* **Step 2 (`/account-aggregator/otp/verify`)** ➔ Pass **`verificationId`** and the **`otp`** entered by user ➔ Retrieve verified **Credit Score (CIBIL)**, personal demographics, employment details, and linked accounts.

---

### Step 1: Send OTP Request

Dispatches an OTP to a 10-digit mobile number with regulatory consent.

#### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/account-aggregator/otp/send` *(or `https://kyc.oneinfo.ai/api/account-aggregator/otp/send`)*

#### Takes In (Request Body)
```json
{
  "mobileNumber": "9999999999",
  "name": "John Doe",
  "verificationId": "ABC00122",
  "notificationModes": ["SMS"]
}
```

*(Note: Regulatory consent timestamp is handled automatically by the gateway in real-time UTC so you never encounter clock drift or expiry errors.)*

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `mobileNumber` | string | **Yes** | 10-digit mobile number of the applicant |
| `name` | string | Optional | Full legal name of the applicant |
| `verificationId` | string | Optional | Custom reference ID (max 50 chars, alphanumeric, `.`, `-`, `_`) |
| `notificationModes` | array | Optional | `["SMS"]`, `["WHATSAPP"]`, or both (default: `["SMS"]`) |
| `userConsent` | object | Optional | Custom consent object (default valid consent applied automatically if omitted) |

#### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "ABC00122",
    "mobileNumber": "9999999999",
    "status": "OTP_GENERATED",
    "referenceId": 151152,
    "name": "John Doe",
    "notificationModes": [
      "SMS"
    ]
  }
}
```
* **Take from this response**:
  * `data.verificationId`: Pass this ID into Step 2 along with the OTP entered by the user.

---

### Step 2: Verify OTP (Retrieve CIBIL Score & Profile)

Validates the OTP entered by the user and returns the full intelligence profile including **credit score (CIBIL)**.

#### Endpoint
* **Method**: `POST`
* **URL**: `https://kyc.oneinfo.ai/api/oneinfo/account-aggregator/otp/verify` *(or `https://kyc.oneinfo.ai/api/account-aggregator/otp/verify`)*

#### Takes In (Request Body)
```json
{
  "verificationId": "ABC00122",
  "otp": "123456"
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `verificationId` | string | **Yes** | The verification ID received from Step 1 |
| `otp` | string | **Yes** | 4 to 6 digit OTP received by the user |

#### Gives Out (Response 200 OK)
```json
{
  "success": true,
  "environment": "sandbox",
  "data": {
    "verificationId": "ABC00122",
    "referenceId": 151160,
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
      { "type": "HOME", "phone": "9999996655", "linkedTo": "CREDIT" },
      { "type": "MOBILE", "phone": "99XXXXXX99", "linkedTo": "PAN" },
      { "type": "MOBILE", "phone": "9988775566", "linkedTo": "UAN" }
    ],
    "emails": [
      { "email": "johnsnow@example.com", "linkedTo": "CREDIT" },
      { "email": "a*c@gmail.com", "linkedTo": "PAN" }
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
        "bankAddress": "STATE BANK OF INDIA, KATANGA BENGALURU",
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

#### Understanding `creditScore: null` (New to Credit / Alternate Data Sources)

> **Important Note on `creditScore: null`**:
> * **What it means**: If `creditScore` is returned as `null`, it signifies that the user has **no existing formal credit bureau footprint** (e.g. no prior bank loans, credit cards, or credit inquiries in CIBIL/Experian) — commonly referred to as **New to Credit (NTC)**.
> * **It is NOT an error**: The verification request is completely successful (`status: "SUCCESS"`).
> * **Where the profile data comes from**: Even when `creditScore` is `null`, the comprehensive user intelligence profile is still retrieved and cross-verified from alternative verified national registries:
>   * **EPFO / UAN Records** (`linkedTo: "UAN"`): Employment history, employer organization, and active PF salary bank accounts.
>   * **Income Tax Department / PAN Registry** (`linkedTo: "PAN"`): Legally verified taxpayer name, PAN number, and date of birth.
>   * **Live Telecom Operator Networks**: Real-time SIM status (active/inactive), service provider (Airtel, Jio, Vi), subscriber category (prepaid/postpaid), and SIM-swap risk rating.
>   * **Alternative Consumer Footprints** (`linkedTo: "CREDIT"`): Verified contact email addresses and residential/work addresses recorded across digital services.

---

### Sandbox Test Data for Account Aggregator

| Parameter / Field | Sandbox Test Value | Expected Outcome | Remarks |
| :--- | :--- | :--- | :--- |
| `mobileNumber` | `9999999999` | `OTP_GENERATED` | Valid test mobile number |
| `verificationId` | `ABC00122` (or prefix `ABC...`) | Accepted session ID | Unique alphanumeric string |
| `otp` | **`123456`** | `SUCCESS` (`creditScore: 805` or `null`) | Universal Sandbox OTP. Note: When user is New to Credit (NTC), `creditScore` returns `null` while alternative data points remain populated. |
| `mobileNumber` | `8888888888` | `DETAILS_NOT_FOUND` | Simulates unregistered mobile number |

---

## 8. Standard Error Format

When an error occurs, OneInfo returns a standardized, sanitized JSON object:

```json
{
  "success": false,
  "environment": "sandbox",
  "message": "Clear high-level error summary",
  "error": "Detailed reason description"
}
```

### HTTP Status Codes

| HTTP Status | Error Name | Common Cause | Resolution |
| :--- | :--- | :--- | :--- |
| **`200 OK`** | Success | Request succeeded. | Parse the `data` object in response. |
| **`400 Bad Request`** | Validation Error | Missing required field, invalid PAN/GSTIN format, or invalid file type. | Check required parameters and formats. |
| **`401 Unauthorized`** | Authentication Failed | Missing or invalid `x-client-id` or `x-client-secret`. | Check your client credentials. |
| **`403 Forbidden`** | Access Denied | The requested service is disabled by policy. | Contact support to enable access. |
| **`404 Not Found`** | Not Found | Session `verificationId` not found or expired. | Start a fresh verification session. |
| **`429 Too Many Requests`** | Rate Limit | Exceeded requests per minute or daily quota limit. | Implement retry backoff. |
| **`500 Internal Error`** | Provider Error | Temporary upstream downtime. | Retry after a brief interval. |
