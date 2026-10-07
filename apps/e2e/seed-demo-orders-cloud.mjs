/**
 * Explicit importer for the isolated Railway synthetic-order demo database.
 *
 * Requires production/demo opt-ins and a dedicated database name. It refuses
 * databases containing non-demo orders, non-demo connections, or credentials.
 */
import pg from 'pg';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { insertSeedRows, ORDERS, SEED_ID, SOURCES } from './seed-demo-orders.mjs';
import { assertCloudDemoTarget, DEMO_DATABASE } from './seed-demo-orders-cloud.guard.mjs';
const { Client } = pg;

async function assertNoForeignOrders(client) {
  const values = [];
  const expectedRows = ORDERS.map((order) => {
    values.push(order.internalOrderId, order.sourceConnectionId);
    return `("internalOrderId" = $${values.length - 1} AND "sourceConnectionId" = $${values.length}::uuid)`;
  });
  values.push(SEED_ID);
  const seedIdParameter = values.length;
  const {
    rows: [{ count }],
  } = await client.query(
    `SELECT count(*)::int AS count
       FROM "order_records"
      WHERE NOT COALESCE((
        (${expectedRows.join(' OR ')})
        AND "orderSnapshot"->'demo'->>'seedId' = $${seedIdParameter}
        AND "orderSnapshot"->'demo'->>'synthetic' = 'true'
        AND "orderSnapshot"->'demo'->>'noMarketplaceApi' = 'true'
      ), false)`,
    values
  );
  if (Number(count) > 0) {
    throw new Error('Refusing database containing orders that are not this synthetic demo seed.');
  }
}

async function assertNoForeignConnections(client) {
  const values = [];
  const expectedRows = SOURCES.map((source) => {
    const firstParameter = values.length + 1;
    values.push(source.id, source.platformType, source.name, SEED_ID);
    return `(
      "id" = $${firstParameter}::uuid
      AND "platformType" = $${firstParameter + 1}
      AND "name" = $${firstParameter + 2}
      AND "status" = 'disabled'
      AND "credentialsRef" = 'synthetic-demo-no-credentials'
      AND "adapterKey" IS NULL
      AND "enabledCapabilities" = '[]'::jsonb
      AND "config" = jsonb_build_object('openlinkerDemo', jsonb_build_object(
        'seedId', $${firstParameter + 3}::text,
        'syntheticOnly', true,
        'noExternalCredentials', true
      ))
    )`;
  });
  const {
    rows: [{ count }],
  } = await client.query(
    `SELECT count(*)::int AS count
       FROM "connections"
      WHERE NOT COALESCE((${expectedRows.join(' OR ')}), false)`,
    values
  );
  if (Number(count) > 0) {
    throw new Error('Refusing database containing non-demo or credentialed connections.');
  }
}

async function assertNoStoredCredentials(client) {
  const {
    rows: [{ count }],
  } = await client.query('SELECT count(*)::int AS count FROM "integration_credentials"');
  if (Number(count) > 0) {
    throw new Error('Refusing database containing stored integration credentials.');
  }
}

export async function seedCloudDemoDatabase(client) {
  const {
    rows: [database],
  } = await client.query(
    `SELECT current_database() AS name,
            to_regclass('public.order_records') AS orders,
            to_regclass('public.connections') AS connections,
            to_regclass('public.order_holds') AS holds,
            to_regclass('public.integration_credentials') AS credentials`
  );
  if (
    database.name !== DEMO_DATABASE ||
    !database.orders ||
    !database.connections ||
    !database.holds ||
    !database.credentials
  ) {
    throw new Error(`Target must be a migrated OpenLinker database named ${DEMO_DATABASE}.`);
  }

  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(
      'LOCK TABLE "connections", "order_records", "order_holds", "integration_credentials" IN SHARE ROW EXCLUSIVE MODE'
    );
    await assertNoForeignOrders(client);
    await assertNoForeignConnections(client);
    await assertNoStoredCredentials(client);

    const result = await insertSeedRows(client);
    await client.query('COMMIT');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the failure that triggered the rollback.
      }
    }
    throw error;
  }
}

async function seed() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  };
  assertCloudDemoTarget({
    nodeEnv: process.env.NODE_ENV,
    demoMode: process.env.OL_DEMO_MODE,
    seedConfirmation: process.env.OL_ALLOW_SYNTHETIC_ORDER_SEED,
    target: process.env.OL_DEMO_SEED_TARGET,
    ...config,
  });

  const client = new Client(config);
  await client.connect();
  try {
    const { insertedConnections, insertedOrders, insertedHolds } =
      await seedCloudDemoDatabase(client);
    console.log(
      `Synthetic Railway demo seed complete: ${ORDERS.length} orders, ${insertedOrders} new orders, ` +
        `${insertedConnections} new disabled source labels, ${insertedHolds} new hold rows.`
    );
  } finally {
    await client.end();
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectExecution) {
  seed().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Synthetic Railway demo seed failed.');
    process.exitCode = 1;
  });
}
