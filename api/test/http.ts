import { Duplex } from 'node:stream';
import { createServer, type RequestListener } from 'node:http';

// Feed an HTTP/1.0 exchange through Node's parser with a private in-memory stream.
export function exchange(app: RequestListener, method: string, path: string, body = '') {
  return new Promise<{status: number; body: ReturnType<typeof JSON.parse>}>((resolve,reject) => {
    const chunks: Buffer[] = [];
    const socket = new Duplex({
      read() {},
      write(chunk,_encoding,done) { chunks.push(Buffer.from(chunk)); done(); }
    });
    socket.on('error',reject);
    socket.on('finish',() => {
      try {
        const raw = Buffer.concat(chunks).toString();
        const boundary = raw.indexOf('\r\n\r\n');
        const status = Number(raw.split(' ',2)[1]);
        const payload = raw.slice(boundary + 4);
        resolve({status,body:payload ? JSON.parse(payload) : null});
      } catch (error) { reject(error); }
    });
    const server = createServer(app);
    server.emit('connection',socket);
    socket.push(method+' '+path+' HTTP/1.0\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: '+
      Buffer.byteLength(body)+'\r\n\r\n'+body);
  });
}
