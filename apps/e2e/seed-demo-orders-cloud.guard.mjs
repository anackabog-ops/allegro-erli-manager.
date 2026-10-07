/**
 * Safety checks for the explicitly designated Railway synthetic-order seed.
 */
export const DEMO_DATABASE = 'openlinker_demo';
const DEMO_TARGET = 'railway-demo';

export function assertCloudDemoTarget({
  nodeEnv,
  demoMode,
  seedConfirmation,
  target,
  host,
  port,
  user,
  password,
  database,
}) {
  if (nodeEnv !== 'production') {
    throw new Error('The Railway seed requires NODE_ENV=production.');
  }
  if (demoMode !== 'true') {
    throw new Error('Set OL_DEMO_MODE=true for this explicit seed command.');
  }
  if (seedConfirmation !== 'YES') {
    throw new Error('Set OL_ALLOW_SYNTHETIC_ORDER_SEED=YES to confirm this seed.');
  }
  if (target !== DEMO_TARGET) {
    throw new Error(`Set OL_DEMO_SEED_TARGET=${DEMO_TARGET} to designate the isolated demo database.`);
  }
  if (database !== DEMO_DATABASE) {
    throw new Error(`Refusing database ${database || '(unset)'}; expected ${DEMO_DATABASE}.`);
  }
  if (
    typeof host !== 'string' ||
    host.length === 0 ||
    !Number.isInteger(Number(port)) ||
    Number(port) < 1 ||
    Number(port) > 65535 ||
    typeof user !== 'string' ||
    user.length === 0 ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    throw new Error('Set DB_HOST, DB_PORT, DB_USERNAME, and DB_PASSWORD for the isolated demo database.');
  }
}
