# Personal Betting Tracker System
## Complete Specification Document

---

## 1. PROJECT OVERVIEW

### 1.1 Problem Statement

Users place bets through bookmaker mobile apps that don't provide API access or comprehensive bet history. The only way to capture bet information is through screenshots. Users need a systematic way to:

- Track all their bets in one place
- Monitor which events are upcoming, live, or finished
- Share this tracking capability with a betting partner
- Maintain historical records for analysis

### 1.2 Solution Overview

A web-based application that uses AI vision to extract structured data from betting slip screenshots and presents it in an organized, editable dashboard. The system prioritizes simplicity, cost-efficiency, and ease of maintenance while providing professional functionality for 2 users.

### 1.3 Success Criteria

- Extract betting data with >90% accuracy from screenshots
- Process and display data within 5 seconds of upload
- Zero data loss (persistent storage)
- Accessible from any device with browser
- Costs <$5/month to operate
- Requires <1 hour/month maintenance

---


## 2. USER JOURNEY & FLOW

### 2.1 Initial Setup (One-time)

**Developer deploys:**

1. Frontend to Vercel (5 minutes)
2. Backend to personal server (15 minutes)
3. Configure DNS and SSL (10 minutes)
4. Share URL + password with partner

**Users access:**

1. Navigate to URL
2. Enter shared password
3. Password stored in browser session (stays logged in)

### 2.2 Primary Use Case: Adding a Bet

**Step-by-step flow:**

| # | USER ACTION | SYSTEM RESPONSE | DATA FLOW |
|---|-------------|-----------------|-----------|
| 1 | Place bet in bookie app | [User's device] | |
| 2 | Screenshot the bet slip | Screenshot saved to camera roll | |
| 3 | Open tracker app in browser | Dashboard loads, shows:<br>- Existing bets<br>- Upload button prominent | `GET /api/bets`<br>← Returns all bets from DB |
| 4 | Click "Add Bet" or drag screenshot | Upload area activates<br>Shows preview of image(s) | |
| 5 | Image(s) selected | Frontend displays:<br>- Image preview thumbnails<br>- "Processing..." indicator<br>- Cancel option | |
| 6 | Click "Upload & Extract" | Image sent to backend | `POST /api/upload`<br>→ Image as multipart/form-data |
| 7 | [Backend processing] | Backend receives image<br>→ Calls Claude API with prompt<br>→ Claude analyzes screenshot<br>→ Returns structured JSON<br>→ Deletes image from memory<br>→ Saves to database<br>→ Returns extracted data | → Claude Vision API<br><br>`INSERT INTO bets` |
| 8 | Frontend receives response | Frontend shows:<br>- Success notification<br>- New bet card in dashboard<br>- Pre-populated fields<br>- Edit mode active | |
| 9 | User reviews extracted data | User can:<br>- Confirm (saves as-is)<br>- Edit any field<br>- Delete if wrong | `PATCH /api/bets/:id`<br>→ Updates DB |
| 10 | Data confirmed | Bet appears in dashboard<br>Categorized by status:<br>- "Upcoming" (match not started)<br>- "Live" (match in progress)<br>- "Finished" (awaiting result) | |

**Example Claude API Response:**
```json
{
  "teams": "Aston Villa vs Real Madrid",
  "bet_type": "Draw",
  "odds": 3.50,
  "stake": 50.00,
  "currency": "EUR",
  "match_time": "2026-02-08T20:00:00Z",
  "confidence": "high"
}
```
### 2.3 Secondary Use Cases

#### A. Batch Upload (Multiple Bets)

User has 5 screenshots from same betting session:

1. Selects all 5 images at once
2. System processes sequentially
3. Shows progress: "Processing 3 of 5..."
4. All extracted bets shown in review mode
5. User corrects any mistakes
6. Confirms all at once

#### B. Editing Existing Bet

User notices wrong odds were extracted:

1. Clicks on bet card
2. Enters edit mode (all fields become editable)
3. Changes odds from 3.50 to 3.75
4. Clicks "Save"
5. Updates in database immediately
6. Dashboard refreshes

#### C. Daily Dashboard Check

User opens app in morning:

1. Dashboard auto-categorizes bets:
   - 3 upcoming (next 24 hours highlighted)
   - 2 live (currently playing)
   - 5 finished (awaiting settlement)
2. User checks finished matches
3. Manually marks as won/lost/push
4. System calculates P&L

#### D. Searching History

User wants to find all Real Madrid bets:

1. Uses search bar: "Real Madrid"
2. Filters results
3. Exports to CSV for analysis

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         USER DEVICES                        │
│                    (Mobile + Desktop Browser)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Upload UI  │  │  Dashboard   │  │ Auth Guard   │     │
│  │  - Drag/drop │  │  - Bet cards │  │  - Password  │     │
│  │  - Preview   │  │  - Filters   │  │  - Session   │     │
│  │  - Batch     │  │  - Status    │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  Static files: HTML, CSS, JS (React/Vue)                   │
│  State: In-memory (no local storage for bets)              │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (JSON)
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (Your Server)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Endpoints                          │   │
│  │  POST   /api/upload      - Upload & extract         │   │
│  │  GET    /api/bets        - List all bets            │   │
│  │  GET    /api/bets/:id    - Get single bet           │   │
│  │  PATCH  /api/bets/:id    - Update bet               │   │
│  │  DELETE /api/bets/:id    - Delete bet               │   │
│  │  POST   /api/auth        - Password verification    │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│  ┌────────────────────────┼─────────────────────────────┐  │
│  │    Business Logic      │     Image Processing        │  │
│  │  - Validation          │  - Receive multipart        │  │
│  │  - Status calculation  │  - Temp buffer in memory    │  │
│  │  - Time parsing        │  - Send to Claude API       │  │
│  │  - Currency handling   │  - Parse response           │  │
│  │                        │  - Delete from memory       │  │
│  └────────────────────────┴─────────────────────────────┘  │
│                           │                                 │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Database Layer (SQLite/PostgreSQL)        │   │
│  │  - Bets table                                       │   │
│  │  - Users table (minimal, just 2 users)             │   │
│  │  - Audit log (optional)                             │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ API Call (HTTPS)
                         ↓
              ┌──────────────────────────┐
              │   Anthropic Claude API   │
              │   (Haiku 4.5 - Vision)   │
              └──────────────────────────┘
```
### 3.2 Data Flow: Upload to Display

```
[1] USER UPLOADS IMAGE
    ↓
[2] Frontend validation
    - File type check (jpg, png, heic)
    - Size check (< 10MB)
    - Generate preview
    ↓
[3] POST to /api/upload
    Headers: { Authorization: "Bearer <session_token>" }
    Body: multipart/form-data with image
    ↓
[4] Backend receives request
    - Verify auth token
    - Receive image buffer
    - Validate image format
    ↓
[5] Call Claude Vision API
    Request:
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", data: "..." } },
          { type: "text", text: EXTRACTION_PROMPT }
        ]
      }]
    }
    ↓
[6] Claude processes image
    - OCR + semantic understanding
    - Returns structured JSON
    ↓
[7] Backend receives Claude response
    - Parse JSON from response
    - Validate extracted fields
    - Generate bet_id (UUID)
    - Add metadata (created_at, uploaded_by)
    - DELETE image from memory (critical)
    ↓
[8] Save to database
    INSERT INTO bets (
      id, teams, bet_type, odds, stake, currency,
      match_time, created_at, uploaded_by, status
    ) VALUES (...)
    ↓
[9] Return to frontend
    Response: {
      success: true,
      bet: { id, teams, bet_type, ... },
      confidence: "high"
    }
    ↓
[10] Frontend updates UI
     - Close upload modal
     - Show success message
     - Add bet to dashboard (edit mode enabled)
     - User can review/correct before final save
```

---

## 4. DATABASE DESIGN

### 4.1 Schema

```sql
-- Users table (minimal, just for tracking who uploaded)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core bets table
CREATE TABLE bets (
  id VARCHAR(36) PRIMARY KEY,           -- UUID

  -- Extracted data
  teams VARCHAR(200) NOT NULL,          -- "Aston Villa vs Real Madrid"
  bet_type VARCHAR(100) NOT NULL,       -- "Draw", "Over 2.5", "BTTS", etc.
  odds DECIMAL(10,2) NOT NULL,          -- 3.50
  stake DECIMAL(10,2) NOT NULL,         -- 50.00
  currency VARCHAR(3) DEFAULT 'EUR',    -- EUR, USD, GBP

  -- Time information
  match_time TIMESTAMP NOT NULL,        -- When match starts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Metadata
  uploaded_by INTEGER,                  -- FK to users.id
  status VARCHAR(20) DEFAULT 'upcoming', -- upcoming/live/finished/settled
  confidence VARCHAR(10),               -- high/medium/low (from extraction)

  -- Manual tracking (optional)
  result VARCHAR(20),                   -- won/lost/push/void
  actual_return DECIMAL(10,2),          -- Payout if won
  notes TEXT,                           -- User notes

  -- Tracking
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_match_time ON bets(match_time);
CREATE INDEX idx_status ON bets(status);
CREATE INDEX idx_uploaded_by ON bets(uploaded_by);
CREATE INDEX idx_created_at ON bets(created_at DESC);

-- Audit log (optional, good practice)
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bet_id VARCHAR(36),
  action VARCHAR(50),                   -- created/updated/deleted
  changed_by INTEGER,
  changes JSON,                         -- Old vs new values
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (bet_id) REFERENCES bets(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);
```
### 4.2 Sample Data

```sql
INSERT INTO bets VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Aston Villa vs Real Madrid',
  'Draw',
  3.50,
  50.00,
  'EUR',
  '2026-02-08 20:00:00',
  '2026-02-05 14:30:00',
  1,
  'upcoming',
  'high',
  NULL,
  NULL,
  'Confident in defensive tactics',
  '2026-02-05 14:30:00'
);
```

---

## 5. API SPECIFICATION

### 5.1 Authentication

**Endpoint:** `POST /api/auth`

**Request:**
```json
{
  "password": "shared_secret_password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "token": "jwt_token_here_or_session_id",
  "expires_in": 604800
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Invalid password"
}
```

**Implementation Notes:**
- Password hashed with bcrypt (stored in environment variable)
- Token = JWT with 7-day expiration OR simple session ID
- Token stored in localStorage on frontend
- All subsequent requests include: `Authorization: Bearer <token>`

---

### 5.2 Upload & Extract

**Endpoint:** `POST /api/upload`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
```
FormData {
  image: [File object],
  uploaded_by: "user1" (optional, can infer from token)
}
```

**Response (Success):**
```json
{
  "success": true,
  "bet": {
    "id": "uuid-here",
    "teams": "Aston Villa vs Real Madrid",
    "bet_type": "Draw",
    "odds": 3.50,
    "stake": 50.00,
    "currency": "EUR",
    "match_time": "2026-02-08T20:00:00Z",
    "status": "upcoming",
    "confidence": "high",
    "created_at": "2026-02-05T14:30:00Z"
  },
  "raw_extraction": {
    /* Optional: full Claude response for debugging */
  }
}
```

**Response (Extraction Failed):**
```json
{
  "success": false,
  "error": "Could not extract betting data from image",
  "details": "No odds found in screenshot",
  "suggestion": "Please ensure the bet slip is clearly visible"
}
```

**Error Codes:**
- `400`: Invalid image format
- `401`: Unauthorized (bad token)
- `413`: File too large (> 10MB)
- `422`: Extraction failed (Claude couldn't parse)
- `500`: Server error

**Backend Processing:**
1. Validate token
2. Validate image (format, size)
3. Convert image to base64
4. Call Claude API with extraction prompt
5. Parse Claude's JSON response
6. Validate extracted fields (all required fields present?)
7. Generate UUID
8. Insert into database
9. Delete image from memory
10. Return structured response

---

### 5.3 List Bets

**Endpoint:** `GET /api/bets`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
```
?status=upcoming          // Filter by status
&from=2026-02-01          // Match time after date
&to=2026-02-28            // Match time before date
&search=Real Madrid       // Search in teams field
&limit=50                 // Pagination
&offset=0                 // Pagination
&sort=match_time          // Sort field
&order=asc                // asc or desc
```

**Response:**
```json
{
  "success": true,
  "bets": [
    {
      "id": "uuid-1",
      "teams": "Aston Villa vs Real Madrid",
      "bet_type": "Draw",
      "odds": 3.50,
      "stake": 50.00,
      "currency": "EUR",
      "match_time": "2026-02-08T20:00:00Z",
      "status": "upcoming",
      "result": null,
      "notes": "",
      "created_at": "2026-02-05T14:30:00Z",
      "uploaded_by": "user1"
    }
    // ... more bets
  ],
  "total": 127,
  "page": 1,
  "pages": 3
}
```

---

5.4 Get Single Bet
Endpoint: GET /api/bets/:id
Response:
json{
  "success": true,
  "bet": {
    /* Full bet object with all fields */
  }
}

5.5 Update Bet
Endpoint: PATCH /api/bets/:id
Request:
json{
  "odds": 3.75,              // Updated field
  "notes": "Changed odds",   // Updated field
  "status": "finished"       // Updated field
}
Response:
json{
  "success": true,
  "bet": {
    /* Updated bet object */
  },
  "changes": {
    "odds": { "old": 3.50, "new": 3.75 },
    "notes": { "old": "", "new": "Changed odds" }
  }
}
Validation Rules:

odds must be > 1.0
stake must be > 0
match_time must be valid ISO timestamp
status must be one of: upcoming/live/finished/settled
result must be one of: won/lost/push/void or null

Audit Trail:

Every update logged to audit_log table
Stores old vs new values
Timestamp and user who made change


5.6 Delete Bet
Endpoint: DELETE /api/bets/:id
Response:
json{
  "success": true,
  "message": "Bet deleted successfully"
}
```

**Implementation:**
- Soft delete (add `deleted_at` timestamp) OR
- Hard delete with audit log entry

---

## 6. FRONTEND DESIGN

### 6.1 Page Structure
```
┌─────────────────────────────────────────────────────────┐
│  HEADER                                                 │
│  [Logo] Bet Tracker        [Search] [Add Bet] [Export]  │
└─────────────────────────────────────────────────────────┘
│                                                         │
│  FILTERS                                                │
│  [All] [Upcoming] [Live] [Finished] [Settled]          │
│  Date range: [From] [To]    Sort: [Match Time ▼]       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  DASHBOARD (Card Grid)                                  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ UPCOMING     │  │ LIVE         │  │ FINISHED     │ │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤ │
│  │ Villa v RM   │  │ Chelsea v MC │  │ Arsenal v LFC│ │
│  │ Draw @ 3.50  │  │ Over 2.5     │  │ Home Win     │ │
│  │ €50          │  │ @ 1.85       │  │ @ 2.10       │ │
│  │              │  │ €100         │  │ €75 → €157.5 │ │
│  │ Starts in:   │  │ 67' min      │  │ WON ✓        │ │
│  │ 2d 5h        │  │              │  │              │ │
│  │ [Edit]       │  │ [Edit]       │  │ [Edit]       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  [Load More...]                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Upload Modal
```
┌─────────────────────────────────────────────────────────┐
│  Add New Bet                                     [X]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│        ┌───────────────────────────────┐               │
│        │                               │               │
│        │    Drag & Drop Image Here     │               │
│        │         or Click to Upload    │               │
│        │                               │               │
│        │    [📸 Choose Files]          │               │
│        │                               │               │
│        └───────────────────────────────┘               │
│                                                         │
│  Selected: bet_slip_1.jpg (1.2 MB)                     │
│            bet_slip_2.jpg (0.8 MB)                     │
│                                                         │
│  [Cancel]                    [Upload & Extract]        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**After upload - Review Mode:**
```
┌─────────────────────────────────────────────────────────┐
│  Review Extracted Data                           [X]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✓ Extraction successful (High confidence)             │
│                                                         │
│  Teams:       [Aston Villa vs Real Madrid        ]     │
│  Bet Type:    [Draw                              ]     │
│  Odds:        [3.50                              ]     │
│  Stake:       [50.00                             ] EUR  │
│  Match Time:  [2026-02-08] [20:00]               ]     │
│                                                         │
│  Notes (optional):                                      │
│  [____________________________________________]         │
│                                                         │
│  [Delete]              [Edit] [Save]                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Edit Bet Modal
```
┌─────────────────────────────────────────────────────────┐
│  Edit Bet                                        [X]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Teams:       [Aston Villa vs Real Madrid        ]     │
│  Bet Type:    [Draw                              ]     │
│  Odds:        [3.75                              ] ✏️   │
│  Stake:       [50.00                             ] EUR  │
│  Match Time:  [2026-02-08] [20:00]               ]     │
│                                                         │
│  Status:      ( ) Upcoming                              │
│               (•) Live                                  │
│               ( ) Finished                              │
│               ( ) Settled                               │
│                                                         │
│  Result:      ( ) Pending                               │
│               ( ) Won                                   │
│               ( ) Lost                                  │
│               ( ) Push                                  │
│                                                         │
│  Payout:      [175.00                            ] EUR  │
│                                                         │
│  Notes:       [Odds improved from 3.50 to 3.75   ]     │
│                                                         │
│  [Delete Bet]          [Cancel] [Save Changes]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
6.4 Dashboard Features
Auto Status Calculation:
javascriptfunction calculateStatus(matchTime) {
  const now = new Date();
  const match = new Date(matchTime);
  const diff = match - now;
  
  if (diff > 0) {
    return 'upcoming';
  } else if (diff > -10800000) { // 3 hours in ms
    return 'live';
  } else {
    return 'finished';
  }
}
```

**Visual Indicators:**
- Upcoming: Blue border, countdown timer
- Live: Green pulsing border, elapsed time
- Finished: Gray border, "Result pending"
- Settled (Won): Green background, shows payout
- Settled (Lost): Red background, shows loss

**Search & Filters:**
- Text search across teams field
- Filter by status (multi-select)
- Date range picker
- Sort by: match time, created date, stake amount, potential return

**Bulk Actions:**
- Select multiple bets
- Mark all as settled
- Export selection to CSV
- Delete multiple

---

## 7. AI EXTRACTION SYSTEM

### 7.1 Claude Vision Prompt
```
You are a betting slip data extractor. Analyze this image and extract structured betting information.

REQUIRED FIELDS:
- teams: The two teams/players competing (format: "Team A vs Team B")
- bet_type: What was bet on (e.g., "Home Win", "Draw", "Over 2.5 Goals", "BTTS")
- odds: The decimal odds/coefficient (e.g., 3.50)
- stake: The amount wagered
- currency: Currency code (EUR, USD, GBP, etc.)
- match_time: When the match starts (ISO format: YYYY-MM-DDTHH:MM:SSZ)

EXTRACTION RULES:
1. Teams: Always format as "Team1 vs Team2" (use "vs", not "-" or "v")
2. Bet type: Use standard terminology (Home Win, Away Win, Draw, Over X, Under X, BTTS, etc.)
3. Odds: Extract decimal odds. If fractional (e.g., 5/2), convert to decimal (3.50)
4. Stake: Extract numeric value only
5. Currency: Look for currency symbol (€, $, £) or code
6. Match time: Parse date and time. If only date shown, assume 00:00 UTC

RESPONSE FORMAT:
Return ONLY valid JSON with this exact structure:

{
  "teams": "Aston Villa vs Real Madrid",
  "bet_type": "Draw",
  "odds": 3.50,
  "stake": 50.00,
  "currency": "EUR",
  "match_time": "2026-02-08T20:00:00Z",
  "confidence": "high"
}

CONFIDENCE LEVELS:
- "high": All fields clearly visible and extracted
- "medium": Some fields required inference or assumptions
- "low": Multiple fields unclear or missing

If you cannot extract required data, return:
{
  "error": "Brief description of what's missing or unclear",
  "confidence": "low"
}

IMPORTANT:
- Do NOT include markdown formatting (no ```json```)
- Do NOT include explanatory text before/after JSON
- Return ONLY the JSON object
- Ensure all numeric values are numbers, not strings
- Match time must be valid ISO 8601 format
```

### 7.2 Handling Extraction Errors

**Error Types & Responses:**

1. **Low Confidence Extraction:**
```
Backend returns with warning:
{
  "success": true,
  "bet": { ... extracted data ... },
  "confidence": "low",
  "warning": "Match time was unclear, please verify"
}

Frontend shows warning banner:
"⚠️ Some fields may be inaccurate - please review carefully"
```

2. **Complete Failure:**
```
Backend returns:
{
  "success": false,
  "error": "extraction_failed",
  "message": "Could not identify betting information in image",
  "suggestion": "Ensure the bet slip is clearly visible and not cropped"
}

Frontend shows:
- Error message
- Option to retry
- Option to manually enter data
```

3. **Manual Entry Fallback:**
```
If extraction fails repeatedly, offer manual form:
"Unable to extract automatically - Enter bet details manually"
[Show empty form with all fields]
7.3 Validation Rules
Backend validates extracted data:
javascriptfunction validateExtraction(data) {
  const errors = [];
  
  // Teams
  if (!data.teams || !data.teams.includes(' vs ')) {
    errors.push("Invalid teams format");
  }
  
  // Odds
  if (!data.odds || data.odds < 1.01) {
    errors.push("Odds must be >= 1.01");
  }
  
  // Stake
  if (!data.stake || data.stake <= 0) {
    errors.push("Stake must be positive");
  }
  
  // Match time
  const matchTime = new Date(data.match_time);
  if (isNaN(matchTime.getTime())) {
    errors.push("Invalid match time format");
  }
  
  // Currency
  const validCurrencies = ['EUR', 'USD', 'GBP', 'JPY'];
  if (!validCurrencies.includes(data.currency)) {
    errors.push("Invalid currency code");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

8. SECURITY IMPLEMENTATION
8.1 Password Protection
Storage:
javascript// .env file on backend
PASSWORD_HASH=<bcrypt_hash_of_shared_password>
JWT_SECRET=<random_secret_key>
```

**Authentication Flow:**
```
1. User enters password in frontend
2. POST /api/auth with password
3. Backend compares: bcrypt.compare(password, PASSWORD_HASH)
4. If match: generate JWT token
5. Return token to frontend
6. Frontend stores in localStorage
7. All requests include: Authorization: Bearer <token>
Token Structure (JWT):
json{
  "user": "authenticated_user",
  "issued_at": 1234567890,
  "expires_at": 1234567890 + 604800
}
Session Management:

Token expires after 7 days
Frontend checks expiration before each request
If expired, redirect to login
User can manually logout (clears token)

8.2 API Security
Request Validation:
javascript// Middleware on all endpoints
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
Rate Limiting:
javascript// Prevent abuse
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 uploads per 15 min per IP
  message: 'Too many uploads, please try again later'
});

app.post('/api/upload', uploadLimiter, authMiddleware, uploadHandler);
Input Sanitization:

Validate all user inputs
Escape SQL queries (use parameterized queries)
Sanitize file uploads (check mime type, size)
Strip potential XSS from text fields

8.3 HTTPS & DNS
Requirements:

Backend must use HTTPS (Let's Encrypt certificate)
Frontend on Vercel (automatic HTTPS)
CORS configuration:

javascriptconst cors = require('cors');
app.use(cors({
  origin: 'https://yourbettracker.vercel.app',
  credentials: true
}));
DNS Setup:

Frontend: Custom domain via Vercel DNS
Backend: Subdomain pointing to server IP

api.yourdomain.com → your.server.ip.address
A record or CNAME




9. DEPLOYMENT GUIDE
9.1 Backend Deployment (Your Server)
Prerequisites:

Ubuntu/Debian server
Node.js 18+ installed
nginx installed
Domain/subdomain configured

Step-by-step:
bash# 1. Clone repository
git clone https://github.com/yourusername/bet-tracker-backend.git
cd bet-tracker-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
nano .env

# Edit:
PORT=3000
PASSWORD_HASH=<run: npx bcrypt-cli hash "your_shared_password" 10>
JWT_SECRET=<run: openssl rand -base64 32>
ANTHROPIC_API_KEY=your_api_key_here
DATABASE_PATH=/var/www/bet-tracker/database.sqlite
NODE_ENV=production

# 4. Initialize database
npm run db:migrate

# 5. Test locally
npm start
# Verify at http://localhost:3000/health

# 6. Setup PM2 (process manager)
npm install -g pm2
pm2 start npm --name "bet-tracker-api" -- start
pm2 save
pm2 startup

# 7. Configure nginx reverse proxy
sudo nano /etc/nginx/sites-available/bet-tracker

# Add:
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

sudo ln -s /etc/nginx/sites-available/bet-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 8. Setup SSL (Let's Encrypt)
sudo certbot --nginx -d api.yourdomain.com

# 9. Verify
curl https://api.yourdomain.com/health
9.2 Frontend Deployment (Vercel)
bash# 1. Build locally first
cd bet-tracker-frontend
npm install
npm run build

# 2. Configure environment
# Create .env.production
VITE_API_URL=https://api.yourdomain.com

# 3. Deploy to Vercel
# Option A: CLI
npm install -g vercel
vercel login
vercel --prod

# Option B: GitHub integration
# Push to GitHub, connect repo in Vercel dashboard

# 4. Configure custom domain in Vercel dashboard
# Settings → Domains → Add yourbettracker.com

# 5. Verify
# Visit https://yourbettracker.com
9.3 Environment Variables Summary
Backend (.env):
bashPORT=3000
PASSWORD_HASH=<bcrypt hash>
JWT_SECRET=<random secret>
ANTHROPIC_API_KEY=sk-ant-xxxxx
DATABASE_PATH=/var/www/bet-tracker/database.sqlite
NODE_ENV=production
CORS_ORIGIN=https://yourbettracker.vercel.app
Frontend (.env.production):
bashVITE_API_URL=https://api.yourdomain.com

10. BEST PRACTICES & DESIGN DECISIONS
10.1 Why These Choices?
1. SQLite vs PostgreSQL

Decision: SQLite (can upgrade later)
Reasoning:

2 users = minimal concurrency needs
Single file = easy backups
Zero configuration
Can migrate to PostgreSQL if needed (same SQL)



2. JWT vs Session Cookies

Decision: JWT tokens
Reasoning:

Stateless (no session storage on server)
Works across devices
Easy to implement
7-day expiry = good UX



3. Image Processing: Server vs Client

Decision: Server-side
Reasoning:

API key protected (not exposed in frontend)
Consistent processing environment
Can add preprocessing (resize, enhance) easily
User's device doesn't need to handle base64 encoding



4. Real-time Updates vs Polling

Decision: No real-time (manual refresh)
Reasoning:

2 users = low collaboration needs
Simpler implementation
No WebSocket complexity
Can add later with Socket.io if needed



5. Status Calculation: Client vs Server

Decision: Server calculates, client displays
Reasoning:

Single source of truth
Timezone handling on server
Client just renders what server provides
Ensures consistency across users



10.2 User Experience Decisions
Editable Dashboard:

Why: Vision AI isn't 100% accurate
Implementation: Inline editing on bet cards
Auto-save: 500ms debounce after typing stops

Batch Upload:

Why: Users often bet on multiple matches at once
Implementation: Queue-based processing (sequential, not parallel)
UX: Progress bar: "Processing 3 of 5..."

No Auto-Settlement:

Why: No reliable free API for match results
Implementation: Manual marking (won/lost/push)
Future: Could add web scraping or paid API integration

Export to CSV:

Why: Users want to analyze in Excel/Sheets
Implementation: Client-side generation (no server needed)
Format: Columns match database schema

Search & Filter:

Why: 100+ bets = need to find specific ones
Implementation:

Text search: Client-side (loads all, filters locally)
Date range: Server-side (reduces data transfer)



10.3 Code Quality Practices
Backend:
javascript// Controller structure
const betController = {
  upload: async (req, res) => { /* ... */ },
  list: async (req, res) => { /* ... */ },
  get: async (req, res) => { /* ... */ },
  update: async (req, res) => { /* ... */ },
  delete: async (req, res) => { /* ... */ }
};

// Service layer (business logic)
const betService = {
  extractFromImage: async (imageBuffer) => { /* ... */ },
  calculateStatus: (matchTime) => { /* ... */ },
  validateBet: (betData) => { /* ... */ }
};

// Repository layer (database)
const betRepository = {
  create: async (betData) => { /* ... */ },
  findAll: async (filters) => { /* ... */ },
  findById: async (id) => { /* ... */ },
  update: async (id, data) => { /* ... */ },
  delete: async (id) => { /* ... */ }
};
Frontend:
javascript// Component structure
components/
  UploadModal.jsx
  BetCard.jsx
  Dashboard.jsx
  FilterBar.jsx
  EditModal.jsx

// State management (Context API or Zustand)
stores/
  useBetStore.js    // Bet data
  useAuthStore.js   // Authentication
  useUIStore.js     // Modals, loading states

// API client
services/
  api.js            // Axios instance with auth
  betService.js     // Bet-related API calls
Error Handling:
javascript// Backend: Consistent error responses
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Frontend: User-friendly messages
const ERROR_MESSAGES = {
  extraction_failed: "We couldn't read your bet slip. Please try again or enter manually.",
  network_error: "Connection issue. Check your internet and retry.",
  auth_failed: "Session expired. Please log in again."
};
10.4 Testing Strategy
Backend Tests:
javascript// Unit tests
describe('betService.extractFromImage', () => {
  it('should extract valid bet data from image', async () => {
    const result = await betService.extractFromImage(mockImage);
    expect(result.teams).toBe('Team A vs Team B');
    expect(result.odds).toBeGreaterThan(1);
  });
  
  it('should return error for invalid image', async () => {
    const result = await betService.extractFromImage(corruptedImage);
    expect(result.error).toBeDefined();
  });
});

// Integration tests
describe('POST /api/upload', () => {
  it('should create bet from valid image', async () => {
    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('image', 'test/fixtures/valid_bet_slip.jpg');
    
    expect(response.status).toBe(200);
    expect(response.body.bet.teams).toBeDefined();
  });
});
Frontend Tests:
javascript// Component tests
describe('BetCard', () => {
  it('should display bet information correctly', () => {
    render(<BetCard bet={mockBet} />);
    expect(screen.getByText('Aston Villa vs Real Madrid')).toBeInTheDocument();
  });
  
  it('should enter edit mode on click', () => {
    render(<BetCard bet={mockBet} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByRole('textbox', { name: 'odds' })).toBeInTheDocument();
  });
});
10.5 Monitoring & Maintenance
What to Monitor:

API response times
Claude API errors (extraction failures)
Database size (should grow slowly)
Failed upload attempts
User authentication failures

Simple Monitoring:
javascript// Add to backend
const logger = require('winston');

logger.info('Bet created', {
  bet_id: bet.id,
  extraction_confidence: bet.confidence,
  processing_time_ms: Date.now() - startTime
});

logger.error('Extraction failed', {
  error: error.message,
  image_size: imageBuffer.length
});
Backup Strategy:
bash# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
cp /var/www/bet-tracker/database.sqlite \
   /backups/bet-tracker-$DATE.sqlite

# Keep last 30 days
find /backups -name "bet-tracker-*.sqlite" -mtime +30 -delete
Monthly Maintenance:

Check disk space
Review error logs
Update dependencies (npm update)
Rotate API keys if needed
Verify backup integrity


11. FUTURE ENHANCEMENTS (Optional)
These are NOT in scope for initial version, but noted for future:

Auto Result Checking

Integration with sports data API (cost: ~$20/month)
Auto-mark bets as won/lost
Push notifications


Analytics Dashboard

Win rate by bet type
ROI tracking
Graphs of performance over time


Multiple Bookie Support

Templates for different bookie layouts
Auto-detect bookie from screenshot


Mobile App

React Native wrapper
Push notifications
Camera integration


Sharing

Generate shareable bet slips
Social features


Advanced Filters

By league/competition
By potential return
By risk level (based on odds)




12. SUCCESS METRICS
How to measure if this is working:

Extraction Accuracy: >90% of bets extracted correctly (need <10% manual corrections)
Speed: Image uploaded to data displayed in <5 seconds
Uptime: >99% (downtime only during maintenance)
User Satisfaction: Both users actively using it for 1+ month
Data Integrity: Zero data loss incidents
Cost: <$5/month operational cost


13. FINAL CHECKLIST
Before going live:
Backend:

 All endpoints tested and working
 Environment variables secured
 Database migrations run
 SSL certificate active
 PM2 process running
 Nginx configured correctly
 CORS set to frontend URL
 Rate limiting enabled
 Logging implemented
 Backup script scheduled

Frontend:

 All components responsive (mobile + desktop)
 Environment variables set
 API calls working with real backend
 Error handling implemented
 Loading states for all async operations
 Password authentication working
 Edit functionality tested
 Batch upload working
 Deployed to Vercel
 Custom domain connected

Integration:

 Frontend can authenticate with backend
 Image upload end-to-end tested
 Dashboard loads and displays bets
 Edit and delete operations work
 Status calculation accurate
 Both users can access simultaneously
 Data persists across sessions

Documentation:

 README with setup instructions
 API documentation
 Environment variable examples
 Deployment guide
 User guide (how to use the app)