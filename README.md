# Scripture Habit

`scripture-habit` is a React + TypeScript application built with Vite, Firebase, and an Express backend. It also includes Capacitor Android support and server-side API modules.

## 📁 Repository structure

- `scripture-habit/`
  - `src/` — React frontend source code
  - `backend/` — Express + Firebase Admin backend server
  - `api/`, `api_internal/` — API routes and internal server helper code
  - `android/` — Capacitor Android project files
  - `public/` — static assets
  - `firebase.json`, `firestore.rules`, `firestore.indexes.json` — Firebase configuration
  - `package.json` — main app scripts and dependencies
- `end_of_sprint_report.md` — sprint report or project notes

## 🚀 Getting started

From the repository root:

```bash
cd scripture-habit
npm install
```

### Frontend development

```bash
npm run dev
```

### Backend development

```bash
npm run server
```

> `npm run server` starts the Express backend located in `scripture-habit/backend`.

## 🧩 Available scripts

From `scripture-habit/`:

- `npm run dev` — start the Vite frontend development server
- `npm run server` — start the backend server
- `npm run build` — build the frontend for production
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint
- `npm run test` — run Vitest

## 🔧 Tech stack

- React 19 + TypeScript
- Vite
- Firebase + Firebase Admin
- Express
- Capacitor (Android support)
- Zustand, React Query
- Helmet, CORS, express-rate-limit
- Sentry, Vercel Analytics

## ☁️ Deployment notes

This project contains both Firebase and Vercel configuration files:

- `firebase.json` / `firestore.rules` / `firestore.indexes.json` — Firebase hosting and Firestore rules
- `.vercel/` / `vercel.json` — Vercel deployment settings

## 📝 Notes

- The top-level repository no longer has a `package.json`; all npm workflows happen inside `scripture-habit/`.
- Keep environment variables in `.env` / `.env.local` and do not commit secrets.
- Android build and Capacitor integration are handled inside `scripture-habit/android/`.

---