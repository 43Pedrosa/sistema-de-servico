## 🚀 Aplicativo publicado

Acesse o sistema: https://sistema-de-ordens-de-servico.vercel.app/

## 🛠️ Tecnologias utilizadas

- React
- TypeScript
- Vite
- Supabase
- Vercel<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b09e5f1a-265b-4c39-a0fb-6a9f5f90ebe5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Login, Supabase, and Vercel

Administrator login is independent of Supabase Auth and the database. The backend checks `ADMIN_USERNAME` and a private scrypt hash in `ADMIN_PASSWORD_HASH`, then issues an HttpOnly, SameSite=Strict cookie signed with `ADMIN_SESSION_SECRET`. The `/admin` routes and administrative APIs validate that cookie; `/consultar` remains public.

### Configure locally

Run `npm run admin:set-password -- MINHALOJA2026` in an interactive terminal. Enter the password in the hidden prompts; the script saves its scrypt hash and a random session-signing secret to `.env.local`. The login reads only these server-side settings and works when Supabase is unavailable.

For order storage and public order lookup, configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` separately. Never expose the service-role key in a `VITE_` variable. Start the app with `npm run dev` and open `http://localhost:3000/admin/login`.

### Configure Vercel

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET` in the Vercel server environment. Keep the password hash and session secret private. Redeploy after changing these values.

Login attempts are limited to five per 15 minutes per username and client address in each running server process. The limiter is in-memory and is not shared across serverless instances. Changing the password hash or session secret invalidates existing login cookies.

The connected database already contained the schema through migration `011`. Its migration history was empty before migration `012_supabase_auth_and_security_hardening` was applied. Do not rerun `001`–`011` against this database. Migration `012` hardens public database access and is separate from login. Reconcile existing migration history before automated migration deployments.

Order photos remain in the private `service-order-photos` bucket and are served with temporary signed URLs. Customers can approve pending budgets from the public order page; this advances the order and publishes its update.

Apply the Supabase migrations in order, including `010_administrative_progress_and_budget_rejection.sql`, to persist the administrative form step and customer budget rejections. Existing orders start at step 4 to preserve the previous edit-form default; newly created orders start at step 1.

Run the automated authentication/session checks, type check, and production build with:

```powershell
npm test
npm run lint
npm run build
```

The Vercel project needs to build the Vite app from the repository root and publish `dist`; `vercel.json` rewrites the client-side routes while leaving the approval API route available.
