# TaskForge ⚡

> **AI-Powered Precision Task Engine** — A cinematic, enterprise-grade project management platform where Google Gemini 2.5 Flash intelligently decomposes any objective into actionable, prioritized subtasks.

🔗 **Live App**: https://taskforge-app-production-f996.up.railway.app

---

## 🎯 What It Does

TaskForge combines the brutalist clarity of a command-room interface with the intelligence of Google's Gemini 2.5 Flash AI. Drop any objective into the **Analyze & Execute** engine and watch AI break it into 3–6 prioritized, contextually-aware tasks — instantly saved to your project.

### Core Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Task Engine** | Gemini 2.5 Flash generates unique, context-aware subtasks from any prompt |
| 🗂 **Kanban Board** | Drag-and-drop task management across TODO → IN_PROGRESS → REVIEW → DONE |
| 👥 **Team Management** | Role-based access (ADMIN/MEMBER), invite collaborators by email |
| 🔐 **Auth** | JWT + refresh tokens, Google OAuth 2.0, email/password |
| ⚡ **Real-time** | Socket.IO live updates — task changes sync instantly across all team members |
| 📊 **Dashboard** | Project analytics — task distribution, priority breakdown, audit logs |
| 💬 **Comments** | Markdown-supported discussion threads per task |
| 🔒 **Dependencies** | Block tasks on other tasks with visual dependency tracking |
| 🗑 **Task Delete** | Permanent task deletion with confirmation |

---

## 🛠 Tech Stack

### Frontend (`apps/web`)
- **React 19** + **Vite** — Fast SPA
- **Tailwind CSS v3** — Utility-first styling with custom Brutalist Signal design system
- **GSAP** — Cinematic scroll animations on landing page
- **Zustand** — Lightweight global state (auth)
- **TanStack Query** — Server state, caching, mutations
- **@dnd-kit** — Accessible drag-and-drop for Kanban
- **React Router v7** — Client-side routing
- **Socket.IO Client** — Real-time task updates
- **Recharts** — Project analytics charts
- **@react-oauth/google** — Google Sign-In

### Backend (`apps/api`)
- **Express.js** — REST API server
- **Prisma ORM** + **PostgreSQL** — Type-safe database access
- **Socket.IO** — WebSocket real-time layer
- **bcrypt** — Password hashing
- **jsonwebtoken** — JWT access/refresh token auth
- **Google Auth Library** — OAuth token verification
- **@google/generative-ai** — Gemini 2.5 Flash integration
- **Zod** — Runtime schema validation

### Infrastructure
- **Railway** — Monorepo hosting (API + Frontend + PostgreSQL)
- **npm workspaces** — Monorepo dependency management

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (local) or a free [Railway](https://railway.app) PostgreSQL instance

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/taskforge.git
cd taskforge
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables

**Backend** — copy and fill in `apps/api/.env`:
```bash
cp apps/api/.env.example apps/api/.env
```

```env
DATABASE_URL="postgresql://user:password@localhost:5432/taskforge?schema=public"
JWT_SECRET="generate-with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
JWT_REFRESH_SECRET="another-strong-random-secret"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
GEMINI_API_KEY="your-gemini-api-key"
```

**Frontend** — copy and fill in `apps/web/.env`:
```bash
cp apps/web/.env.example apps/web/.env
```

```env
VITE_GOOGLE_CLIENT_ID="your-google-oauth-client-id"
VITE_API_URL=""
```

### 4. Set up the database
```bash
cd apps/api
npx prisma db push
npx prisma generate
cd ../..
```

### 5. Start development servers
```bash
npm run dev
```

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001

---

## 🔑 Getting API Keys

### Google OAuth
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs & Services** → **Credentials**
3. Create **OAuth 2.0 Client ID** (Web Application)
4. Add authorized origins:
   - `http://localhost:5173`
   - `https://your-production-domain.com`
5. Copy **Client ID** and **Client Secret**

### Gemini API Key
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **Create API key**
3. Free tier available — no billing required

---

## ☁️ Deployment (Railway)

### One-click deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Manual deployment
1. Fork this repository
2. Create a new [Railway](https://railway.app) project
3. Connect your GitHub repo
4. Add a **PostgreSQL** plugin to your project
5. Set these environment variables in Railway:

```
DATABASE_URL         → (auto-set by PostgreSQL plugin)
JWT_SECRET           → (strong random string)
JWT_REFRESH_SECRET   → (strong random string)
NODE_ENV             → production
FRONTEND_URL         → https://your-app.up.railway.app
GOOGLE_CLIENT_ID     → (from Google Cloud Console)
GOOGLE_CLIENT_SECRET → (from Google Cloud Console)
GEMINI_API_KEY       → (from Google AI Studio)
VITE_GOOGLE_CLIENT_ID → (same as GOOGLE_CLIENT_ID)
```

6. Railway auto-detects the `railway.toml` and deploys both frontend and API.

---

## 📁 Project Structure

```
taskforge/
├── apps/
│   ├── api/                    # Express.js backend
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   ├── src/
│   │   │   ├── index.js        # Server entry point
│   │   │   ├── lib/
│   │   │   │   ├── jwt.js      # Token utilities
│   │   │   │   └── prisma.js   # DB client
│   │   │   ├── middleware/
│   │   │   │   ├── authenticate.js
│   │   │   │   └── validate.js
│   │   │   └── routes/
│   │   │       ├── auth.js     # Login, signup, Google OAuth
│   │   │       ├── projects.js # Project CRUD + members
│   │   │       └── tasks.js    # Tasks + AI generation
│   │   └── .env.example
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── components/     # Reusable UI components
│       │   ├── pages/          # Route pages
│       │   ├── store/          # Zustand auth store
│       │   └── lib/            # API client
│       └── .env.example
├── railway.toml                # Railway deployment config
├── package.json                # Workspace root
└── README.md
```

---

## 🤖 AI Task Engine

The AI engine (`POST /api/projects/:id/tasks/ai-generate`) uses **Gemini 2.5 Flash** to:

1. Accept a plain-English objective (e.g. *"Build a real-time chat app"*)
2. Generate 3–6 unique, prioritized subtasks with titles, descriptions, and priorities
3. Save tasks to the database and emit real-time Socket.IO events
4. Log an audit trail entry (`TASK_CREATED_BY_AI`)

```js
// Example prompt → AI response
Input: "Build a payment integration with Stripe"

Output tasks:
- [URGENT] Set up Stripe account and API keys
- [HIGH]   Design payment flow and webhook handlers  
- [HIGH]   Implement checkout session endpoint
- [MEDIUM] Add payment confirmation emails
- [LOW]    Write integration tests
```

---

## 👤 Default Demo Account

A demo account is available on the live app:
- **Email**: demo@taskforge.com
- **Password**: demo1234

---

## 📄 License

MIT © 2026 TaskForge
