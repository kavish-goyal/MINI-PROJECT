# DevConnect API Documentation

Base URL (local): `http://localhost:3000`  
All endpoints return JSON. All request bodies are JSON (`Content-Type: application/json`).

---

## Authentication (`/api/auth`)

### POST `/api/auth/register`
Create a new account.

**Request:**
```json
{ "name": "Alice Sharma", "email": "alice@example.com", "password": "mypassword" }
```
**Success (201):**
```json
{ "message": "Account created! Please check your email to verify your account." }
```
**Errors:** `400` validation, `409` email already exists, `500` server error.

---

### POST `/api/auth/verify-email`
Verify email with the token from the email link.

**Request:**
```json
{ "token": "64-char-hex-token-from-email" }
```
**Success (200):**
```json
{ "message": "Email verified! You can now log in." }
```
**Errors:** `400` invalid/expired token.

---

### POST `/api/auth/resend-verification`
Resend a verification email.

**Request:**
```json
{ "email": "alice@example.com" }
```
**Success (200):** *(always returns the same message)*
```json
{ "message": "If that account exists and is unverified, a new link has been sent." }
```

---

### POST `/api/auth/login`
Log in. Sets a session cookie.

**Request:**
```json
{ "email": "alice@example.com", "password": "mypassword" }
```
**Success (200):**
```json
{ "message": "Logged in!", "user": { "id": "...", "name": "Alice Sharma", "isVerified": true } }
```
**Errors:** `400` missing fields, `401` wrong credentials.

---

### POST `/api/auth/logout`
Destroy the session.

**Success (200):**
```json
{ "message": "Logged out." }
```

---

### POST `/api/auth/forgot-password`
Request a password reset email.

**Request:**
```json
{ "email": "alice@example.com" }
```
**Success (200):** *(always the same message)*
```json
{ "message": "If an account with that email exists, a reset link has been sent." }
```

---

### POST `/api/auth/reset-password`
Set a new password using the reset token.

**Request:**
```json
{ "token": "64-char-hex-token", "password": "newpassword123" }
```
**Success (200):**
```json
{ "message": "Password reset! Please log in with your new password." }
```
**Errors:** `400` invalid/expired token or weak password.

---

### GET `/api/auth/me`
Get the current session's user info. Requires login.

**Success (200):**
```json
{ "user": { "_id": "...", "name": "Alice Sharma", "email": "alice@example.com", "isVerified": true } }
```
**Errors:** `401` not logged in.

---

## Users (`/api/users`)

### GET `/api/users/:id`
Public profile. No auth required.

**Success (200):**
```json
{
  "user": {
    "_id": "...", "name": "Alice Sharma", "college": "IIT Delhi",
    "branch": "CS", "gradYear": 2026, "bio": "...", "skills": ["React"],
    "githubUrl": "https://github.com/alice", "availability": "open"
  }
}
```

---

### GET `/api/users/me/profile`
Own full profile. Requires login.

**Success (200):** Same as above but includes email and all fields.

---

### PUT `/api/users/me`
Update own profile. Requires login.

**Request (all fields optional):**
```json
{
  "name": "Alice B. Sharma", "college": "IIT Delhi", "branch": "CS",
  "gradYear": 2026, "bio": "Updated bio.", "skills": ["React", "Node.js"],
  "githubUrl": "https://github.com/alice", "linkedinUrl": "https://linkedin.com/in/alice",
  "availability": "open"
}
```
**Success (200):**
```json
{ "message": "Profile updated!", "user": { ... } }
```

---

## Projects (`/api/projects`)

### GET `/api/projects`
List open projects. Public.

**Query params:** `search`, `category`, `skill`, `page` (default 1), `limit` (default 12)

**Success (200):**
```json
{
  "projects": [{ "_id": "...", "title": "...", "category": "Web", "owner": { "name": "Alice", "college": "IIT Delhi" }, ... }],
  "total": 5, "page": 1, "totalPages": 1
}
```

---

### GET `/api/projects/:id`
Single project details. Public.

**Success (200):**
```json
{
  "project": {
    "_id": "...", "title": "...", "description": "...", "category": "Web",
    "requiredSkills": ["React"], "totalPositions": 3,
    "acceptedMembers": [{ "_id": "...", "name": "Bob", "skills": ["Python"] }],
    "deadline": "2025-12-31T00:00:00.000Z", "owner": { "name": "Alice", ... },
    "status": "open"
  }
}
```

---

### POST `/api/projects`
Create a project. Requires login + verified email.

**Request:**
```json
{
  "title": "Campus App", "description": "A helpful app for students.",
  "category": "Web", "requiredSkills": ["React", "MongoDB"],
  "totalPositions": 4, "deadline": "2025-12-31"
}
```
**Success (201):**
```json
{ "message": "Project created!", "project": { "_id": "...", ... } }
```

---

### PUT `/api/projects/:id`
Update a project. Requires login + owner.

**Request:** Same fields as POST (all optional).
**Success (200):** `{ "message": "Project updated!", "project": { ... } }`

---

### DELETE `/api/projects/:id`
Permanently delete a project/hackathon squad posting. Also cascades and removes all associated team applications. Requires login + owner.

**Success (200):** `{ "message": "Post deleted successfully." }`
**Errors:** `403` not owner, `404` project not found.

---

### POST `/api/projects/:id/close`
Close a project. Requires login + owner.

**Success (200):** `{ "message": "Project closed." }`

---

### GET `/api/projects/mine/list`
Own projects (dashboard). Requires login.

**Success (200):** `{ "projects": [ ... ] }`

---

## Applications (`/api/applications`)

### POST `/api/applications`
Apply to a project. Requires login + verified email.

**Request:**
```json
{ "projectId": "...", "message": "I would love to join because…" }
```
**Success (201):** `{ "message": "Application submitted!", "application": { ... } }`  
**Errors:** `400` own project / closed / full / expired, `409` already applied.

---

### GET `/api/applications/mine`
Own applications. Requires login.

**Success (200):**
```json
{
  "applications": [
    { "_id": "...", "project": { "title": "...", "category": "Web" }, "message": "...", "status": "pending", "createdAt": "..." }
  ]
}
```

---

### DELETE `/api/applications/:id`
Withdraw a pending application. Requires login + applicant.

**Success (200):** `{ "message": "Application withdrawn." }`

---

### GET `/api/applications/project/:projectId`
All applications for a project. Requires login + owner.

**Success (200):**
```json
{
  "project": { "title": "...", "totalPositions": 3, "acceptedMembers": [...] },
  "applications": [
    { "_id": "...", "applicant": { "name": "Bob", "skills": ["Python"], "githubUrl": "..." }, "message": "...", "status": "pending" }
  ]
}
```

---

### POST `/api/applications/:id/accept`
Accept an applicant. Requires login + owner. **Uses a MongoDB transaction.**

**Success (200):** `{ "message": "Applicant accepted!" }`  
**Errors:** `400` team full, `403` not owner.

---

### POST `/api/applications/:id/reject`
Reject an applicant. Requires login + owner.

**Success (200):** `{ "message": "Application rejected." }`
