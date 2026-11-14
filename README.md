# WZPDCL Bottail Load Calculator — Frontend

This is the **UI-only Next.js application** for the WZPDCL Bottail-Kushtia 33/11 kV substation load calculator. It contains no API route handlers, database models, database connection, authentication implementation, or AI-provider integration. Every data request is sent directly from the browser to the separate Express API through `NEXT_PUBLIC_API_URL`.

## Local development

1. Start the backend from `WZPDCL-Kushtia-Circle-Server` (default: `http://localhost:5000`).
2. Create `.env.local` from `.env.example` and set:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

3. Install dependencies and start the frontend:

   ```bash
   npm install
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Public base URL of the Express API, without a trailing slash |
| `NEXT_PUBLIC_APP_BUILD_ID` | No | Optional PWA build identifier |

Do not add `MONGODB_URI`, `JWT_SECRET`, `ADMIN_REGISTRATION_SECRET`, or `GROQ_API_KEY` to the frontend. Those values belong exclusively in the backend environment.

## Deployment

1. Deploy `WZPDCL-Kushtia-Circle-Server` as the API service.
2. Configure the backend's `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRY`, `ADMIN_REGISTRATION_SECRET`, and `FRONTEND_URL` (plus optional AI-provider keys).
3. Deploy this frontend project.
4. Set the frontend's `NEXT_PUBLIC_API_URL` to the deployed backend URL.
5. Ensure the backend `FRONTEND_URL` includes the exact deployed frontend origin(s), then redeploy the backend.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint

## Stack

Next.js 15, React 19, TypeScript, Tailwind CSS v4, and Serwist PWA.
