import { register } from 'prom-client';

import { CrcBuffer } from '#/cache/CrcTable.js';
import Environment from '#/util/Environment.js';
import OnDemand from '#/engine/OnDemand.js';

export async function startWeb() {
    Bun.serve({
        port: Environment.WEB_PORT,

        async fetch(req) {
            const url = new URL(req.url ?? `', 'http://${req.headers.get('host')}`);

            if (url.pathname.startsWith('/crc')) {
                return new Response(Buffer.from(CrcBuffer.data));
            } else if (url.pathname.startsWith('/title')) {
                return new Response(Buffer.from(OnDemand.cache.read(0, 1)!));
            } else if (url.pathname.startsWith('/config')) {
                return new Response(Buffer.from(OnDemand.cache.read(0, 2)!));
            } else if (url.pathname.startsWith('/interface')) {
                return new Response(Buffer.from(OnDemand.cache.read(0, 3)!));
            } else if (url.pathname.startsWith('/media')) {
                return new Response(Buffer.from(OnDemand.cache.read(0, 4)!));
            } else if (url.pathname.startsWith('/versionlist')) {
                return new Response(Buffer.from(OnDemand.cache.read(0, 5)!));
            } else if (url.pathname.startsWith('/textures')) {
                return new Response(Buffer.from(OnDemand.cache.read(0, 6)!));
            } else if (url.pathname.startsWith('/wordenc')) {
                return new Response(Buffer.from(OnDemand.cache.read(0, 7)!));
            } else if (url.pathname.startsWith('/sounds')) {
                return new Response(Buffer.from(OnDemand.cache.read(0, 8)!));
            } else {
                return new Response(null, { status: 404 });
            }
        }
    });
}

export async function startManagementWeb() {
    Bun.serve({
        port: Environment.WEB_MANAGEMENT_PORT,
        routes: {
            '/prometheus': new Response(await register.metrics(), {
                headers: {
                    'Content-Type': register.contentType
                }
            })
        },
        fetch() {
            return new Response(null, { status: 404 });
        },
    });
}
