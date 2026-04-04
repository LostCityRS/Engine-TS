import fs from 'fs';
import http, { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'http';
import path from 'path';
import { Readable } from 'stream';
import type { ReadableStream as NodeReadableStream } from 'stream/web';

import ejs from 'ejs';
import { register } from 'prom-client';
import { WebSocketServer } from 'ws';

import { CrcBuffer } from '#/cache/CrcTable.js';
import World from '#/engine/World.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import NullClientSocket from '#/server/NullClientSocket.js';
import WSClientSocket from '#/server/ws/WSClientSocket.js';
import Environment from '#/util/Environment.js';
import OnDemand from '#/engine/OnDemand.js';
import { tryParseInt } from '#/util/TryParse.js';

export type WebSocketData = {
    client: WSClientSocket;
    origin: string | null;
    remoteAddress: string;
};

const MIME_TYPES = new Map<string, string>();
MIME_TYPES.set('.js', 'application/javascript');
MIME_TYPES.set('.mjs', 'application/javascript');
MIME_TYPES.set('.css', 'text/css');
MIME_TYPES.set('.html', 'text/html');
MIME_TYPES.set('.wasm', 'application/wasm');
MIME_TYPES.set('.sf2', 'application/octet-stream');

function getHeader(headers: Headers | IncomingHttpHeaders, name: string): string | null {
    if (headers instanceof Headers) {
        return headers.get(name);
    }

    const value = headers[name.toLowerCase()];
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    return value ?? null;
}

function resolveContentPath(name: string): string | null {
    let decodedName: string;
    try {
        decodedName = decodeURIComponent(name);
    } catch {
        return null;
    }

    const contentRoot = path.resolve(Environment.BUILD_SRC_DIR);
    const targetPath = path.resolve(contentRoot, decodedName);
    const relativePath = path.relative(contentRoot, targetPath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return null;
    }

    return targetPath;
}

function streamFile(filePath: string, contentType?: string): Response {
    return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
        headers: {
            'Content-Type': contentType ?? MIME_TYPES.get(path.extname(filePath)) ?? 'text/plain'
        }
    });
}

function isRegularFile(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

async function handleWebRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET') {
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
        } else if (url.pathname.startsWith('/ondemand.zip')) {
            return streamFile('data/pack/ondemand.zip', 'application/octet-stream');
        } else if (url.pathname.startsWith('/build')) {
            return streamFile('data/pack/server/build', 'application/octet-stream');
        } else if (url.pathname === '/rs2.cgi') {
            const plugin = tryParseInt(url.searchParams.get('plugin'), 0);
            const lowmem = tryParseInt(url.searchParams.get('lowmem'), 0);

            if (Environment.NODE_DEBUG && plugin === 1) {
                return new Response(
                    await ejs.renderFile('view/java.ejs', {
                        nodeid: Environment.NODE_ID,
                        lowmem,
                        members: Environment.NODE_MEMBERS,
                        portoff: Environment.NODE_PORT - 43594
                    }),
                    {
                        headers: {
                            'Content-Type': 'text/html'
                        }
                    }
                );
            }

            return new Response(
                await ejs.renderFile('view/client.ejs', {
                    nodeid: Environment.NODE_ID,
                    lowmem,
                    members: Environment.NODE_MEMBERS
                }),
                {
                    headers: {
                        'Content-Type': 'text/html'
                    }
                }
            );
        } else if (url.pathname === '/worldmap.jag') {
            if (isRegularFile('data/pack/mapview/worldmap.jag')) {
                return streamFile('data/pack/mapview/worldmap.jag', 'application/octet-stream');
            }
        } else if (Environment.NODE_DEBUG) {
            if (url.pathname === '/maped') {
                return new Response(await ejs.renderFile('view/maped.ejs'), {
                    headers: {
                        'Content-Type': 'text/html'
                    }
                });
            } else if (url.pathname.startsWith('/content/')) {
                const name = url.pathname.replace('/content/', '');
                const filePath = resolveContentPath(name);
                if (!filePath || !isRegularFile(filePath)) {
                    return new Response(null, { status: 404 });
                }

                return streamFile(filePath, MIME_TYPES.get(path.extname(url.pathname ?? '')) ?? 'text/plain');
            } else if (url.pathname.startsWith('/data/')) {
                const name = url.pathname.replace('/data/', '');
                const filePath = `data/${name}`;
                if (!isRegularFile(filePath)) {
                    return new Response(null, { status: 404 });
                }

                return streamFile(filePath, MIME_TYPES.get(path.extname(url.pathname ?? '')) ?? 'text/plain');
            }
        }

        const publicPath = `public${url.pathname}`;
        if (isRegularFile(publicPath)) {
            return streamFile(publicPath, MIME_TYPES.get(path.extname(url.pathname ?? '')) ?? 'text/plain');
        }
    } else if (req.method === 'PUT' && Environment.NODE_DEBUG && url.pathname.startsWith('/content/')) {
        const name = url.pathname.replace('/content/', '');
        const filePath = resolveContentPath(name);
        if (!filePath) {
            return new Response(null, { status: 400 });
        }

        const body = new Uint8Array(await req.arrayBuffer());
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, body);
        return new Response(null, { status: 200 });
    }

    return new Response(null, { status: 404 });
}

async function handleManagementRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/prometheus') {
        return new Response(await register.metrics(), {
            headers: {
                'Content-Type': register.contentType
            }
        });
    }

    if (url.pathname === '/memory') {
        return new Response(JSON.stringify(World.getMemorySnapshot(), null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    return new Response(null, { status: 404 });
}

function createNodeRequest(req: IncomingMessage, fallbackPort: number): Request {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${fallbackPort}`}`);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'undefined') {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                headers.append(key, item);
            }
        } else {
            headers.set(key, value);
        }
    }

    if (method === 'GET' || method === 'HEAD') {
        return new Request(url, { method, headers });
    }

    return new Request(url, {
        method,
        headers,
        body: Readable.toWeb(req) as ReadableStream,
        duplex: 'half'
    });
}

async function writeNodeResponse(res: ServerResponse, response: Response): Promise<void> {
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
        res.setHeader(key, value);
    });

    if (!response.body) {
        res.end();
        return;
    }

    await new Promise<void>((resolve, reject) => {
        Readable.fromWeb(response.body as unknown as NodeReadableStream).pipe(res);
        res.on('finish', resolve);
        res.on('error', reject);
    });
}

async function startNodeWeb(): Promise<void> {
    const server = http.createServer(async (req, res) => {
        try {
            const response = await handleWebRequest(createNodeRequest(req, Environment.WEB_PORT));
            await writeNodeResponse(res, response);
        } catch (err) {
            console.error(err);
            res.statusCode = 500;
            res.end();
        }
    });

    const websocket = new WebSocketServer({
        noServer: true,
        maxPayload: 2000
    });

    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${Environment.WEB_PORT}`}`);
        if (url.pathname !== '/') {
            socket.destroy();
            return;
        }

        const origin = getHeader(req.headers, 'origin');
        if (Environment.WEB_ALLOWED_ORIGIN && origin !== Environment.WEB_ALLOWED_ORIGIN) {
            socket.destroy();
            return;
        }

        websocket.handleUpgrade(req, socket, head, ws => {
            const client = new WSClientSocket();
            client.init(
                {
                    send(data: Uint8Array) {
                        ws.send(data);
                    },
                    close() {
                        ws.close();
                    },
                    terminate() {
                        ws.terminate();
                    }
                },
                req.socket.remoteAddress ?? 'unknown'
            );

            ws.on('message', message => {
                try {
                    if (client.state === -1 || client.remaining <= 0) {
                        client.terminate();
                        return;
                    }

                    const data = Buffer.isBuffer(message) ? message : Buffer.from(message as ArrayBuffer);
                    client.buffer(data);

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
            });

            ws.on('close', () => {
                client.state = -1;

                if (client.player) {
                    client.player.addSessionLog(LoggerEventType.ENGINE, 'WS socket closed');
                    client.player.client = new NullClientSocket();
                }
            });

            ws.on('error', () => {
                ws.terminate();
            });
        });
    });

    await new Promise<void>(resolve => {
        server.listen(Environment.WEB_PORT, '0.0.0.0', () => resolve());
    });
}

async function startBunWeb(): Promise<void> {
    Bun.serve<WebSocketData, never>({
        port: Environment.WEB_PORT,
        async fetch(req, server) {
            const url = new URL(req.url ?? `http://${req.headers.get('host')}`);

            if (req.method === 'GET' && url.pathname === '/') {
                const upgraded = server.upgrade(req, {
                    data: {
                        client: new WSClientSocket(),
                        origin: req.headers.get('origin'),
                        remoteAddress: 'unknown'
                    }
                });

                if (upgraded) {
                    return undefined;
                }

                return new Response(null, { status: 404 });
            }

            return handleWebRequest(req);
        },
        websocket: {
            maxPayloadLength: 2000,
            open(ws) {
                if (Environment.WEB_ALLOWED_ORIGIN && ws.data.origin !== Environment.WEB_ALLOWED_ORIGIN) {
                    ws.terminate();
                    return;
                }

                ws.data.client.init(ws, ws.data.remoteAddress ?? ws.remoteAddress);
            },
            message(ws, message: string | Buffer) {
                try {
                    const { client } = ws.data;
                    if (client.state === -1 || client.remaining <= 0) {
                        client.terminate();
                        return;
                    }

                    client.buffer(typeof message === 'string' ? Buffer.from(message) : message);

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

async function startNodeManagementWeb(): Promise<void> {
    const server = http.createServer(async (req, res) => {
        try {
            const response = await handleManagementRequest(createNodeRequest(req, Environment.WEB_MANAGEMENT_PORT));
            await writeNodeResponse(res, response);
        } catch (err) {
            console.error(err);
            res.statusCode = 500;
            res.end();
        }
    });

    await new Promise<void>(resolve => {
        server.listen(Environment.WEB_MANAGEMENT_PORT, '0.0.0.0', () => resolve());
    });
}

async function startBunManagementWeb(): Promise<void> {
    Bun.serve({
        port: Environment.WEB_MANAGEMENT_PORT,
        fetch(req) {
            return handleManagementRequest(req);
        }
    });
}

export async function startWeb() {
    if (Environment.IS_BUN) {
        await startBunWeb();
    } else {
        await startNodeWeb();
    }
}

export async function startManagementWeb() {
    if (Environment.IS_BUN) {
        await startBunManagementWeb();
    } else {
        await startNodeManagementWeb();
    }
}
