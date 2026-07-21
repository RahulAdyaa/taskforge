# TaskForge Setup & Run Guide

TaskForge is structured as an NPM Monorepo using Workspaces, meaning both the backend (`apps/api`) and frontend (`apps/web`) are managed from the root directory.

## 🚀 1. Installation

Run this command from the **root directory** to install dependencies for both the frontend and backend simultaneously:

```bash
npm install
```

## ⚙️ 2. Environment Variables

Before starting the server, you need to configure the environment variables for both applications.

### Backend (`apps/api/.env`)
Copy the template and fill in your details:
```bash
cp apps/api/.env.example apps/api/.env
```
**Required Variables:**
- `MONGODB_URI`: Your MongoDB connection string.
- `JWT_SECRET` & `JWT_REFRESH_SECRET`: Secure random strings for authentication.
- `SMTP_*`: Your email provider details (e.g., Gmail SMTP) to send deadline notifications.
- `CRON_SECRET`: A secure string used to authenticate Vercel Cron jobs.

### Frontend (`apps/web/.env`)
Copy the template:
```bash
cp apps/web/.env.example apps/web/.env
```
**Required Variables:**
- `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth Client ID (must match the backend).

---

## 💻 3. Running Locally (Development)

To start **both** the backend API and frontend Vite server concurrently, run this from the root directory:

```bash
npm run dev
```

- **Frontend**: Available at `http://localhost:5173`
- **Backend API**: Available at `http://localhost:3001`

*(If you only want to run them individually, you can use `npm run dev --workspace=apps/api` or `npm run dev --workspace=apps/web`)*

---

## 🏗️ 4. Building for Production

To build the project for a production environment (compiles the React frontend):

```bash
npm run build
```

The compiled frontend assets will be located in `apps/web/dist`. 

If you are running the backend Node server manually in production, you can then start it with:
```bash
npm start
```
*Note: In production mode (`NODE_ENV=production`), the Express backend will automatically serve the static compiled frontend files from `apps/web/dist`.*

---

## ☁️ 5. Vercel Deployment (CLI)

This project is configured for serverless deployment on Vercel via the `vercel.json` and `api/index.js` files. 
You can easily deploy it from your terminal using the Vercel CLI.

### Step 1: Install Vercel CLI
If you haven't installed the Vercel CLI globally, run:
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
Authenticate your machine with your Vercel account:
```bash
vercel login
```

### Step 3: Deploy (Preview Environment)
Run the following command from the **root directory** to create a preview deployment. You will be prompted to link your local project to a Vercel project:
```bash
vercel
```
*Accept the default prompts (e.g., Set up and deploy? `Y`, Which scope? `<your-username>`, Link to existing project? `N`, What's your project's name? `taskforge`, In which directory is your code located? `./`)*

### Step 4: Configure Environment Variables
You must set your environment variables (from `apps/api/.env` and `apps/web/.env`) in the Vercel Dashboard for the project to work:
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and select your new project.
2. Navigate to **Settings > Environment Variables**.
3. Add all required variables (including `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, etc.).
4. **CRITICAL:** Add `CRON_SECRET` to secure the deadline scheduler. (e.g., `super-secret-cron-key-123`).

### Step 5: Deploy to Production
Once your environment variables are configured, push the deployment to production:
```bash
vercel --prod
```

Your app is now live, and Vercel will automatically trigger your cron jobs every minute to send deadline notifications!

