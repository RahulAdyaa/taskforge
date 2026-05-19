# TaskForge ⚡

> **AI-Powered Precision Task Engine** — A cinematic, enterprise-grade project management platform with intelligent task decomposition via OpenRouter AI (Llama 3.3, Nemotron, Qwen and more).

---

## 🎯 What It Does

TaskForge combines the brutalist clarity of a command-room interface with AI intelligence. Drop any objective into the **Analyze & Execute** engine and watch AI break it into 3–6 prioritized, contextually-aware tasks — instantly saved to your project.

### Core Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Task Engine** | Multi-model OpenRouter AI generates unique, context-aware subtasks from any prompt |
| 🗂 **Kanban Board** | Drag-and-drop task management across TODO → IN_PROGRESS → DONE |
| 👥 **Team Management** | Role-based access (ADMIN/MEMBER), invite collaborators by email or link |
| 🔐 **Auth** | JWT + refresh tokens, Google OAuth 2.0, email/password |
| 📊 **Dashboard** | Project analytics — task distribution, priority breakdown, audit logs |
| 💬 **Comments** | Markdown-supported discussion threads per task |
| 🔒 **Dependencies** | Block tasks on other tasks with visual dependency tracking |
| ⏱ **Time Tracking** | Start/stop timers per task with session summaries |
| 📋 **AI Standup** | Auto-generate daily standup reports from your activity |
| 🔔 **Notifications** | Task assignment and completion alerts |
| 💬 **AI Chat** | Ask questions about your project with context-aware AI |

---

## 🛠 Tech Stack

### Frontend (`apps/web`)
- **React 19** + **Vite** — Fast SPA
- **Tailwind CSS v3** — Utility-first styling with custom Brutalist Signal design system
- **GSAP** — Cinematic scroll animations on landing page
- **Zustand** — Lightweight global state (auth, theme)
- **TanStack Query** — Server state, caching, mutations
- **@dnd-kit** — Accessible drag-and-drop for Kanban
- **React Router v7** — Client-side routing
- **Recharts** — Project analytics charts
- **@react-oauth/google** — Google Sign-In

### Backend (`apps/api`)
- **Express.js** — REST API server
- **Mongoose** + **MongoDB Atlas** — Document database with ODM
- **bcrypt** — Password hashing
- **jsonwebtoken** — JWT access/refresh token auth
- **Google Auth Library** — OAuth token verification
- **OpenRouter AI** — Multi-model AI with fallback chain (Llama 3.3 → Nemotron → Qwen → GPT)
- **Zod** — Runtime schema validation

### Infrastructure
- **Vercel** — Serverless deployment (API + Frontend)
- **MongoDB Atlas** — Free M0 cloud database
- **npm workspaces** — Monorepo dependency management

---

## 🚀 Local Setup

### Prerequisites
- Node.js 20+
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (M0 tier)

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
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/taskforge?retryWrites=true&w=majority"
JWT_SECRET="generate-with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
JWT_REFRESH_SECRET="another-strong-random-secret"
PORT=3001
FRONTEND_URL="http://localhost:5173"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
OPENROUTER_API_KEY="your-openrouter-api-key"
```

**Frontend** — copy and fill in `apps/web/.env`:
```bash
cp apps/web/.env.example apps/web/.env
```

```env
VITE_GOOGLE_CLIENT_ID="your-google-oauth-client-id"
```

### 4. Start development servers
```bash
npm run dev
```

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001

---

## 🔑 Getting API Keys

### MongoDB Atlas
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a free M0 cluster
3. Create a database user and get the connection string
4. Whitelist `0.0.0.0/0` for network access (or your specific IPs)

### Google OAuth
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs & Services** → **Credentials**
3. Create **OAuth 2.0 Client ID** (Web Application)
4. Add authorized origins:
   - `http://localhost:5173`
   - `https://your-production-domain.vercel.app`
5. Copy **Client ID** and **Client Secret**

### OpenRouter API Key
1. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
2. Create a free API key
3. Free models (Llama 3.3, Nemotron) available — no billing required

---

## ☁️ Deployment (Vercel)

### Setup
1. Install Vercel CLI: `npm i -g vercel`
2. Link the project: `vercel`
3. Set environment variables in the Vercel dashboard:

```
MONGODB_URI          → (Atlas connection string)
JWT_SECRET           → (strong random string)
JWT_REFRESH_SECRET   → (strong random string)
NODE_ENV             → production
FRONTEND_URL         → https://your-app.vercel.app
GOOGLE_CLIENT_ID     → (from Google Cloud Console)
GOOGLE_CLIENT_SECRET → (from Google Cloud Console)
OPENROUTER_API_KEY   → (from OpenRouter)
```

4. Deploy: `vercel --prod`

---

## 📁 Project Structure

```
taskforge/
├── api/                        # Vercel serverless entry point
│   └── index.js
├── apps/
│   ├── api/                    # Express.js backend
│   │   ├── src/
│   │   │   ├── index.js        # Server entry point
│   │   │   ├── lib/
│   │   │   │   ├── jwt.js      # Token utilities
│   │   │   │   └── database.js # MongoDB connection
│   │   │   ├── middleware/
│   │   │   │   ├── authenticate.js
│   │   │   │   ├── requireProjectRole.js
│   │   │   │   ├── errorHandler.js
│   │   │   │   └── validate.js
│   │   │   ├── models/         # Mongoose schemas
│   │   │   │   ├── User.js
│   │   │   │   ├── Project.js
│   │   │   │   ├── Task.js
│   │   │   │   └── ...
│   │   │   └── routes/
│   │   │       ├── auth.js     # Login, signup, Google OAuth
│   │   │       ├── projects.js # Project CRUD + members + AI chat
│   │   │       ├── tasks.js    # Tasks + AI generation + comments
│   │   │       ├── standup.js  # AI standup reports
│   │   │       └── ...
│   │   └── .env.example
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── components/     # Reusable UI components
│       │   ├── pages/          # Route pages
│       │   ├── store/          # Zustand stores
│       │   └── lib/            # API client (Axios)
│       └── .env.example
├── vercel.json                 # Vercel deployment config
├── package.json                # Workspace root
└── README.md
```

---

## 🤖 AI Task Engine

The AI engine (`POST /api/projects/:id/tasks/ai-generate`) uses **OpenRouter** with a multi-model fallback chain:

1. Accept a plain-English objective (e.g. *"Build a real-time chat app"*)
2. Try models in order: Llama 3.3 70B → Nemotron 120B → Qwen3 Coder → GPT OSS
3. Generate 3–6 unique, prioritized subtasks with titles and priorities
4. Save tasks to MongoDB and log an audit trail entry (`TASK_CREATED_BY_AI`)

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

## 📄 License

MIT © 2026 TaskForge
