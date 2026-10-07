/**
 * Unit tests for the explicit Railway demo seed safety boundary.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCloudDemoTarget } from './seed-demo-orders-cloud.guard.mjs';

const VALID_TARGET = {
  nodeEnv: 'production',
  demoMode: 'true',
  seedConfirmation: 'YES',
  target: 'railway-demo',
  host: 'postgres.railway.internal',
  port: 5432,
  user: 'railway',
  password: 'non-empty-test-password',
  database: 'openlinker_demo',
};

test('accepts the explicitly confirmed dedicated demo target', () => {
  assert.doesNotThrow(() => assertCloudDemoTarget(VALID_TARGET));
});

test('requires production, demo mode, explicit confirmation, and target designation', () => {
  for (const [key, value, message] of [
    ['nodeEnv', 'development', /NODE_ENV=production/],
    ['demoMode', 'false', /OL_DEMO_MODE/],
    ['seedConfirmation', undefined, /OL_ALLOW_SYNTHETIC_ORDER_SEED/],
    ['target', undefined, /OL_DEMO_SEED_TARGET=railway-demo/],
  ]) {
    assert.throws(() => assertCloudDemoTarget({ ...VALID_TARGET, [key]: value }), message);
  }
});

test('refuses databases other than the dedicated demo database', () => {
  for (const database of ['openlinker', 'railway', 'production', undefined]) {
    assert.throws(
      () => assertCloudDemoTarget({ ...VALID_TARGET, database }),
      /expected openlinker_demo/
    );
  }
});

test('requires explicit database connection settings', () => {
  for (const key of ['host', 'port', 'user', 'password']) {
    assert.throws(
      () => assertCloudDemoTarget({ ...VALID_TARGET, [key]: undefined }),
      /Set DB_HOST, DB_PORT, DB_USERNAME, and DB_PASSWORD/
    );
  }
});
