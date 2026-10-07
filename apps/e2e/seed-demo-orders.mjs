/**
 * Local-only entry point for the fixed synthetic order-list demo data.
 *
 * Its command retains the loopback-only guard. The shared row writer is also
 * used by the separately guarded Railway importer. Both create only fixed,
 * marked rows and disabled, credential-less source labels.
 */
import pg from 'pg';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDemoTarget, DEMO_PG_DATABASE, DEMO_PG_PORT } from './seed-demo-orders.guard.mjs';

const { Client } = pg;
export const SEED_ID = 'synthetic-order-set-v1';
const DB = {
  host: process.env.OL_DEMO_PGHOST ?? '127.0.0.1',
  port: Number(process.env.OL_DEMO_PGPORT ?? DEMO_PG_PORT),
  user: process.env.OL_DEMO_PGUSER ?? 'postgres',
  password: process.env.OL_DEMO_PGPASSWORD,
  database: process.env.OL_DEMO_PGDATABASE ?? DEMO_PG_DATABASE,
};

export const SOURCES = [
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

const DEFINITIONS = [
  {
    platformType: 'allegro',
    serial: '001',
    placedAt: '2026-09-10T09:15:00.000Z',
    status: 'processing',
    recordStatus: 'ready',
    holdReason: null,
    itemCount: 1,
    unitPrice: 79.9,
  },
  {
    platformType: 'erli',
    serial: '002',
    placedAt: '2026-09-12T13:40:00.000Z',
    status: 'processing',
    recordStatus: 'ready',
    holdReason: 'stock-shortfall',
    itemCount: 1,
    unitPrice: 49.9,
  },
  {
    platformType: 'allegro',
    serial: '003',
    placedAt: '2026-09-15T08:05:00.000Z',
    status: 'pending',
    recordStatus: 'awaiting_mapping',
    holdReason: null,
    itemCount: 2,
    unitPrice: 126.6,
  },
  {
    platformType: 'erli',
    serial: '004',
    placedAt: '2026-09-18T16:25:00.000Z',
    status: 'pending',
    recordStatus: 'ready',
    holdReason: 'payment-review',
    itemCount: 1,
    unitPrice: 79.9,
  },
  {
    platformType: 'allegro',
    serial: '005',
    placedAt: '2026-09-20T11:10:00.000Z',
    status: 'processing',
    recordStatus: 'source_deleted',
    holdReason: null,
    itemCount: 1,
    unitPrice: 49.9,
  },
  {
    platformType: 'erli',
    serial: '006',
    placedAt: '2026-09-22T17:55:00.000Z',
    status: 'cancelled',
    recordStatus: 'ready',
    holdReason: null,
    itemCount: 1,
    unitPrice: 79.9,
  },
  {
    platformType: 'allegro',
    serial: '007',
    placedAt: '2026-09-25T10:30:00.000Z',
    status: 'completed',
    recordStatus: 'ready',
    holdReason: null,
    itemCount: 2,
    unitPrice: 126.6,
  },
  {
    platformType: 'erli',
    serial: '008',
    placedAt: '2026-09-27T12:00:00.000Z',
    status: 'pending',
    recordStatus: 'awaiting_mapping',
    holdReason: null,
    itemCount: 1,
    unitPrice: 49.9,
  },
  {
    platformType: 'allegro',
    serial: '009',
    placedAt: '2026-09-29T14:45:00.000Z',
    status: 'processing',
    recordStatus: 'ready',
    holdReason: 'address-invalid',
    itemCount: 1,
    unitPrice: 79.9,
  },
  {
    platformType: 'erli',
    serial: '010',
    placedAt: '2026-10-01T09:20:00.000Z',
    status: 'completed',
    recordStatus: 'ready',
    holdReason: null,
    itemCount: 2,
    unitPrice: 126.6,
  },
  {
    platformType: 'allegro',
    serial: '011',
    placedAt: '2026-10-02T15:35:00.000Z',
    status: 'pending',
    recordStatus: 'ready',
    holdReason: null,
    itemCount: 1,
    unitPrice: 49.9,
  },
  {
    platformType: 'erli',
    serial: '012',
    placedAt: '2026-10-03T18:05:00.000Z',
    status: 'cancelled',
    recordStatus: 'source_deleted',
    holdReason: null,
    itemCount: 1,
    unitPrice: 79.9,
  },
];

export function makeOrder({
  platformType,
  serial,
  placedAt,
  status,
  recordStatus,
  holdReason,
  itemCount,
  unitPrice,
}) {
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

export const ORDERS = DEFINITIONS.map(makeOrder);
export const HOLDS = [
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

export async function insertAndVerify(
  client,
  { insertSql, insertValues, selectSql, selectValues, isValid, label }
) {
  const result = await client.query(insertSql, insertValues);
  const {
    rows: [stored],
  } = await client.query(selectSql, selectValues);
  if (!isValid(stored)) throw new Error(`Refusing to reuse non-demo ${label}.`);
  return result.rowCount ?? 0;
}

export async function insertSeedRows(client) {
  let insertedConnections = 0;
  for (const source of SOURCES) {
    insertedConnections += await insertAndVerify(client, {
      insertSql: `INSERT INTO "connections"
        ("id", "platformType", "name", "status", "config", "credentialsRef",
         "adapterKey", "enabledCapabilities")
       VALUES ($1, $2, $3, 'disabled',
         jsonb_build_object('openlinkerDemo', jsonb_build_object(
           'seedId', $4::text, 'syntheticOnly', true, 'noExternalCredentials', true)),
         'synthetic-demo-no-credentials', NULL, '[]'::jsonb)
       ON CONFLICT ("id") DO NOTHING`,
      insertValues: [source.id, source.platformType, source.name, SEED_ID],
      selectSql: `SELECT "platformType", "name", "status", "credentialsRef", "config",
              "enabledCapabilities"
         FROM "connections" WHERE "id" = $1`,
      selectValues: [source.id],
      isValid: (stored) =>
        stored?.platformType === source.platformType &&
        stored.name === source.name &&
        stored.status === 'disabled' &&
        stored.credentialsRef === 'synthetic-demo-no-credentials' &&
        stored.config?.openlinkerDemo?.seedId === SEED_ID &&
        stored.config?.openlinkerDemo?.noExternalCredentials === true &&
        stored.enabledCapabilities?.length === 0,
      label: `connection row ${source.id}`,
    });
  }

  let insertedOrders = 0;
  for (const order of ORDERS) {
    insertedOrders += await insertAndVerify(client, {
      insertSql: `INSERT INTO "order_records"
        ("internalOrderId", "customerId", "sourceConnectionId", "sourceEventId",
         "orderSnapshot", "syncStatus", "recordStatus", "mappingFailureReason",
         "cancelledAt", "activeHoldReason", "createdAt", "updatedAt", "placedAt",
         "currency", "taxTreatment", "totalAmount", "totalTaxTreatment")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10,
               $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT ("internalOrderId") DO NOTHING`,
      insertValues: [
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
      ],
      selectSql: `SELECT "sourceConnectionId", "orderSnapshot"->'demo'->>'seedId' AS "seedId"
         FROM "order_records" WHERE "internalOrderId" = $1`,
      selectValues: [order.internalOrderId],
      isValid: (stored) =>
        stored?.sourceConnectionId === order.sourceConnectionId && stored.seedId === SEED_ID,
      label: `order row ${order.internalOrderId}`,
    });
  }

  let insertedHolds = 0;
  for (const hold of HOLDS) {
    insertedHolds += await insertAndVerify(client, {
      insertSql: `INSERT INTO "order_holds"
        ("id", "internalOrderId", "reason", "note", "placedByUserId",
         "placedByService", "placedAt", "releasedAt")
       VALUES ($1, $2, $3, $4, 'synthetic-demo-operator', NULL, $5, NULL)
       ON CONFLICT ("id") DO NOTHING`,
      insertValues: [hold.id, hold.orderId, hold.reason, hold.note, hold.placedAt],
      selectSql: `SELECT "internalOrderId", "reason", "note", "placedByUserId", "releasedAt"
         FROM "order_holds" WHERE "id" = $1`,
      selectValues: [hold.id],
      isValid: (stored) =>
        stored?.internalOrderId === hold.orderId &&
        stored.reason === hold.reason &&
        stored.note === hold.note &&
        stored.placedByUserId === 'synthetic-demo-operator' &&
        stored.releasedAt === null,
      label: `hold row ${hold.id}`,
    });
  }

  return { insertedConnections, insertedOrders, insertedHolds };
}

async function seed() {
  assertDemoTarget({
    nodeEnv: process.env.NODE_ENV,
    demoMode: process.env.OL_DEMO_MODE,
    seedConfirmation: process.env.OL_ALLOW_SYNTHETIC_ORDER_SEED,
    ...DB,
  });
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
      database.name !== DEMO_PG_DATABASE ||
      !database.orders ||
      !database.connections ||
      !database.holds
    ) {
      throw new Error('Target is not a migrated OpenLinker database.');
    }

    await client.query('BEGIN');
    transactionStarted = true;
    const { insertedConnections, insertedOrders, insertedHolds } = await insertSeedRows(client);

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

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectExecution) {
  seed().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Synthetic demo seed failed.');
    process.exitCode = 1;
  });
}
