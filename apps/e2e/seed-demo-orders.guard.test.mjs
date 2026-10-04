/**
 * Unit tests for the synthetic-order seed safety boundary.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDemoTarget } from './seed-demo-orders.guard.mjs';

const VALID_TARGET = {
  nodeEnv: 'development',
  demoMode: 'true',
  seedConfirmation: 'YES',
  host: '127.0.0.1',
  port: 35432,
  database: 'openlinker',
};

test('accepts the explicitly opted-in isolated loopback database', () => {
  assert.doesNotThrow(() => assertDemoTarget(VALID_TARGET));
});

test('rejects production regardless of opt-ins', () => {
  assert.throws(
    () => assertDemoTarget({ ...VALID_TARGET, nodeEnv: 'production' }),
    /NODE_ENV=production/
  );
});

test('requires both explicit demo opt-ins', () => {
  assert.throws(() => assertDemoTarget({ ...VALID_TARGET, demoMode: 'false' }), /OL_DEMO_MODE/);
  assert.throws(
    () => assertDemoTarget({ ...VALID_TARGET, seedConfirmation: undefined }),
    /OL_ALLOW_SYNTHETIC_ORDER_SEED/
  );
});

test('rejects hostnames and non-loopback database targets', () => {
  for (const host of ['localhost', '::1', '192.0.2.1']) {
    assert.throws(() => assertDemoTarget({ ...VALID_TARGET, host }), /loopback:35432\/openlinker/);
  }
  assert.throws(
    () => assertDemoTarget({ ...VALID_TARGET, database: 'production' }),
    /loopback:35432\/openlinker/
  );
  assert.throws(
    () => assertDemoTarget({ ...VALID_TARGET, port: 5432 }),
    /loopback:35432\/openlinker/
  );
});
