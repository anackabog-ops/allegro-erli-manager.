/**
 * PostgreSQL integration tests for the guarded Railway demo seed.
 *
 * Requires OL_DEMO_SEED_TEST_DATABASE_URL to point to a disposable local
 * PostgreSQL database named openlinker_demo. The suite creates its fixture
 * tables and clears them between cases.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, after, describe, test } from 'node:test';
import pg from 'pg';
import { ORDERS } from './seed-demo-orders.mjs';
import { seedCloudDemoDatabase } from './seed-demo-orders-cloud.mjs';

const databaseUrl = process.env.OL_DEMO_SEED_TEST_DATABASE_URL;
const { Client } = pg;
let client;

describe('Railway synthetic order seed PostgreSQL integration', { skip: !databaseUrl }, () => {
  before(async () => {
    const parsed = new URL(databaseUrl);
    if (
      parsed.pathname !== '/openlinker_demo' ||
      !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
    ) {
      throw new Error(
        'OL_DEMO_SEED_TEST_DATABASE_URL must point to local disposable database openlinker_demo.'
      );
    }
    client = new Client(databaseUrl);
    await client.connect();
    const {
      rows: [database],
    } = await client.query('SELECT current_database() AS name');
    if (database.name !== 'openlinker_demo') {
      throw new Error('Integration test connected to an unexpected database.');
    }

    await client.query(`
      DROP TABLE IF EXISTS "order_holds", "order_records", "integration_credentials", "connections";
      CREATE TABLE "connections" (
        "id" uuid PRIMARY KEY,
        "platformType" text NOT NULL,
        "name" text NOT NULL,
        "status" text NOT NULL,
        "config" jsonb NOT NULL,
        "credentialsRef" text NOT NULL,
        "adapterKey" text,
        "enabledCapabilities" jsonb NOT NULL
      );
      CREATE TABLE "integration_credentials" ("id" text PRIMARY KEY);
      CREATE TABLE "order_records" (
        "internalOrderId" text PRIMARY KEY,
        "customerId" text,
        "sourceConnectionId" uuid,
        "sourceEventId" text,
        "orderSnapshot" jsonb,
        "syncStatus" jsonb,
        "recordStatus" text,
        "mappingFailureReason" text,
        "cancelledAt" timestamptz,
        "activeHoldReason" text,
        "createdAt" timestamptz,
        "updatedAt" timestamptz,
        "placedAt" timestamptz,
        "currency" text,
        "taxTreatment" text,
        "totalAmount" numeric,
        "totalTaxTreatment" text
      );
      CREATE TABLE "order_holds" (
        "id" uuid PRIMARY KEY,
        "internalOrderId" text NOT NULL,
        "reason" text NOT NULL,
        "note" text NOT NULL,
        "placedByUserId" text NOT NULL,
        "placedByService" text,
        "placedAt" timestamptz NOT NULL,
        "releasedAt" timestamptz
      );
    `);
  });

  beforeEach(async () => {
    await client.query(
      'TRUNCATE TABLE "order_holds", "order_records", "integration_credentials", "connections"'
    );
  });

  after(async () => {
    if (client) {
      await client.query(
        'DROP TABLE IF EXISTS "order_holds", "order_records", "integration_credentials", "connections"'
      );
      await client.end();
    }
  });

  test('inserts twelve synthetic orders and reruns without duplicates or overwrites', async () => {
    const first = await seedCloudDemoDatabase(client);
    const second = await seedCloudDemoDatabase(client);
    const {
      rows: [counts],
    } = await client.query(`
      SELECT
        (SELECT count(*)::int FROM "order_records") AS orders,
        (SELECT count(*)::int FROM "connections") AS connections,
        (SELECT count(*)::int FROM "order_holds") AS holds
    `);

    assert.deepEqual(first, { insertedConnections: 2, insertedOrders: 12, insertedHolds: 3 });
    assert.deepEqual(second, { insertedConnections: 0, insertedOrders: 0, insertedHolds: 0 });
    assert.equal(Number(counts.orders), ORDERS.length);
    assert.equal(Number(counts.connections), 2);
    assert.equal(Number(counts.holds), 3);
  });

  test('refuses a database containing a real order without inserting demo data', async () => {
    await client.query(
      `INSERT INTO "order_records" ("internalOrderId", "sourceConnectionId", "orderSnapshot")
       VALUES ('real-order-1', '00000000-0000-4000-8000-000000000099', '{}'::jsonb)`
    );

    await assert.rejects(seedCloudDemoDatabase(client), /orders that are not this synthetic demo seed/);
    const {
      rows: [{ count }],
    } = await client.query('SELECT count(*)::int AS count FROM "order_records"');
    assert.equal(Number(count), 1);
  });

  test('refuses a connection containing real credentials without inserting demo data', async () => {
    await client.query(
      `INSERT INTO "connections"
         ("id", "platformType", "name", "status", "config", "credentialsRef", "enabledCapabilities")
       VALUES ('00000000-0000-4000-8000-000000000099', 'allegro', 'Real account', 'active',
               '{}'::jsonb, 'db:real-secret', '[]'::jsonb)`
    );

    await assert.rejects(seedCloudDemoDatabase(client), /non-demo or credentialed connections/);
    const {
      rows: [{ count }],
    } = await client.query('SELECT count(*)::int AS count FROM "order_records"');
    assert.equal(Number(count), 0);
  });

  test('refuses stored integration credentials even without connection rows', async () => {
    await client.query(`INSERT INTO "integration_credentials" ("id") VALUES ('real-secret')`);

    await assert.rejects(seedCloudDemoDatabase(client), /stored integration credentials/);
    const {
      rows: [{ count }],
    } = await client.query('SELECT count(*)::int AS count FROM "order_records"');
    assert.equal(Number(count), 0);
  });
});
