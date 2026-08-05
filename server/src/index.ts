// @bygsmart/server — Express API, redesigned for sync. The server is the authority;
// RLS is the boundary. P2: GET /api/sync/:entity (2.2) · POST /api/sync/mutations (2.3)
// · three-provider push (2.4).
import { loadEnv } from './env';
import { createApp } from './app';

const env = loadEnv();
createApp(env).listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`@bygsmart/server listening on :${env.port}`);
});
