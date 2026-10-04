/**
 * Explicit local-only seed for synthetic order-list and detail demonstrations.
 *
 * Writes only fixed, marked demo rows to the local OpenLinker database. The
 * Allegro/Erli connection records are disabled labels with no credentials or
 * enabled capabilities; this script never loads an adapter or calls a platform.
 */
import { isIP } from 'node:net';
import pg from 'pg';

const { Client } = pg;
const SEED_ID = 'synthetic-order-set-v1';
const DEMO_PG_PORT = 35432;
const DEMO_PG_DATABASE = 'openlinker';
const DB = {
  host: process.env.OL_DEMO_PGHOST ?? 'localhost',
  port: Number(process.env.OL_DEMO_PGPORT ?? DEMO_PG_PORT),
  user: process.env.OL_DEMO_PGUSER ?? 'postgres',
  password: process.env.OL_DEMO_PGPASSWORD ?? 'postgres',
  database: process.env.OL_DEMO_PGDATABASE ?? DEMO_PG_DATABASE,
};

const SOURCES = [
  {
    id: '00000000-0000-4000-8000-0000000000a1',
    platformType: 'allegro',
    name: 'DEMO DATA ONLY — Allegro (disabled, no API)',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a2',
    platformType: 'erli',
    name: 'DEMO DATA ONLY — Erli (disabled, no API)',
  },
];

const ADDRESS = {
  firstName: 'Demo',
  lastName: 'Buyer',
  address1: 'Synthetic Street 1',
  city: 'Warszawa',
  postalCode: '00-001',
  country: 'PL',
  phone: '+48000000000',
};

// For two-line baskets, equal unit prices across quantities 1 and 2 produce
// the displayed PLN 379.80 total; one-line baskets vary between PLN 49.90 and
// PLN 79.90.
const DEFINITIONS = [
  ['allegro', '001', '2026-09-10T09:15:00.000Z', 'processing', 'ready', null, 1, 79.9],
  ['erli', '002', '2026-09-12T13:40:00.000Z', 'processing', 'ready', 'stock-shortfall', 1, 49.9],
  ['allegro', '003', '2026-09-15T08:05:00.000Z', 'pending', 'awaiting_mapping', null, 2, 126.6],
  ['erli', '004', '2026-09-18T16:25:00.000Z', 'pending', 'ready', 'payment-review', 1, 79.9],
  ['allegro', '005', '2026-09-20T11:10:00.000Z', 'processing', 'source_deleted', null, 1, 49.9],
  ['erli', '006', '2026-09-22T17:55:00.000Z', 'cancelled', 'ready', null, 1, 79.9],
  ['allegro', '007', '2026-09-25T10:30:00.000Z', 'completed', 'ready', null, 2, 126.6],
  ['erli', '008', '2026-09-27T12:00:00.000Z', 'pending', 'awaiting_mapping', null, 1, 49.9],
  ['allegro', '009', '2026-09-29T14:45:00.000Z', 'processing', 'ready', 'address-invalid', 1, 79.9],
  ['erli', '010', '2026-10-01T09:20:00.000Z', 'completed', 'ready', null, 2, 126.6],
  ['allegro', '011', '2026-10-02T15:35:00.000Z', 'pending', 'ready', null, 1, 49.9],
  ['erli', '012', '2026-10-03T18:05:00.000Z', 'cancelled', 'source_deleted', null, 1, 79.9],
];

function isLoopback(host) {
  if (host === 'localhost' || host === '::1') return true;
  return isIP(host) === 4 && Number(host.split('.')[0]) === 127;
}

function assertDemoTarget() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed when NODE_ENV=production.');
  }
  if (process.env.OL_DEMO_MODE !== 'true') {
    throw new Error('Set OL_DEMO_MODE=true for this explicit seed command.');
  }
  if (process.env.OL_ALLOW_SYNTHETIC_ORDER_SEED !== 'YES') {
    throw new Error('Set OL_ALLOW_SYNTHETIC_ORDER_SEED=YES to confirm this seed.');
  }
  if (!isLoopback(DB.host) || DB.database !== DEMO_PG_DATABASE || DB.port !== DEMO_PG_PORT) {
    throw new Error(
      `The seed only accepts the isolated local demo database at loopback:${DEMO_PG_PORT}/${DEMO_PG_DATABASE}.`
    );
  }
}

function makeOrder([
  platformType,
  serial,
  placedAt,
  status,
  recordStatus,
  holdReason,
  itemCount,
  unitPrice,
]) {
  const source = SOURCES.find((candidate) => candidate.platformType === platformType);
  if (!source) throw new Error(`No demo source configured for ${platformType}.`);

  const internalOrderId = `ol_order_demo_${platformType}_${serial}`;
  const orderNumber = `DEMO-${platformType.toUpperCase()}-${serial}`;
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `${serial}-line-${index + 1}`,
    productId: recordStatus === 'ready' ? `demo-product-${index + 1}` : null,
    variantId: recordStatus === 'ready' ? `demo-variant-${index + 1}` : null,
    externalOfferId: `DEMO-OFFER-${serial}-${index + 1}`,
    quantity: index + 1,
    price: unitPrice,
    sku: `DEMO-SKU-${serial}-${index + 1}`,
    name: `DEMO synthetic product ${index + 1}`,
    taxRate: '23',
  }));
  const total = Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
  const unresolved = recordStatus !== 'ready';
  const cancelledAt = status === 'cancelled' ? placedAt : null;

  return {
    internalOrderId,
    customerId: null,
    sourceConnectionId: source.id,
    sourceEventId: `synthetic-demo:${platformType}:${serial}`,
    orderSnapshot: {
      id: internalOrderId,
      orderNumber,
      status,
      placedAt,
      createdAt: placedAt,
      updatedAt: placedAt,
      customerEmail: `buyer-${serial}@example.invalid`,
      billingAddress: { ...ADDRESS },
      shippingAddress: { ...ADDRESS },
      shipping: { methodId: 'demo-delivery', methodName: 'DEMO delivery (not dispatched)' },
      totals: {
        subtotal: total,
        tax: Number(((total * 23) / 123).toFixed(2)),
        shipping: 0,
        total,
        currency: 'PLN',
        taxTreatment: 'inclusive',
      },
      items,
      demo: { seedId: SEED_ID, synthetic: true, noMarketplaceApi: true },
    },
    syncStatus: [],
    recordStatus,
    mappingFailureReason: unresolved
      ? recordStatus === 'source_deleted'
        ? 'DEMO: synthetic source item marked deleted'
        : 'DEMO: synthetic offer has no product mapping'
      : null,
    cancelledAt,
    activeHoldReason: holdReason,
    createdAt: placedAt,
    updatedAt: placedAt,
    placedAt,
    currency: 'PLN',
    taxTreatment: 'inclusive',
    totalAmount: total,
    totalTaxTreatment: null,
  };
}

const ORDERS = DEFINITIONS.map(makeOrder);
const HOLDS = [
  {
    id: '00000000-0000-4000-8000-0000000000b1',
    orderId: ORDERS[1].internalOrderId,
    reason: 'stock-shortfall',
    note: 'DEMO: synthetic stock-shortfall example.',
    placedAt: ORDERS[1].placedAt,
  },
  {
    id: '00000000-0000-4000-8000-0000000000b2',
    orderId: ORDERS[3].internalOrderId,
    reason: 'payment-review',
    note: 'DEMO: synthetic payment-review example.',
    placedAt: ORDERS[3].placedAt,
  },
  {
    id: '00000000-0000-4000-8000-0000000000b3',
    orderId: ORDERS[8].internalOrderId,
    reason: 'address-invalid',
    note: 'DEMO: synthetic address-validation example.',
    placedAt: ORDERS[8].placedAt,
  },
];

async function seed() {
  assertDemoTarget();
  const client = new Client(DB);
  await client.connect();
  let transactionStarted = false;

  try {
    const {
      rows: [database],
    } = await client.query(
      `SELECT current_database() AS name, to_regclass('public.order_records') AS orders,
              to_regclass('public.connections') AS connections,
              to_regclass('public.order_holds') AS holds`
    );
    if (
      database.name !== 'openlinker' ||
      !database.orders ||
      !database.connections ||
      !database.holds
    ) {
      throw new Error('Target is not a migrated OpenLinker database.');
    }

    await client.query('BEGIN');
    transactionStarted = true;
    let insertedConnections = 0;
    for (const source of SOURCES) {
      const result = await client.query(
        `INSERT INTO "connections"
          ("id", "platformType", "name", "status", "config", "credentialsRef",
           "adapterKey", "enabledCapabilities")
         VALUES ($1, $2, $3, 'disabled',
           jsonb_build_object('openlinkerDemo', jsonb_build_object(
             'seedId', $4::text, 'syntheticOnly', true, 'noExternalCredentials', true)),
           'synthetic-demo-no-credentials', NULL, '[]'::jsonb)
         ON CONFLICT ("id") DO NOTHING`,
        [source.id, source.platformType, source.name, SEED_ID]
      );
      insertedConnections += result.rowCount ?? 0;

      const {
        rows: [stored],
      } = await client.query(
        `SELECT "platformType", "name", "status", "credentialsRef", "config",
                "enabledCapabilities"
           FROM "connections" WHERE "id" = $1`,
        [source.id]
      );
      if (
        stored?.platformType !== source.platformType ||
        stored.name !== source.name ||
        stored.status !== 'disabled' ||
        stored.credentialsRef !== 'synthetic-demo-no-credentials' ||
        stored.config?.openlinkerDemo?.seedId !== SEED_ID ||
        stored.config?.openlinkerDemo?.noExternalCredentials !== true ||
        stored.enabledCapabilities?.length !== 0
      ) {
        throw new Error(`Refusing to reuse non-demo connection row ${source.id}.`);
      }
    }

    let insertedOrders = 0;
    for (const order of ORDERS) {
      const result = await client.query(
        `INSERT INTO "order_records"
          ("internalOrderId", "customerId", "sourceConnectionId", "sourceEventId",
           "orderSnapshot", "syncStatus", "recordStatus", "mappingFailureReason",
           "cancelledAt", "activeHoldReason", "createdAt", "updatedAt", "placedAt",
           "currency", "taxTreatment", "totalAmount", "totalTaxTreatment")
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10,
                 $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT ("internalOrderId") DO NOTHING`,
        [
          order.internalOrderId,
          order.customerId,
          order.sourceConnectionId,
          order.sourceEventId,
          JSON.stringify(order.orderSnapshot),
          JSON.stringify(order.syncStatus),
          order.recordStatus,
          order.mappingFailureReason,
          order.cancelledAt,
          order.activeHoldReason,
          order.createdAt,
          order.updatedAt,
          order.placedAt,
          order.currency,
          order.taxTreatment,
          order.totalAmount,
          order.totalTaxTreatment,
        ]
      );
      insertedOrders += result.rowCount ?? 0;

      const {
        rows: [stored],
      } = await client.query(
        `SELECT "sourceConnectionId", "orderSnapshot"->'demo'->>'seedId' AS "seedId"
           FROM "order_records" WHERE "internalOrderId" = $1`,
        [order.internalOrderId]
      );
      if (stored?.sourceConnectionId !== order.sourceConnectionId || stored.seedId !== SEED_ID) {
        throw new Error(`Refusing to reuse non-demo order row ${order.internalOrderId}.`);
      }
    }

    let insertedHolds = 0;
    for (const hold of HOLDS) {
      const result = await client.query(
        `INSERT INTO "order_holds"
          ("id", "internalOrderId", "reason", "note", "placedByUserId",
           "placedByService", "placedAt", "releasedAt")
         VALUES ($1, $2, $3, $4, 'synthetic-demo-operator', NULL, $5, NULL)
         ON CONFLICT ("id") DO NOTHING`,
        [hold.id, hold.orderId, hold.reason, hold.note, hold.placedAt]
      );
      insertedHolds += result.rowCount ?? 0;

      const {
        rows: [stored],
      } = await client.query(
        `SELECT "internalOrderId", "reason", "note", "placedByUserId", "releasedAt"
           FROM "order_holds" WHERE "id" = $1`,
        [hold.id]
      );
      if (
        stored?.internalOrderId !== hold.orderId ||
        stored.reason !== hold.reason ||
        stored.note !== hold.note ||
        stored.placedByUserId !== 'synthetic-demo-operator' ||
        stored.releasedAt !== null
      ) {
        throw new Error(`Refusing to reuse non-demo hold row ${hold.id}.`);
      }
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log(
      `Synthetic demo seed complete: ${ORDERS.length} orders, ` +
        `${insertedOrders} new orders, ${insertedConnections} new disabled source labels, ` +
        `${insertedHolds} new hold rows.`
    );
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the failure that triggered the rollback.
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Synthetic demo seed failed.');
  process.exitCode = 1;
});
