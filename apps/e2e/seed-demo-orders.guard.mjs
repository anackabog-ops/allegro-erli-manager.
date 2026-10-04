/**
 * Safety checks for the explicit synthetic-order demo seed.
 *
 * Keeps environment and database-target validation independently testable
 * without opening a database connection.
 */
import { isIP } from 'node:net';

export function assertDemoTarget({ nodeEnv, demoMode, seedConfirmation, host, port, database }) {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed when NODE_ENV=production.');
  }
  if (demoMode !== 'true') {
    throw new Error('Set OL_DEMO_MODE=true for this explicit seed command.');
  }
  if (seedConfirmation !== 'YES') {
    throw new Error('Set OL_ALLOW_SYNTHETIC_ORDER_SEED=YES to confirm this seed.');
  }
  const isIpv4Loopback = isIP(host) === 4 && Number(host.split('.')[0]) === 127;
  if (!isIpv4Loopback || database !== 'openlinker' || port !== 35432) {
    throw new Error(
      'The seed only accepts the isolated local demo database at loopback:35432/openlinker.'
    );
  }
}
