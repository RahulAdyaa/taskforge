# 🎬 TaskForge — Demo Video Script (2–5 min)

---

## [0:00–0:30] Landing Page Tour

**Navigate to:** `https://taskforge-app-production-f996.up.railway.app`
*Scroll slowly down the page as you speak.*

**Say:**
> "This is TaskForge — an AI-powered precision task engine built for teams that need
> brutal clarity in their workflows.
>
> The landing page gives you the core promise upfront: create a project, assign tasks,
> and track everything in real time. Scroll down and you can see the three-step workflow
> — Create, Assign, Track — and the pricing tiers. The design is intentionally minimal
> and high-contrast to keep the focus on execution."

---

## [0:30–1:00] Sign Up / Login

**Navigate to:** `/signup` or click "Authenticate"

**Say:**
> "Let me sign in. TaskForge supports email and password authentication with JWT tokens,
> plus Google OAuth for one-click sign-in.
>
> I'll log in with my existing account."

*Enter credentials and log in. Dashboard appears.*

**Say:**
> "And we're in. This is the projects dashboard — your operational command center."

---

## [1:00–1:30] Create a New Project

*Click the "New Project" button.*

**Say:**
> "Let me create a fresh project to demo the AI engine."

*Type a project name — e.g. `FitTrack App` — and submit.*

**Say:**
> "Project created. I'm automatically the Admin here, which means I have full control
> — I can manage tasks, invite teammates, and configure the board."

*Click the project to open it.*

---

## [1:30–2:30] AI Engine Demo

*Find and click the "Analyze & Execute" / AI button in the project view.*

**Say:**
> "Now here's the most powerful feature — the AI Task Engine, powered by Google
> Gemini 2.5 Flash.
>
> Instead of manually creating tasks one by one, I just describe my objective in
> plain English and let the AI do the decomposition."

*Type into the prompt field:*
```
Build a mobile fitness tracking app
```

*Click "Execute Breakdown" and wait.*

**Say:**
> "I'm sending this to Gemini 2.5 Flash right now. It's not using templates or
> keywords — it's actually reasoning about the objective and generating a unique,
> prioritized breakdown."

*Tasks appear on the Kanban board.*

**Say:**
> "And there we go — Gemini generated several tasks, each with a title, description,
> and priority. Notice the priorities are contextually assigned: setting up
> authentication is HIGH, UI polish is LOW. This is real AI thinking, not hardcoded
> responses."

---

## [2:30–3:30] Task Details — Comment, Dependency, Delete

*Double-click on one of the generated tasks.*

**Say:**
> "Let me open a task. Every task has a full detail view — you can see the
> description, priority, status, and assignee.
>
> I can add a comment here — this supports full Markdown syntax, so teams can have
> rich discussions directly on the task."

*Type a comment and post it.*

**Say:**
> "Comments are threaded per task and tied to your user identity.
>
> I can also set task dependencies — if this task is blocked by another one, I
> select it here. TaskForge tracks that relationship visually."

*Add a blocker from the dropdown.*

**Say:**
> "And if I need to delete a task — say it was generated incorrectly — I click the
> Delete button up here, confirm, and it's permanently removed."

*Click Delete → confirm.*

---

## [3:30–4:00] Kanban Drag-and-Drop + Real-time

*Back on the main Kanban board.*

**Say:**
> "The Kanban board has four columns: TODO, IN PROGRESS, REVIEW, and DONE.
> Every card is draggable."

*Drag a task from TODO → IN PROGRESS, then another → DONE.*

**Say:**
> "When I drag a card, the change is saved instantly to the database and broadcast
> via Socket.IO to all team members in real time — if a teammate is viewing this
> same project right now, they'd see this update live without refreshing the page."

---

## [4:00–4:30] Dashboard Analytics

*Click the "Dashboard" tab.*

**Say:**
> "Switching to the dashboard view gives you a live project overview — task
> distribution across statuses, priority breakdown, and the full audit log showing
> every action taken on this project, including which tasks were AI-generated."

*Point at the charts and audit log.*

**Say:**
> "This gives project leads full visibility without needing to chase anyone for
> updates."

---

## [4:30–5:00] Deployment & Wrap Up

*Stay on the app — no need to switch tabs.*

**Say:**
> "TaskForge is deployed as a monorepo on Railway — the React frontend, Express API,
> and PostgreSQL database all running together. The railway.toml handles the build
> and start commands automatically.
>
> The full source code is on GitHub at github.com/RahulAdyaa/taskforge, with a
> complete README covering local setup, environment variables, and one-click Railway
> deployment.
>
> To summarize: TaskForge gives teams an AI-powered command center where any
> objective becomes an actionable, prioritized task breakdown in seconds — backed by
> real-time collaboration and a clean, high-fidelity interface. Thanks for watching."

---

## 📌 Recording Tips

- **Tool:** QuickTime Player → File → New Screen Recording
- **Resolution:** Full screen at 1080p or higher
- **Mic:** Use headphones with a built-in mic to avoid echo
- **Before recording:** Clear browser tabs, set zoom to 100%, close notifications
- **Pacing:** Speak slowly — you have 5 minutes, don't rush
