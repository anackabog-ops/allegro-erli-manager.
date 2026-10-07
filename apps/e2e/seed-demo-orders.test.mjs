/**
 * Unit tests for synthetic order construction and seed-row verification.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { insertAndVerify, makeOrder } from './seed-demo-orders.mjs';

const ORDER_BASE = {
  platformType: 'allegro',
  serial: 'TEST',
  placedAt: '2026-09-15T08:05:00.000Z',
  status: 'processing',
  recordStatus: 'ready',
  holdReason: null,
  itemCount: 2,
  unitPrice: 126.6,
};

test('builds synthetic line items and consistent totals', () => {
  const order = makeOrder(ORDER_BASE);
  assert.equal(order.totalAmount, 379.8);
  assert.equal(order.orderSnapshot.totals.total, order.totalAmount);
  assert.equal(order.orderSnapshot.totals.tax, Number(((379.8 * 23) / 123).toFixed(2)));
  assert.deepEqual(
    order.orderSnapshot.items.map(({ quantity, price }) => ({ quantity, price })),
    [
      { quantity: 1, price: 126.6 },
      { quantity: 2, price: 126.6 },
    ]
  );
  assert.equal(order.orderSnapshot.demo.synthetic, true);
});

test('leaves unresolved mapping rows without product IDs', () => {
  const awaitingMapping = makeOrder({ ...ORDER_BASE, recordStatus: 'awaiting_mapping' });
  assert.ok(awaitingMapping.orderSnapshot.items.every((item) => item.productId === null));
  assert.match(awaitingMapping.mappingFailureReason, /no product mapping/);

  const sourceDeleted = makeOrder({ ...ORDER_BASE, recordStatus: 'source_deleted' });
  assert.match(sourceDeleted.mappingFailureReason, /source item marked deleted/);
});

test('refuses to reuse a row that does not match the expected demo marker', async () => {
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      return queries.length === 1
        ? { rowCount: 0, rows: [] }
        : { rowCount: null, rows: [{ seedId: 'some-other-data' }] };
    },
  };

  await assert.rejects(
    insertAndVerify(client, {
      insertSql: 'INSERT DEMO',
      insertValues: ['stable-id'],
      selectSql: 'SELECT DEMO',
      selectValues: ['stable-id'],
      isValid: (stored) => stored?.seedId === 'synthetic-order-set-v1',
      label: 'order row stable-id',
    }),
    /Refusing to reuse non-demo order row stable-id/
  );
  assert.equal(queries.length, 2);
});
