import express, { type ErrorRequestHandler } from 'express';
import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { Problem } from './errors.ts';
import { ledger } from './routes/ledger.ts';
import { systemClock, type Clock } from './clock.ts';

export function app(pool: Pool, clock: Clock = systemClock) {
  const api = express();
  api.disable('x-powered-by');
  api.use(express.json({limit:'64kb'}));
  api.use('/api',ledger(pool,clock));
  api.use((_req,_res,next) => next(new Problem(404,'NOT_FOUND','Resource not found.')));
  const errors: ErrorRequestHandler = (err,_req,res,_next) => {
    if (err instanceof ZodError) {
      res.status(400).json({error:{code:'INVALID_INPUT',message:'Check the supplied fields.',details:err.issues}});
      return;
    }
    let problem = new Problem(500,'INTERNAL_ERROR','Request could not be completed.');
    if (err instanceof Problem) problem = err;
    else if (err.type === 'entity.too.large') problem = new Problem(413,'BODY_TOO_LARGE','Request body is too large.');
    else if (err.status >= 400 && err.status < 500) problem = new Problem(err.status,'INVALID_BODY','Invalid request body.');
    else if (err.code === '23503') problem = new Problem(404,'NOT_FOUND','Referenced record not found.');
    else if (err.code === '40P01' || err.code === '40001') problem = new Problem(409,'CONFLICT','Concurrent change. Retry the request.');
    else if (err.code === '22021' || err.code === '22008') problem = new Problem(400,'INVALID_INPUT','Invalid field value.');
    res.status(problem.status).json({error:{code:problem.code,message:problem.message}});
  };
  api.use(errors);
  return api;
}
