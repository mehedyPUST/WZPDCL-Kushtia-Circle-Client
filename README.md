# WZPDCL Bottail Load Calculator (TypeScript)

33/11 kV substation load calculator for **WZPDCL Bottail-Kushtia**.

## Recommended architecture

**Deploy only the frontend** (this folder).  
It includes full API routes under `src/app/api/*` and talks to MongoDB directly.  
No separate backend is required on Vercel.

The `back/` folder is an optional standalone Express API (for local use or separate hosting).

---

## Local development

```bash
cp .env.example .env.local
# set MONGODB_URI and JWT_SECRET

npm install
npm run dev
```

Open http://localhost:3000

---

## Deploy Frontend to Vercel (recommended)

1. Push this project to GitHub (the folder that contains `package.json` + `src/`).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. **Root Directory**: leave as `.` (or set to the folder that has `next.config.mjs`).
4. **Framework Preset**: Next.js (auto-detected).
5. **Environment Variables** → add:

| Name | Value | Notes |
|------|-------|-------|
| `MONGODB_URI` | `mongodb+srv://WZPDCL-BOTTAIL:iKQQCJDPacySHa1S@bottailwzpdcl.wq5c6td.mongodb.net/load-management?appName=cluster-bottailWZPDCL` | No `< >` around user/pass |
| `JWT_SECRET` | long random string | e.g. 64+ chars |
| `JWT_EXPIRY` | `7d` | optional |

6. Click **Deploy**.

### Atlas checklist
- Database user exists and password is correct
- Network Access → allow `0.0.0.0/0` (or Vercel IPs)
- Connection string uses the correct database name (`load-management`)

---

## Optional: Deploy Backend separately

Only if you want the Express API as its own Vercel project:

```bash
cd back
# create .env with MONGODB_URI, JWT_SECRET, FRONTEND_URL
vercel
```

Set env vars on that project too. Then set `NEXT_PUBLIC_API_URL` on the frontend to the backend URL.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Stack

- Next.js 15 + TypeScript + React 19
- Tailwind CSS v4 + CSS variables
- MongoDB / Mongoose (or in-memory mock if no URI)
- HeroUI, Recharts, Lucide, Motion
