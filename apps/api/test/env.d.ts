import type { Bindings } from '../src/env';

declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augments the runtime env type
    interface Env extends Bindings {}
  }
}
