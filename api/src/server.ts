import { app } from './app.ts';
import { openPool } from './db/pool.ts';
const pool = openPool();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API port.');
const server = app(pool).listen(port,'127.0.0.1',() => console.log('FreelanceLedger API listening on port '+port));
const close = () => server.close(() => { void pool.end(); });
process.once('SIGINT',close);
process.once('SIGTERM',close);
