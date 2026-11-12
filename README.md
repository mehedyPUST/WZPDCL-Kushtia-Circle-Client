# WZPDCL Bottail Load Calculator

33/11 kV substation load calculator for **WZPDCL Bottail-Kushtia**.

## Architecture

Deploy only this Next.js app. API routes live under `src/app/api/*` and talk to MongoDB directly (or an in-memory mock when `MONGODB_URI` is unset).

## Local development

```bash
cp .env.example .env.local
# set MONGODB_URI, JWT_SECRET, and GROQ_API_KEY

npm install
npm run dev
```

Open http://localhost:3000

### Environment variables

| Name | Required | Description |
|------|----------|-------------|
| `MONGODB_URI` | Prod | MongoDB connection string |
| `JWT_SECRET` | Yes | Long random string for auth tokens |
| `JWT_EXPIRY` | No | Default `7d` |
| `GROQ_API_KEY` | For AI night log | Groq key (`gsk_...`) for “Generate With AI” |
| `GROQ_MODEL` | No | Override default Groq model |
| `NEXT_PUBLIC_API_URL` | No | Leave empty to use same-origin `/api` |

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. Set environment variables from the table above (never put secrets in the repo).
4. Deploy.

### Atlas checklist
- Database user + password correct
- Network Access allows `0.0.0.0/0` (or Vercel IPs)
- Connection string uses the correct database name

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
- Groq API for AI-assisted night log generation
