import fs from 'fs';
import path from 'path';

import ejs from 'ejs';
import { register } from 'prom-client';

import { CrcBuffer } from '#/cache/CrcTable.js';
import World from '#/engine/World.js';
import Packet from '#/io/Packet.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import NullClientSocket from '#/server/NullClientSocket.js';
import WSClientSocket from '#/server/ws/WSClientSocket.js';
import Environment from '#/util/Environment.js';
import { tryParseInt } from '#/util/TryParse.js';

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
                        origin: req.headers.get('origin'),
                        remoteAddress: getIp(req)
                    }
                });

                if (upgraded) {
                    return undefined;
                }

                return new Response(null, { status: 404 });
            } else if (url.pathname.endsWith('.mid')) {
                const filename = url.pathname.substring(1, url.pathname.lastIndexOf('_')) + '.mid';
                if (!fs.existsSync(`data/pack/client/songs/${filename}`)) {
                    return new Response(null, { status: 404 });
                }

                return new Response(Bun.file('data/pack/client/songs/' + filename));
            } else if (url.pathname.startsWith('/crc')) {
                return new Response(Buffer.from(CrcBuffer.data));
            } else if (url.pathname.startsWith('/title')) {
                return new Response(Bun.file('data/pack/client/title'));
            } else if (url.pathname.startsWith('/config')) {
                return new Response(Bun.file('data/pack/client/config'));
            } else if (url.pathname.startsWith('/interface')) {
                return new Response(Bun.file('data/pack/client/interface'));
            } else if (url.pathname.startsWith('/media')) {
                return new Response(Bun.file('data/pack/client/media'));
            } else if (url.pathname.startsWith('/models')) {
                return new Response(Bun.file('data/pack/client/models'));
            } else if (url.pathname.startsWith('/textures')) {
                return new Response(Bun.file('data/pack/client/textures'));
            } else if (url.pathname.startsWith('/wordenc')) {
                return new Response(Bun.file('data/pack/client/wordenc'));
            } else if (url.pathname.startsWith('/sounds')) {
                return new Response(Bun.file('data/pack/client/sounds'));
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
                        members: Environment.NODE_MEMBERS
                    }), {
                        headers: {
                            'Content-Type': 'text/html'
                        }
                    });
                }
            } else if (fs.existsSync(`public${url.pathname}`)) {
                return new Response(Bun.file(`public${url.pathname}`), {
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
                if (Environment.WEB_ALLOWED_ORIGIN && ws.data.origin !== Environment.WEB_ALLOWED_ORIGIN) {
                    ws.terminate();
                    return;
                }

                ws.data.client.init(ws, ws.data.remoteAddress ?? ws.remoteAddress);

                const seed = new Packet(new Uint8Array(8));
                seed.p4(Math.floor(Math.random() * 0x00ffffff));
                seed.p4(Math.floor(Math.random() * 0xffffffff));
                ws.send(seed.data);
            },
            message(ws, message: Buffer) {
                try {
                    const { client } = ws.data;
                    if (client.state === -1 || client.remaining <= 0) {
                        client.terminate();
                        return;
                    }

                    client.buffer(message);

                    World.onClientData(client);
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
