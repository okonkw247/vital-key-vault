[README.md](https://github.com/user-attachments/files/26943081/README.md)
# 🔐 Adams X API Vault

> Your personal API key command center — store, monitor, and serve active keys to any project, 24/7.

![Built with React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

---

## What is this?

Adams X API Vault is a full-stack API key management and health monitoring dashboard built for developers who work with AI APIs daily.

The vault automatically checks your key health every 30 minutes, detects when credits are exhausted or a key goes invalid, and flags it instantly on your real-time dashboard. Connect it to any of your projects using a single personal endpoint that always returns your most active key — no more hardcoded keys or silent failures mid-deployment.

---

## Features

- 🐙 **GitHub OAuth** — login with your GitHub account, no passwords
- 📊 **Real-time dashboard** — key status updates live via Supabase Realtime
- 🔑 **Unlimited key storage** — organized by provider and category, supports 100,000+ keys
- 📥 **Bulk import** — import keys via CSV or paste them one per line
- ⚡ **Auto health monitoring** — checks every 30 minutes, tracks credit balance
- 🔗 **External API endpoint** — one URL any project can call to get an active key at runtime
- 🐙 **GitHub repo scanner** — detects AI provider usage across your repositories
- 🔔 **Webhook alerts** — get notified when a key fails or credits run out
- 📋 **Full event log** — every key has a timeline of all status changes

---

## Supported Providers

| Provider | Health Check | Credit Tracking |
|---|---|---|
| OpenRouter | ✅ | ✅ Full credit balance |
| Groq | ✅ | ⚠️ Status only |
| Gemini | ✅ | ⚠️ Status only |
| OpenAI | ✅ | ⚠️ Status only |
| Custom | ✅ | Configure your own endpoint |

---

## Tech Stack

- **Frontend** — React + Vite + TypeScript
- **Styling** — Tailwind CSS + shadcn/ui
- **Backend** — Supabase (Auth, Database, Realtime, Edge Functions)
- **Hosting** — Vercel
- **Health Checks** — Supabase Edge Functions + pg_cron

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/okonkw247/vital-key-vault.git
cd vital-key-vault
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Set up Supabase

Run the SQL schema in your Supabase SQL editor:

```sql
-- See /supabase/schema.sql for full setup
```

Enable GitHub OAuth in Supabase → Authentication → Providers → GitHub

### 5. Deploy Edge Functions

```bash
supabase link --project-ref your-project-ref
supabase functions deploy check-key-health
supabase functions deploy get-active-key
```

### 6. Run locally

```bash
npm run dev
```

---

## External API Usage

Connect any of your projects to always get a working key at runtime:

```javascript
// utils/getApiKey.js
export async function getActiveKey(provider = "openrouter") {
  const res = await fetch(
    `https://your-project-ref.supabase.co/functions/v1/get-active-key?provider=${provider}&token=YOUR_ACCESS_TOKEN`
  );
  const data = await res.json();
  return data.key;
}

// Usage anywhere in your app
const apiKey = await getActiveKey("openrouter");
```

Get your personal access token from the **/integration** page inside the vault.

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

---

## Deployment

This project is deployed on Vercel. Every push to `main` auto-deploys.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/okonkw247/vital-key-vault)

---

## Project Structure

```
vital-key-vault/
├── src/
│   ├── components/     # UI components
│   ├── pages/          # Route pages
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Supabase client + utilities
├── supabase/
│   ├── functions/
│   │   ├── check-key-health/   # Health monitor edge function
│   │   └── get-active-key/     # External API edge function
│   └── schema.sql              # Database schema + RLS policies
└── public/
```

---

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Slack / Discord webhook notifications
- [ ] Auto key rotation (swap exhausted key automatically)
- [ ] Team workspaces (share key pools with collaborators)
- [ ] Usage analytics per key

---

## Author

Built by **Adams** — [Adams X Project](https://github.com/okonkw247)

> Shadow operator. Full-stack developer. Building in public from Nigeria 🇳🇬

---

## License

MIT — use it, fork it, build on it.
