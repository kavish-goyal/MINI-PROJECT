# DevConnect – Learning Guide

This guide explains every important file and traces five complete flows so you can understand exactly how the app works. Read this alongside the code.

---

## How the App is Organized

```
Browser (HTML/CSS/JS)  ──fetch──▶  Express Routes  ──▶  Models (MongoDB)
                       ◀──JSON──                   ◀──
```

1. The **browser** sends HTTP requests to `/api/...` URLs.
2. **Express routes** receive the request, validate it, talk to MongoDB, and send back JSON.
3. **Models** (Mongoose schemas) define the shape of data in MongoDB.
4. The **browser** reads the JSON and updates the page.

---

## File-by-File Explanation

### `server.js`
The starting point. When you run `npm run dev`, Node runs this file.
- Loads `.env` (via `require('dotenv').config()`)
- Connects to MongoDB
- Sets up sessions (stored in MongoDB, not memory)
- Registers all API route handlers
- Serves the `public/` folder as static files

### `config/db.js`
Just one function: `connectDB()`. Calls `mongoose.connect()`. If it fails, the server stops.

### `models/User.js`
Defines the User "table" in MongoDB. Important fields:
- `passwordHash` – Argon2id hash. **Never the raw password.**
- `isVerified` – `false` until the user clicks the email link.
- `email` – always stored lowercase (so login works regardless of caps).

### `models/Token.js`
Stores email-verification and password-reset tokens **as SHA-256 hashes**.
- The raw token goes in the email link.
- The hash goes in the DB.
- Even if someone reads the DB, they can't use the token (they'd need the raw value).
- Has a MongoDB TTL index: tokens auto-delete after `expiresAt`.

### `models/Project.js`
Stores project info. Key fields:
- `acceptedMembers` – array of User IDs who've been accepted.
- `totalPositions` – maximum team size.
- `owner` – User ID of the creator.

### `models/Application.js`
Stores each application. A **compound unique index** on `{applicant, project}` means one student can only apply once per project (the DB enforces this, not just the code).

### `middleware/auth.js`
Two short functions:
- `requireLogin` – checks `req.session.userId`. Returns 401 if missing.
- `requireVerified` – checks `req.session.isVerified`. Returns 403 if false.

Used like: `router.post('/apply', requireLogin, requireVerified, handler)`

### `middleware/validate.js`
Small helper functions:
- `isValidEmail` – simple regex check.
- `isStrongPassword` – length >= 8.
- `isValidHttpsUrl` – uses `new URL()` to parse and check protocol.
- `pickAllowed` – filters an object to only keep safe keys (prevents mass-assignment attacks).

### `services/email.js`
Uses the Resend API (via `node-fetch`) to send HTML emails.
- `sendVerificationEmail(email, rawToken)` – sends a link to `/verify-email.html?token=...`
- `sendPasswordResetEmail(email, rawToken)` – sends a link to `/reset-password.html?token=...`

### `routes/auth.js`
Handles all authentication endpoints. See flow traces below.

### `routes/users.js`
- `GET /api/users/:id` – public profile (no email, no password hash).
- `PUT /api/users/me` – update own profile (uses `pickAllowed` for safety).
- `GET /api/users/me/profile` – own full profile (for edit form).

### `routes/projects.js`
- `GET /api/projects` – list with search, category, skill filters and pagination.
- `GET /api/projects/:id` – single project.
- `POST /api/projects` – create (login + verified required).
- `PUT /api/projects/:id` – edit (owner only).
- `POST /api/projects/:id/close` – close project (owner only).
- `GET /api/projects/mine/list` – dashboard: own projects.

### `routes/applications.js`
- `POST /api/applications` – apply to a project.
- `GET /api/applications/mine` – dashboard: own applications.
- `DELETE /api/applications/:id` – withdraw (pending only).
- `GET /api/applications/project/:id` – owner views all applicants.
- `POST /api/applications/:id/accept` – **uses a MongoDB transaction** (see flow below).
- `POST /api/applications/:id/reject` – mark as rejected.

### `public/js/api.js`
Shared frontend utilities:
- `api.get/post/put/delete` – wraps `fetch()` and always returns `{ data, error }`.
- `showAlert(id, msg, type)` – shows error/success/info messages.
- `setLoading(btn, true/false, text)` – disables button while request is in progress.
- `renderNavbar()` – calls `/api/auth/me` and renders login or logout links.

---

## Flow 1: Registration

```
Browser                   Server                    Database
  │                          │                          │
  │─POST /api/auth/register──▶│                          │
  │  {name, email, password} │                          │
  │                          │─validate inputs           │
  │                          │─check email duplicate────▶│
  │                          │◀─ not found ─────────────│
  │                          │─hash password (Argon2id)  │
  │                          │─create User document─────▶│
  │                          │─create Token document────▶│
  │                          │─send email (Resend API)   │
  │◀─201 {message}───────────│                          │
  │                          │                          │
```

**Key point:** The raw token is in the email link. Only the SHA-256 hash is stored in MongoDB.

---

## Flow 2: Login

```
Browser                   Server                    Database
  │                          │                          │
  │─POST /api/auth/login─────▶│                          │
  │  {email, password}       │                          │
  │                          │─find user by email───────▶│
  │                          │◀─user document────────────│
  │                          │─argon2.verify(hash, pwd)  │
  │                          │  (returns true/false)     │
  │                          │─req.session.regenerate()  │ (prevents session fixation)
  │                          │─set session.userId        │
  │                          │─set session.isVerified    │
  │                          │─session saved to MongoDB──▶│
  │◀─200 {user}──────────────│                          │
  │  (cookie set in header)  │                          │
```

After this, every future request includes the session cookie automatically.

---

## Flow 3: Password Reset

```
  1. User fills forgot-password form → POST /api/auth/forgot-password
  2. Server finds user, creates 15-minute Token, emails a link
  3. User clicks link → /reset-password.html?token=abc123
  4. Page reads token from URL → POST /api/auth/reset-password {token, password}
  5. Server hashes token → looks up in DB → finds Token record
  6. Server hashes new password, saves to user, deletes Token
  7. Session destroyed → user redirected to login
```

**Security:** The server always returns the same message for forgot-password regardless of whether the email exists (prevents email enumeration).

---

## Flow 4: Creating a Project

```
  1. User visits /edit-project.html
  2. Fills form, clicks "Create Project"
  3. POST /api/projects {title, description, …}
  4. Server runs requireLogin → checks req.session.userId ✓
  5. Server runs requireVerified → checks req.session.isVerified ✓
  6. Server validates fields
  7. Sets owner = req.session.userId (NOT from request body – important!)
  8. Creates Project document in MongoDB
  9. Returns 201 → browser redirects to /project.html?id=...
```

**Security:** The owner is ALWAYS set from the session, never from what the browser sends. This prevents a user from claiming to be someone else.

---

## Flow 5: Applying to a Project (with Atomic Accept)

**Apply:**
```
  1. POST /api/applications {projectId, message}
  2. Server checks: not own project, project open, deadline not passed, spots available
  3. Creates Application document (duplicate blocked by unique index)
```

**Accept (with MongoDB Transaction):**
```
  1. Owner clicks Accept → POST /api/applications/:id/accept
  2. Server opens a MongoDB session and starts a transaction
  3. Inside the transaction:
     a. Fetches Application document
     b. Fetches Project document
     c. Checks team is not full (this check is INSIDE the transaction)
     d. Adds applicant to project.acceptedMembers
     e. Sets application.status = 'accepted'
     f. If team now full → sets project.status = 'closed'
     g. Saves both documents
  4. Commits transaction
```

**Why the transaction?** Imagine two owners click Accept simultaneously on the last remaining spot. Without a transaction, both reads would see 1 spot available and both would accept. With a transaction, MongoDB locks the documents so only one can succeed. The second one fails and returns "team is full".

---

## Common Beginner Questions

**Q: How does the browser stay logged in?**
A: The session ID is stored in a cookie (set by the server). Every request the browser makes includes this cookie. The server reads the cookie, looks up the session in MongoDB, and gets the `userId`.

**Q: Why do we hash passwords?**
A: If the database is ever breached, attackers get hashed values, not real passwords. Argon2id is intentionally slow to compute, making brute-force attacks impractical.

**Q: What is `pickAllowed`?**
A: It prevents "mass assignment" attacks. If a user sends `{ isVerified: true }` in a profile update request, `pickAllowed` would ignore it because `isVerified` isn't in the allowed list.

**Q: Why does the seed script use `npm run seed` and not `node scripts/seed.js`?**
A: Both work. Using `npm run seed` uses the script defined in `package.json` and is the convention. The seed script also loads `.env` automatically.
