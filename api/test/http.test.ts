import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.ts';
import { openPool } from '../src/db/pool.ts';
import { exchange } from './http.ts';

const pool = openPool(true);
const api = app(pool);
after(() => pool.end());
for (const [method,path,body,status,code] of [
  ['GET','/api/unknown','',404,'NOT_FOUND'],
  ['POST','/api/clients','{}',400,'INVALID_INPUT'],
  ['POST','/api/projects','{',400,'INVALID_BODY'],
  ['PATCH','/api/invoices/1/status','{"status":"other"}',409,'CONFLICT'],
  ['GET','/api/invoices?status=invalid','',400,'INVALID_INPUT']
] as const) {
  test(method+' '+path+' returns '+code,async () => {
    const response = await exchange(api,method,path,body);
    assert.equal(response.status,status);
    assert.equal(response.body.error.code,code);
    assert.ok(response.body.error.message);
  });
}
