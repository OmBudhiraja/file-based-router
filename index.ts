import fs from 'fs';
import path from 'path';

class FileRouter {
  router: Record<string, [Function, Record<string, string>]>;
  constructor() {
    this.router = this.getRouterProxy();
  }

  handle(req: Request) {
    let { pathname } = new URL(req.url);

    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    const [handler, params] = this.router[pathname];

    if (handler) {
      return handler(req, params);
    }

    return new Response('Not found');
  }

  async init() {
    await this.walkDir('./app', this.router as any);
  }

  private getRouterProxy() {
    return new Proxy({} as typeof this.router, {
      get(target, prop, reciever) {
        if (prop in target) {
          return [target[prop as string], {}];
        }

        for (const key of Object.keys(target)) {
          const fullPathRegex = new RegExp(key.replace(/\[[a-z0-9]+\]/, '([a-z0-9]+)'));
          const matches = fullPathRegex.exec(prop as string);
          console.warn('matches', matches, key);
          if (matches && matches.length > 1) {
            const paramsWithValues: Record<string, string> = {};

            for (let i = 1; i < matches.length; i++) {
              const match = key.match(/\[([a-z0-9]+)\]/g);
              if (!match) continue;
              const k = match[i - 1].slice(1, -1);
              paramsWithValues[k] = matches[i];
            }

            return [target[key], paramsWithValues];
          }
        }

        return [target['/404'], {}];
      },
    });
  }

  private async walkDir(dir: string, mapper: Record<string, Function>, prefix = '') {
    const list = await fs.promises.readdir(dir);

    for await (const file of list) {
      const res = await fs.promises.stat(path.resolve(dir, file));
      const pathname = file.replace(/\.ts$/, '');
      if (res.isFile()) {
        const { default: handler } = await import(path.resolve(dir, file));

        if (pathname === 'index') {
          if (prefix === '') {
            mapper['/'] = handler;
          } else {
            mapper[prefix] = handler;
          }
          continue;
        }

        mapper[`${prefix}/${pathname}`] = handler;
      } else if (res.isDirectory()) {
        await this.walkDir(path.resolve(dir, file), mapper, `${prefix}/${pathname}`);
      }
    }
  }
}

const fileRouter = new FileRouter();
await fileRouter.init();

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    return fileRouter.handle(req);
  },
});

console.log(`Listening on http://localhost:${server.port} ...`);
