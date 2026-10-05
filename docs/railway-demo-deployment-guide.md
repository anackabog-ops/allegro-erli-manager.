# Railway demo deployment

This guide deploys the current order-list demo as four Railway services:
PostgreSQL, Redis, API, and web. It is a small evaluation environment, not a
production-ready marketplace integration. Allegro/Erli connections remain
disabled; no marketplace credentials are needed.

The setup is configured in Railway's dashboard so each monorepo service can use
its own build settings. It does not add Railway config-as-code files whose
support is being phased out. Railway's current deployment and pricing
documentation is linked in [References](#references).

## Before you start

- Push this repository branch to GitHub and authorize Railway to access it.
  For the draft PR, choose `copilot/first-test-run-demo-data`; do not deploy
  `main` unless you explicitly want the merged version.
- Create a Railway project and use one environment (for example, `demo`).
  Do not provision these services for this guide; doing so may incur charges.
- Generate unique secrets locally; enter them only in Railway's service
  variables, never in GitHub, this guide, or a committed `.env`:

  ```sh
  openssl rand -base64 32
  ```

  Generate separate values for `OPENLINKER_CREDENTIALS_ENCRYPTION_KEY`,
  `JWT_SECRET`, `OL_PII_HASH_SALT`, and `OL_BOOTSTRAP_ADMIN_PASSWORD`. Keep the
  encryption key stable for this database; changing it can make saved
  integration credentials unreadable.

## Create the services

Create **PostgreSQL** and **Redis** from Railway's database templates in the
same project/environment. Keep both private; do not enable public TCP proxies.
Use Railway's generated internal connection variables, not public connection
URLs. PostgreSQL must retain its Railway-managed persistent volume. Redis holds
queues and coordination state; if the selected Redis template offers
persistence, enable it, but PostgreSQL remains the durable source of truth.

Create three services from the same GitHub repository and branch:

1. **`migrate`** — a one-shot Railpack service, repository root `/`.
   - Build command: `pnpm install --frozen-lockfile --prod=false`
   - Start command: `pnpm --filter @openlinker/api migration:run`
   - No public domain or health check. Set restart policy to **Never**.
   - Disable automatic deploys; run it manually before each API deploy and
     wait for a successful migration exit. The migration command is
     idempotent. Do not expose this service publicly.

   This service uses the source tree and development dependencies because the
   repository's migration runner uses TypeScript and plugin migration globs.
   The root production Docker image is not a substitute: its Dockerfile
   documents why the demo migration service builds from the `base` stage.

2. **`api`** — Dockerfile builder, repository root `/`, Dockerfile path
   `Dockerfile`.
   - Start command: `node apps/api/dist/apps/api/src/main.js`
   - The Dockerfile's final stage is the worker image, so this explicit start
     command is required to launch the API instead of the worker.
   - Internal port: `3000`; health check path: `/v1/health`.
   - Do not give the API service a public domain until its variables are set.

3. **`web`** — Dockerfile builder, repository root `/`, Dockerfile path
   `apps/web/Dockerfile`.
   - Internal port: `8080` (the unprivileged nginx listener).
   - Set `VITE_API_BASE_URL` as a build-time variable to the API's HTTPS
     public URL, for example `https://<api-domain>.up.railway.app`. This is
     baked into the static bundle; changing it requires a web rebuild.

Set API and web auto-deploys to manual while bootstrapping so an API rollout
cannot race the one-shot migration service. Later, keep the same order for
schema-changing releases: deploy `migrate`, verify success, then deploy `api`,
then rebuild `web` if its API URL changed.

## Variables

Use Railway variable references (adjust `Postgres` and `Redis` to the exact
service names shown in the project). Add database and encryption variables to
both `migrate` and `api`:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DB_HOST` | `${{Postgres.PGHOST}}` |
| `DB_PORT` | `${{Postgres.PGPORT}}` |
| `DB_USERNAME` | `${{Postgres.PGUSER}}` |
| `DB_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `DB_DATABASE` | `${{Postgres.PGDATABASE}}` |
| `OPENLINKER_CREDENTIALS_ENCRYPTION_KEY` | Unique generated secret; same value on `migrate` and `api` |

The app does not assume that the database is named `openlinker`; use Railway's
generated `PGDATABASE` reference. The local demo seed has its own fixed
database-name requirement and is not a Railway seed mechanism.

Add these variables to **`api`**:

| Variable | Value |
|---|---|
| `PORT` | `3000` |
| `REDIS_HOST` | `${{Redis.REDIS_HOST}}` |
| `REDIS_PORT` | `${{Redis.REDIS_PORT}}` |
| `REDIS_PASSWORD` | `${{Redis.REDIS_PASSWORD}}` (if supplied by the Redis template) |
| `JWT_SECRET` | Unique generated secret |
| `OL_PII_HASH_SALT` | Unique generated secret |
| `OL_BOOTSTRAP_ADMIN_PASSWORD` | Unique one-time admin password |
| `OL_DEMO_MODE` | `true` |
| `OL_REGISTRATION_ENABLED` | `false` |
| `OL_CORS_ORIGIN` | Exact web HTTPS origin, with no trailing slash |
| `WEB_URL` | Exact web HTTPS URL |

`OL_DEMO_MODE` and registration are independent switches: explicitly keep
`OL_REGISTRATION_ENABLED=false`. After the first login, change the admin
password in the application and remove the bootstrap-password variable.
Never set database, encryption, JWT, or PII secrets as Vite/build arguments.

## Deploy in order and enable HTTPS

1. Deploy PostgreSQL and Redis and confirm their internal variables are
   available.
2. Deploy `migrate` and check its logs for successful completion. The API
   should not be deployed before this succeeds.
3. Deploy `api`, generate its Railway public domain, and note the complete
   `https://` URL. Railway-managed domains provide HTTPS; do not use an
   `http://` origin in the browser configuration.
4. Set `VITE_API_BASE_URL` on `web` to that API HTTPS URL as a build-time
   variable. Deploy `web`, generate its Railway public domain, and note the
   exact HTTPS origin.
5. Set `OL_CORS_ORIGIN` and `WEB_URL` on `api` to the web HTTPS origin/URL.
   Redeploy the API, then rebuild/redeploy web to confirm its bundle still
   points at the API domain.
6. Open the web URL, sign in with the bootstrap admin credentials, and check
   `https://<api-domain>/v1/health`. Confirm the browser network panel shows
   HTTPS API requests and no CORS errors.

The API health check is public and does not require login. Do not make the
PostgreSQL or Redis services public just to make the health check work.

## Synthetic orders: important limitation

The existing twelve-order seed is deliberately **local-only**. It refuses
`NODE_ENV=production`, requires explicit demo/seed opt-ins, and accepts only
an IPv4 loopback connection on port `35432` to database `openlinker`. It writes
fixed synthetic order IDs and two disabled, credential-less Allegro/Erli
source labels. Those protections are intentional and must not be relaxed for
Railway.

Consequently, there is currently **no supported way to load those twelve
orders into the Railway database**. Do not point the seed at Railway through a
TCP tunnel, change its guard, or paste its inserts into Railway's SQL console.
To view the twelve seeded orders, use the isolated local workflow in
[`synthetic-order-demo.md`](operations/synthetic-order-demo.md). On Railway,
keep the database empty until a separately reviewed, production-safe demo-data
import path exists. With marketplace connections disabled, real Allegro/Erli
order ingestion is also unavailable.

## Scope and cost estimate

This is a shared, publicly reachable demo containing synthetic order data. It
is not hardened for real customer data or production order processing. The
four-service setup omits the worker; background jobs, scheduled syncs, and
queued work will not be processed. Do not add marketplace credentials or enable
the disabled demo source rows. Back up the PostgreSQL volume before upgrades
and remove the Railway environment when the demo is no longer needed.

As a rough **always-on** example, assume 730 hours/month, average resident
memory of 0.5 GiB for API, 0.5 GiB for PostgreSQL, 0.25 GiB for Redis, and
0.125 GiB for web (1.375 GiB total); 0.2 average vCPU across the services;
5 GiB of PostgreSQL volume; and 5 GiB monthly egress. At Railway's published
approximate rates of $10/GiB-month of RAM, $20/vCPU-month, $0.15/GiB-month of
volume, and $0.05/GiB egress, that is approximately:

| Resource | Calculation | Estimate |
|---|---:|---:|
| Memory | 1.375 × $10 | $13.75 |
| CPU | 0.2 × $20 | $4.00 |
| PostgreSQL volume | 5 × $0.15 | $0.75 |
| Egress | 5 × $0.05 | $0.25 |
| **Total usage** |  | **about $18.75/month** |

This is an estimate, not a cap or a promise to stay below €20. It excludes tax,
exchange-rate movement, build usage, backups, and traffic spikes; sustained
memory/CPU may be higher. At an illustrative $1 = €0.92 it is about €17.25
before tax, but modestly higher usage can exceed €20. Railway's Hobby plan
minimum is $5/month and includes $5 in usage credits; it is not an additional
$5 on top of the usage estimate. Check the live pricing page and usage
dashboard before leaving the environment running.

## References

- [Railway monorepo deployments](https://docs.railway.com/deployments/monorepo)
- [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)
- [Railway PostgreSQL guide](https://docs.railway.com/guides/postgresql)
- [Railway private networking](https://docs.railway.com/guides/private-networking)
- [Railway pricing](https://docs.railway.com/pricing)
- [OpenLinker local synthetic order procedure](operations/synthetic-order-demo.md)
