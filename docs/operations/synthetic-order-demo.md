# Synthetic order-list demo

This procedure adds twelve visibly synthetic orders to a **separate local
OpenLinker demo database**. It does not contact Allegro or Erli and does not
create working marketplace integrations.

The seed also adds one explicitly labelled, disabled connection row per source.
These rows exist only so the order list can display Allegro/Erli and its source
filter can be exercised. They have no credentials, no enabled capabilities,
and cannot be used to connect to a marketplace. Do not enable them.

## Start an isolated database and app

From the repository root, create a private local Compose environment file.
Keep the encryption key in that ignored file; do not commit it:

```bash
cp .env.example .env
```

Set these values in `.env` so this stack gets its own container/volume and
loopback-only ports:

```dotenv
COMPOSE_PROJECT_NAME=ol-synthetic-demo
POSTGRES_HOST_PORT=35432
REDIS_HOST_PORT=36379
API_HOST_PORT=33000
WEB_HOST_PORT=38090
OL_DEMO_MODE=true
OL_REGISTRATION_ENABLED=false
```

Generate `OPENLINKER_CREDENTIALS_ENCRYPTION_KEY` locally as described in
`.env.example`. Then start only the services required for the order interface:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml \
  up -d --build postgres redis migrate api web
```

The database is in the `ol-synthetic-demo` Compose volume and is separate from
the ordinary development stack. The ports bind to loopback only.

## Seed and verify

Run this explicit command from the repository root. It requires both opt-in
flags, refuses `NODE_ENV=production` and non-loopback/non-demo database
settings, and writes only its fixed IDs using conflict-do-nothing inserts:

```bash
OL_DEMO_MODE=true \
OL_ALLOW_SYNTHETIC_ORDER_SEED=YES \
OL_DEMO_PGHOST=127.0.0.1 \
OL_DEMO_PGPORT=35432 \
OL_DEMO_PGDATABASE=openlinker \
pnpm --filter @openlinker/e2e seed:demo-orders
```

Run the same command again to verify idempotency. It reports newly inserted
rows; it does not update or delete existing records. To verify persisted data
after restarting the API:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml restart api
```

Then open the web UI from the machine running Docker and sign in with the
locally configured demo admin credentials. The default is `admin` / `admin`
only when `OL_BOOTSTRAP_ADMIN_PASSWORD` is unset; never expose that default on
a network.

The demo buyer identity, addresses, phone numbers, offers, products, and
delivery are synthetic. No order is sent or dispatched. Internal order notes
are not part of this seed; the detail activity shows the seeded hold notes and
the existing hold history.
