<<<<<<< HEAD
# Supabase CLI

[![Coverage Status](https://coveralls.io/repos/github/supabase/cli/badge.svg?branch=develop)](https://coveralls.io/github/supabase/cli?branch=develop) [![Bitbucket Pipelines](https://img.shields.io/bitbucket/pipelines/supabase-cli/setup-cli/master?style=flat-square&label=Bitbucket%20Canary)](https://bitbucket.org/supabase-cli/setup-cli/pipelines) [![Gitlab Pipeline Status](https://img.shields.io/gitlab/pipeline-status/sweatybridge%2Fsetup-cli?label=Gitlab%20Canary)
](https://gitlab.com/sweatybridge/setup-cli/-/pipelines)

[Supabase](https://supabase.io) is an open source Firebase alternative. We're building the features of Firebase using enterprise-grade open source tools.

This repository contains all the functionality for Supabase CLI.

- [x] Running Supabase locally
- [x] Managing database migrations
- [x] Creating and deploying Supabase Functions
- [x] Generating types directly from your database schema
- [x] Making authenticated HTTP requests to [Management API](https://supabase.com/docs/reference/api/introduction)

## Getting started

### Install the CLI

Available via [NPM](https://www.npmjs.com) as dev dependency. To install:

```bash
npm i supabase --save-dev
```

When installing with yarn 4, you need to disable experimental fetch with the following nodejs config.

```
NODE_OPTIONS=--no-experimental-fetch yarn add supabase
```

> **Note**
For Bun versions below v1.0.17, you must add `supabase` as a [trusted dependency](https://bun.sh/guides/install/trusted) before running `bun add -D supabase`.

<details>
  <summary><b>macOS</b></summary>

  Available via [Homebrew](https://brew.sh). To install:

  ```sh
  brew install supabase/tap/supabase
  ```

  To install the beta release channel:
  
  ```sh
  brew install supabase/tap/supabase-beta
  brew link --overwrite supabase-beta
  ```
  
  To upgrade:

  ```sh
  brew upgrade supabase
  ```
</details>

<details>
  <summary><b>Windows</b></summary>

  Available via [Scoop](https://scoop.sh). To install:

  ```powershell
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```

  To upgrade:

  ```powershell
  scoop update supabase
  ```
</details>

<details>
  <summary><b>Linux</b></summary>

  Available via [Homebrew](https://brew.sh) and Linux packages.

  #### via Homebrew

  To install:

  ```sh
  brew install supabase/tap/supabase
  ```

  To upgrade:

  ```sh
  brew upgrade supabase
  ```

  #### via Linux packages

  Linux packages are provided in [Releases](https://github.com/supabase/cli/releases). To install, download the `.apk`/`.deb`/`.rpm`/`.pkg.tar.zst` file depending on your package manager and run the respective commands.

  ```sh
  sudo apk add --allow-untrusted <...>.apk
  ```

  ```sh
  sudo dpkg -i <...>.deb
  ```

  ```sh
  sudo rpm -i <...>.rpm
  ```

  ```sh
  sudo pacman -U <...>.pkg.tar.zst
  ```
</details>

<details>
  <summary><b>Other Platforms</b></summary>

  You can also install the CLI via [go modules](https://go.dev/ref/mod#go-install) without the help of package managers.

  ```sh
  go install github.com/supabase/cli@latest
  ```

  Add a symlink to the binary in `$PATH` for easier access:

  ```sh
  ln -s "$(go env GOPATH)/bin/cli" /usr/bin/supabase
  ```

  This works on other non-standard Linux distros.
</details>

<details>
  <summary><b>Community Maintained Packages</b></summary>

  Available via [pkgx](https://pkgx.sh/). Package script [here](https://github.com/pkgxdev/pantry/blob/main/projects/supabase.com/cli/package.yml).
  To install in your working directory:

  ```bash
  pkgx install supabase
  ```

  Available via [Nixpkgs](https://nixos.org/). Package script [here](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/supabase-cli/default.nix).
</details>

### Run the CLI

```bash
supabase bootstrap
```

Or using npx:

```bash
npx supabase bootstrap
```

The bootstrap command will guide you through the process of setting up a Supabase project using one of the [starter](https://github.com/supabase-community/supabase-samples/blob/main/samples.json) templates.

## Docs

Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).

## Breaking changes

We follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.

However, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in package.json.

## Developing

To run from source:

```sh
# Go >= 1.22
go run . help
```
=======
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

## Security

### How Your Keys Are Stored

- All keys stored in your own Supabase project
- Row Level Security (RLS) enabled on all tables
- Only you can read your own keys
- No keys are ever logged, shared, or readable by anyone else
- GitHub OAuth only — no passwords stored anywhere

### Self Hosting

Don't want to use the hosted version? Clone the repo and deploy your own instance:

1. Fork the repo
2. Create your own Supabase project
3. Run the SQL schema
4. Deploy to Vercel
5. Add your own environment variables

### Reporting Security Issues

Found a vulnerability? Open a GitHub issue or email the maintainer directly. Security issues are treated as highest priority.

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
>>>>>>> 653b5a4d51c1b150d9856c7a8ca0c7d78ff5dc60
