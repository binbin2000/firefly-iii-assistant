# Firefly III Assistant

A budgeting-first companion app for Firefly III. The budget module has simple views for the current month and next-month planning, plus a detailed cockpit with inline editing, annual planning, keyboard navigation, quick adjustments, and copy actions.

## Firefly III connection

The app runs with demo data when Firefly credentials are not configured. To connect it to Firefly III, copy `.env.example` to `.env.local` and set:

```bash
FIREFLY_BASE_URL=https://firefly.example.com
FIREFLY_ACCESS_TOKEN=your-personal-access-token
```

Budget data is loaded through the server routes at `/api/budgets/overview` and `/api/budgets/planning`. Planned budget edits are saved through `/api/budgets/limits`, while the next-month workflow uses `/api/budgets/plan` to write both budget limits and Firefly III available-budget amounts.

## Authentication (OIDC)

By default the app has no login wall. To require sign-in through an OIDC provider (Authelia, Keycloak, Authentik, or any standards-compliant IdP), set all of the following in `.env.local`:

```bash
AUTH_SECRET=your-generated-secret   # e.g. `openssl rand -base64 33`
OIDC_ISSUER=https://auth.example.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
```

Register `<your-app-url>/api/auth/callback/oidc` as the redirect URI on the IdP side.

Optional variables:

```bash
AUTH_TRUST_HOST=true                # required when running behind a reverse proxy
AUTH_URL=                           # canonical external origin, if it can't be derived from proxy headers
OIDC_PROVIDER_NAME=Single Sign-On   # label shown on the login button
OIDC_GROUPS_CLAIM=groups            # claim carrying group membership
OIDC_REQUIRED_GROUP=firefly_users   # only members of this group may sign in; leave unset to allow any authenticated user
```

Behavior by configuration state:

- **Unset** (none of `AUTH_SECRET`/`OIDC_ISSUER`/`OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET` set): the app runs open, exactly as without this feature.
- **Partially set**: treated as a misconfiguration — every route is blocked and `/login` shows an error, since a half-configured login wall is more dangerous than an open app.
- **Fully set**: every page and API route requires a signed-in session. If `OIDC_REQUIRED_GROUP` is set, the signed-in account must also carry that value in the configured groups claim, or sign-in is rejected.

Signing out clears only this app's session cookie; it does not end the session at the IdP.

## Local analysis with Ollama

The budget cockpit can send aggregated monthly budget totals to a local Ollama model. Raw Firefly credentials are never sent to Ollama, and model output is treated as a draft that must be reviewed before an existing budget amount is changed. New category ideas are displayed but are not created automatically.

Install Ollama, pull the default model, and make sure the Ollama service is running:

```bash
ollama pull gemma3:4b
ollama serve
```

The defaults work when Next.js runs directly on the host:

```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma3:4b
OLLAMA_TIMEOUT_MS=120000
```

Open the **Local economy analyst** panel to run a full review, request budget drafts, or focus on savings ideas. The server uses Ollama structured outputs and validates the response before returning it to the browser.

## Transaction tagging

The **Transactions** page (linked from the top nav) lists Firefly III transactions that are missing a category or tags. The **Transaction tagging assistant** sends those transactions to the same local Ollama model, which suggests a category and a few short tags for each one. Suggestions are drafts: nothing is written back to Firefly III until you review and apply a suggestion for that specific transaction.

## Docker

Run the app as a single container with Docker Compose:

```bash
docker compose up --build
```

Set the Firefly III connection in `docker-compose.yml`:

```yaml
environment:
  FIREFLY_BASE_URL: "${FIREFLY_BASE_URL:-}"
  FIREFLY_ACCESS_TOKEN: "${FIREFLY_ACCESS_TOKEN:-}"
```

You can either export those values before starting Compose or replace the values directly in `docker-compose.yml`. When both are empty, the container starts with demo data.

The app is exposed on `http://localhost:3000`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

The automated test suite uses Vitest, React Testing Library, and jsdom. Run it once with:

```bash
npm test
```

Use `npm run test:watch` while developing, or `npm run test:coverage` to enforce coverage thresholds and generate an HTML report in `coverage/`. Pull requests and pushes to the main development branches run tests, linting, and a production build in GitHub Actions.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
