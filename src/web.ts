import fs from 'fs';
import path from 'path';

import ejs from 'ejs';
import { register } from 'prom-client';

import { CrcBuffer } from '#/cache/CrcTable.js';
import World from '#/engine/World.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import NullClientSocket from '#/server/NullClientSocket.js';
import WSClientSocket from '#/server/ws/WSClientSocket.js';
import Environment from '#/util/Environment.js';
import OnDemand from '#/engine/OnDemand.js';
import { tryParseInt } from '#/util/TryParse.js';
import { getPublicPerDeploymentToken } from '#/io/PemUtil.js';

function getIp(req: Request) {
    // todo: environment flag to respect cf-connecting-ip (NOT safe if origin is exposed publicly by IP + proxied)
    const forwardedFor = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');
    if (!forwardedFor) {
        return null;
    }

    return forwardedFor.split(',')[0].trim();
}

const MIME_TYPES = new Map<string, string>();
MIME_TYPES.set('.js', 'application/javascript');
MIME_TYPES.set('.mjs', 'application/javascript');
MIME_TYPES.set('.css', 'text/css');
MIME_TYPES.set('.html', 'text/html');
MIME_TYPES.set('.wasm', 'application/wasm');
MIME_TYPES.set('.sf2', 'application/octet-stream');

export type WebSocketData = {
    client: WSClientSocket,
    remoteAddress: string
};

export type WebSocketRoutes = {
    '/': Response
};

export async function startWeb() {
    Bun.serve<WebSocketData, WebSocketRoutes>({
        port: Environment.WEB_PORT,
        async fetch(req, server) {
            const url = new URL(req.url ?? `', 'http://${req.headers.get('host')}`);

            if (url.pathname === '/') {
                const upgraded = server.upgrade(req, {
                    data: {
                        client: new WSClientSocket(),
                        remoteAddress: getIp(req)
                    }
                });

                if (upgraded) {
                    return undefined;
                }

                return new Response(null, { status: 404 });
            } else if (url.pathname.startsWith('/crc')) {
                return new Response(CrcBuffer.data);
            } else if (url.pathname.startsWith('/title')) {
                return new Response(OnDemand.cache.read(0, 1));
            } else if (url.pathname.startsWith('/config')) {
                return new Response(OnDemand.cache.read(0, 2));
            } else if (url.pathname.startsWith('/interface')) {
                return new Response(OnDemand.cache.read(0, 3));
            } else if (url.pathname.startsWith('/media')) {
                return new Response(OnDemand.cache.read(0, 4));
            } else if (url.pathname.startsWith('/versionlist')) {
                return new Response(OnDemand.cache.read(0, 5));
            } else if (url.pathname.startsWith('/textures')) {
                return new Response(OnDemand.cache.read(0, 6));
            } else if (url.pathname.startsWith('/wordenc')) {
                return new Response(OnDemand.cache.read(0, 7));
            } else if (url.pathname.startsWith('/sounds')) {
                return new Response(OnDemand.cache.read(0, 8));
            } else if (url.pathname.startsWith('/ondemand.zip')) {
                return new Response(await Bun.file('data/pack/ondemand.zip').bytes());
            } else if (url.pathname === '/rs2.cgi') {
                const plugin = tryParseInt(url.searchParams.get('plugin'), 0);
                const lowmem = tryParseInt(url.searchParams.get('lowmem'), 0);

                if (Environment.NODE_DEBUG && plugin === 1) {
                    return new Response(await ejs.renderFile('view/java.ejs', {
                        nodeid: Environment.NODE_ID,
                        lowmem,
                        members: Environment.NODE_MEMBERS,
                        portoff: Environment.NODE_PORT - 43594
                    }), {
                        headers: {
                            'Content-Type': 'text/html'
                        }
                    });
                } else {
                    return new Response(await ejs.renderFile('view/client.ejs', {
                        nodeid: Environment.NODE_ID,
                        lowmem,
                        members: Environment.NODE_MEMBERS,
                        per_deployment_token: Environment.WEB_SOCKET_TOKEN_PROTECTION ? getPublicPerDeploymentToken() : ''
                    }), {
                        headers: {
                            'Content-Type': 'text/html'
                        }
                    });
                }
            } else if (fs.existsSync(`public${url.pathname}`)) {
                return new Response(await Bun.file(`public${url.pathname}`).bytes(), {
                    headers: {
                        'Content-Type': MIME_TYPES.get(path.extname(url.pathname ?? '')) ?? 'text/plain'
                    }
                });
            } else {
                return new Response(null, { status: 404 });
            }
        },
        websocket: {
            maxPayloadLength: 2000,
            open(ws) {
                /* TODO:
                if (Environment.WEB_SOCKET_TOKEN_PROTECTION) {
                    // if WEB_CONNECTION_TOKEN_PROTECTION is enabled, we must
                    // have a matching per-deployment token sent via cookie.
                    const headers = info.req.headers;
                    if (!headers.cookie) {
                        // no cookie
                        cb(false);
                        return;
                    }
                    // cookie string is present at least
                    // find exact match. NOTE: the double quotes are deliberate
                    const search = `per_deployment_token="${getPublicPerDeploymentToken()}"`;
                    // could do something more fancy with cookie parsing, but
                    // this seems fine.
                    if (headers.cookie.indexOf(search) === -1) {
                        cb(false);
                        return;
                    }
                }
                const { origin } = info;

                // todo: check more than just the origin header (important!)
                if (Environment.WEB_ALLOWED_ORIGIN && origin !== Environment.WEB_ALLOWED_ORIGIN) {
                    cb(false);
                    return;
                }

                cb(true);
                */

                ws.data.client.init(ws, ws.data.remoteAddress ?? ws.remoteAddress);
            },
            message(ws, message: Buffer) {
                try {
                    const { client } = ws.data;
                    if (client.state === -1 || client.remaining <= 0) {
                        client.terminate();
                        return;
                    }

                    client.buffer(message);

                    if (client.state === 0) {
                        World.onClientData(client);
                    } else if (client.state === 2) {
                        if (Environment.NODE_WS_ONDEMAND) {
                            OnDemand.onClientData(client);
                        } else {
                            client.terminate();
                        }
                    }
                } catch (_) {
                    ws.terminate();
                }
            },
            close(ws) {
                const { client } = ws.data;
                client.state = -1;

                if (client.player) {
                    client.player.addSessionLog(LoggerEventType.ENGINE, 'WS socket closed');
                    client.player.client = new NullClientSocket();
                }
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
