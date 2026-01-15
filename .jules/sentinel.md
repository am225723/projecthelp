# Sentinel's Journal

## 2025-02-17 - CRON_SECRET Leak via NEXT_PUBLIC_
**Vulnerability:** The `CRON_SECRET` was exposed to the client-side code by aliasing it to `NEXT_PUBLIC_CRON_SECRET`. This allowed any user (or attacker) visiting the dashboard to retrieve the secret and trigger the expensive/sensitive triage job arbitrarily.
**Learning:** Developers sometimes expose secrets to the client to make "manual triggers" work, forgetting that `NEXT_PUBLIC_` variables are embedded in the build.
**Prevention:** Use Next.js Server Actions or a dedicated Backend-for-Frontend (BFF) API route to handle manual triggers. Verify that sensitive keys like `CRON_SECRET` are never prefixed with `NEXT_PUBLIC_`.
