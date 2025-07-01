# 🚀 FuncDock

## 📚 Documentation Index

- [SETUP](SETUP_README.md)
- [USAGE](USAGE_README.md)
- [DEPLOYMENT](DEPLOYMENT_README.md)
- [CLI](CLI_README.md)
- [CRON JOBS](CRONJOBS_README.md)
- [DASHBOARDS](DASHBOARDS_README.md)
- [TESTING](TESTING_README.md)
- [TROUBLESHOOTING](TROUBLESHOOTING_README.md)
- [CONTRIBUTING](CONTRIBUTING_README.md)
- [SECURITY](SECURITY_README.md)

---

# 🚀 FuncDock — The Ultimate Node.js FaaS Platform

> **Build, run, and deploy issolated Node.js functions (FaaS) in a sigle container, hot start & reload, real-time dashboards, and zero friction.**

---

## 🤩 Why FuncDock?

- **All your functions, one container.**
- **Instant hot reload** — Save code, see it live. No restarts.
- **Real-time dashboard** — Logs, metrics, routes, and cron jobs at a glance.
- **Git & local deploys** — Push from anywhere, CI/CD ready.
- **Built-in cron jobs** — Schedule anything, with timezone support.
- **Automatic logging** — Every function gets a logger, no setup.
- **Per-function env vars** — Secrets and configs, isolated and hot-reloaded.
- **Dev to prod in seconds** — Docker, Makefile, and npm scripts for every workflow.
- **Security & alerting** — Route conflict prevention, Slack alerts, CORS, and more.

---

## ⚡️ See It In Action

### 1. Write a Function (with logging & env)

```js
// functions/hello-world/handler.js
export default async function handler(req, res) {
  const { logger, env, method, query } = req;
  logger.info('Hello handler called', { method, env: !!env });
  res.json({
    message: `Hello, ${query.name || 'World'}!`,
    env: env.MY_SECRET,
    time: new Date().toISOString()
  });
}
```

### 2. Add a Cron Job

```json
// functions/hello-world/cron.json
{
  "jobs": [
    {
      "name": "daily-greet",
      "schedule": "0 9 * * *",
      "handler": "cron-handler.js",
      "timezone": "UTC",
      "description": "Say hello every day at 9am UTC"
    }
  ]
}
```

```js
// functions/hello-world/cron-handler.js
export default async function handler(req) {
  req.logger.info('Cron job running!', { time: new Date() });
  // ...do your scheduled work
}
```

### 3. Hot Reload, Instantly

- Edit any function or config — FuncDock reloads it live, no downtime.
- Add new functions or routes — They appear instantly in the dashboard.

### 4. Real-Time Dashboard

- **Visualize**: See all functions, routes, logs, and cron jobs.
- **Debug**: Watch logs update live as you hit endpoints.
- **Manage**: Trigger reloads, view health, and more.

![Dashboard Screenshot](public/dashboard/assets/index.html)

### 5. Deploy & Manage with CLI or Makefile

```bash
make create-function NAME=api
make deploy-git REPO=https://github.com/user/api.git NAME=api
make reload
npm run logs
```

---

## 🏁 Quick Start

```bash
# 1. Install & setup
npm install
npm run setup

# 2. Start dev server
npm run dev
# or, with Docker
make quickstart
```

---

## 💡 What Makes FuncDock Different?

- **Zero config onboarding** — Drop in your functions, start coding.
- **Per-function everything** — Env, logs, routes, cron, all isolated.
- **Production parity** — Test in Docker, deploy with confidence.
- **Open source, MIT licensed** — Yours to hack, extend, and share.

---

## 👇 Dive Deeper

See the technical docs for all the details:

- [SETUP](SETUP_README.md) | [USAGE](USAGE_README.md) | [DEPLOYMENT](DEPLOYMENT_README.md) | [CLI](CLI_README.md) | [CRON JOBS](CRONJOBS_README.md) | [DASHBOARDS](DASHBOARDS_README.md) | [TESTING](TESTING_README.md) | [TROUBLESHOOTING](TROUBLESHOOTING_README.md) | [CONTRIBUTING](CONTRIBUTING_README.md) | [SECURITY](SECURITY_README.md)

---

FuncDock is built for developers who want power, speed, and joy. [Get started now!](SETUP_README.md)
