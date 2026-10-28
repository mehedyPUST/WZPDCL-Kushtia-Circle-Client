# WZPDCL Bottail Load Calculator (TypeScript)

33/11 kV substation load calculator for **WZPDCL Bottail-Kushtia**.

Converted to **TypeScript** with latest Next.js, React, Tailwind CSS v4, and CSS variables.

## Features

- Feeder MW calculation (formula unchanged)
- **Calculate Only** · **Calculate & Save** · **Copy Total**
- Saved history (left panel) · full detail view (right panel)
- Delete with confirmation modal
- Admin panel, circle load, load shed, statistics, and more

## Formula (unchanged)

```
MW = (√3 × V_kV × 0.95 × I_A) / 1000
```

## Stack

- **Next.js 15** (App Router) + TypeScript
- **React 19**
- **Tailwind CSS v4** with CSS variables for theming
- **MongoDB Atlas** via Mongoose (or in-memory mock)
- HeroUI, Recharts, Lucide icons, Motion

## Folder Structure (simplified)

```
src/
├── app/                 # App Router pages + API routes
│   ├── api/             # Backend API routes
│   ├── (pages)/         # Feature pages
│   ├── layout.tsx
│   └── globals.css      # Tailwind + CSS variables
├── components/          # UI components
├── context/             # React contexts (Auth, Theme)
├── hooks/               # Custom hooks
├── lib/                 # Utilities, DB, calculations, constants
└── types/               # Shared TypeScript types
```

## Local development

```bash
cp .env.example .env.local
# set MONGODB_URI and JWT_SECRET

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run start` – start production
- `npm run typecheck` – TypeScript check
- `npm run lint` – ESLint

## Deploy on Vercel

1. Push repo to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. **Environment Variables** → add:
   - `MONGODB_URI` = your Atlas connection string
   - `JWT_SECRET` = a strong secret
4. Deploy

## Notes

- All original functionality preserved
- CSS variables used for theming (dark mode default)
- Tailwind CSS v4 with `@tailwindcss/postcss`
- TypeScript with relaxed strictness for gradual typing; improve types over time
