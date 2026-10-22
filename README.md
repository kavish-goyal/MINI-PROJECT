# DevConnect

> **Find the Right Team. Build Amazing Projects.**

A student collaboration platform where students can create profiles, post projects, recruit teammates, apply to teams, and manage applications.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML + CSS + Vanilla JavaScript |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas + Mongoose |
| Passwords | Argon2id |
| Sessions | express-session + connect-mongo |
| Email | Nodemailer + Gmail SMTP (Firebase/Google account) |
| Deployment | Render (single web service) |

---

## Local Setup (Step by Step)

### 1. Prerequisites

- [Node.js 18+](https://nodejs.org/) installed
- A free [MongoDB Atlas](https://cloud.mongodb.com) account
- A Gmail account linked to your [Firebase project](https://console.firebase.google.com) (devconnect-9949c)
- [2-Step Verification enabled](https://myaccount.google.com/security) on that Google account (required for App Passwords)

### 2. Clone and install

```bash
git clone <your-repo-url>
cd devconnect
npm install
```

### 3. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in each value:

| Variable | Where to get it |
|----------|----------------|
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers → copy string |
| `SESSION_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GMAIL_USER` | The Gmail address linked to your Firebase project |
| `GMAIL_APP_PASSWORD` | Google Account → Security → 2-Step Verification → App passwords → create one |
| `APP_URL` | `http://localhost:3000` locally |
| `NODE_ENV` | `development` |
| `PORT` | `3000` |

> **Never commit your `.env` file.** It's in `.gitignore` already.

### 4. (Optional) Load sample data

```bash
npm run seed
```

This creates two test accounts (alice@example.com and bob@example.com, both with password `password123`) and two sample projects.

### 5. Start the development server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Render Deployment

### One-time setup

1. Push your code to GitHub (without `.env`).
2. Go to [render.com](https://render.com) → New → **Web Service**.
3. Connect your GitHub repository.
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Add environment variables in Render's dashboard (same keys as `.env`):
   - Change `APP_URL` to your Render URL (e.g. `https://devconnect.onrender.com`)
   - Change `NODE_ENV` to `production`
   - Render sets `PORT` automatically — leave it out.

### MongoDB Atlas

Make sure your MongoDB Atlas cluster allows connections from Render:
- Atlas → Network Access → Add IP Address → **Allow Access from Anywhere** (0.0.0.0/0)
  *(or whitelist Render's IP ranges for stricter security)*

---

## Project Structure

```
DevConnect/
├── server.js              # App entry point
├── config/db.js           # MongoDB connection
├── middleware/
│   ├── auth.js            # requireLogin, requireVerified
│   └── validate.js        # Input validation helpers
├── models/
│   ├── User.js            # User schema
│   ├── Project.js         # Project schema
│   ├── Application.js     # Application schema
│   └── Token.js           # Verification/reset token schema
├── routes/
│   ├── auth.js            # /api/auth/*
│   ├── users.js           # /api/users/*
│   ├── projects.js        # /api/projects/*
│   └── applications.js    # /api/applications/*
├── services/email.js      # Nodemailer + Gmail SMTP email service (Firebase/Google)
├── scripts/seed.js        # Sample data (dev only)
└── public/                # Frontend (served as static files)
    ├── index.html
    ├── css/style.css
    └── js/api.js
```

---

## npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Development | `npm run dev` | Starts server with nodemon (auto-restart) |
| Production | `npm start` | Starts server with node |
| Seed data | `npm run seed` | Inserts sample users and projects |
