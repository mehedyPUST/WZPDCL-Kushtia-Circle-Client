# WZPDCL Bottail Load Calculator — Frontend

Next.js user interface for the WZPDCL Bottail-Kushtia 33/11 kV substation load calculator. This project contains no API route handlers, database connection, authentication secrets, or AI-provider credentials. All application APIs and data operations are handled by the separate Express backend.

## Local development

Start the backend first at `http://localhost:5000`, then configure the frontend:

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Name | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Public base URL of the Express API, without trailing slash |
| `NEXT_PUBLIC_APP_BUILD_ID` | No | Optional frontend build identifier |

Do not configure `MONGODB_URI`, `JWT_SECRET`, `ADMIN_REGISTRATION_SECRET`, or `GROQ_API_KEY` in this project. Those belong only in the backend environment.

## Deploy to Vercel

1. Deploy the Express backend project first.
2. Set `NEXT_PUBLIC_API_URL` in the frontend Vercel project to the backend's public URL.
3. Deploy this Next.js project.
4. In the backend project, set `FRONTEND_URL` to the exact frontend origin (and any required preview origins).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint

## Stack

Next.js 15, React 19, TypeScript, Tailwind CSS v4, Serwist PWA.
