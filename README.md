# TaskForge

A cinematic, high-fidelity team task management web application designed for absolute clarity and brutalist efficiency.

## Overview

TaskForge is designed as a "precision task engine." It provides teams with a raw, high-contrast control room for their workflows.

- **Frontend**: React 19, Vite, Tailwind CSS v3, GSAP, Zustand, React Router, TanStack Query, Dnd-Kit, Recharts.
- **Backend**: Express, Prisma ORM, PostgreSQL.
- **Monorepo**: npm workspaces with `apps/web` and `apps/api`.

## Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Database Setup**:
   - Ensure you have a local PostgreSQL instance running.
   - Create a `.env` file in `apps/api` and set your `DATABASE_URL`:
     ```env
     DATABASE_URL="postgresql://user:password@localhost:5432/taskforge?schema=public"
     JWT_SECRET="your_jwt_secret"
     JWT_REFRESH_SECRET="your_refresh_secret"
     PORT=3001
     ```
   - Push the schema to the database:
     ```bash
     cd apps/api
     npx prisma db push
     npx prisma generate
     ```

3. **Start the Development Servers**:
   Run both frontend and backend concurrently from the root directory:
   ```bash
   npm run dev
   ```

## Environment Variables Reference

### Backend (`apps/api/.env`)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for access tokens
- `JWT_REFRESH_SECRET`: Secret key for refresh tokens
- `PORT`: API server port (default 3001)
- `FRONTEND_URL`: CORS origin allowed (e.g., `http://localhost:5173`)
- `NODE_ENV`: Should be `production` on Railway

### Frontend (`apps/web/.env`)
- `VITE_API_URL`: URL of the backend API (e.g., `http://localhost:3001/api`)

## Deployment (Railway)

1. Connect your GitHub repository to Railway.
2. Railway will automatically detect the monorepo structure via `railway.toml`.
3. Provision a **PostgreSQL** plugin in your Railway project.
4. Set the following environment variables in your API service:
   - `DATABASE_URL` (Reference the PostgreSQL plugin)
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `FRONTEND_URL` (The URL of your deployed Vite frontend)
   - `NODE_ENV=production`
5. The `railway.toml` handles the build and start commands for the API and Frontend.

---
*Built with Brutalist Signal Design System.*
