import net from 'net';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

import ejs from 'ejs';
import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import FastifyView from '@fastify/view';
import FastifyWebsocket from '@fastify/websocket';

import { CrcBuffer, CrcTable } from '#/cache/CrcTable.js';

import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';

import OnDemand from '#/engine/OnDemand.js';
import World from '#/engine/World.js';
import VoteService from '#/engine/vote/VoteService.js';

import NullClientSocket from '#/server/NullClientSocket.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

import WSClientSocket from '#/server/ws/WSClientSocket.js';
import ConnectionLimiter, { HANDSHAKE_TIMEOUT_MS, normalizeAddress } from '#/server/ConnectionLimiter.js';
import { isProxyProtocolEnabled, isTrustedProxy, readProxyHeader } from '#/server/ProxyProtocol.js';

import { printInfo, printWarning } from '#/util/Logger.js';
import Environment from '#/util/Environment.js';
import { tryParseInt } from '#/util/TryParse.js';

const fastify = Fastify({
    // logger: true
});

fastify.register(FastifyView, {
    engine: {
        ejs
    },
    root: 'view'
});

await fastify.register(FastifyWebsocket, {
    options: {
        maxPayload: 1600,
        perMessageDeflate: false,
        verifyClient: function (info, next) {
            if (Environment.WEB_ALLOWED_ORIGIN && info.req.headers.origin !== Environment.WEB_ALLOWED_ORIGIN) {
                next(false);
                return;
            }

            next(true);
        }
    }
});

// general routes

fastify.route({
    method: 'GET',
    url: '/',
    handler: (_req, reply) => {
        return reply.redirect('/rs2.cgi', 302);
    },
    wsHandler: (socket, req) => {
        const address = normalizeAddress(req.socket.remoteAddress);
        if (!ConnectionLimiter.tryAcquire(address)) {
            socket.terminate();
            return;
        }

        const client = new WSClientSocket(
            {
                get bufferedAmount() {
                    return socket.bufferedAmount;
                },
                send(data: Uint8Array) {
                    socket.send(data);
                },
                close() {
                    socket.close();
                },
                terminate() {
                    socket.terminate();
                }
            },
            address
        );

        // custom (2026-09-27) - the same rules as TCP (TcpServer): 30 seconds without a byte, or 30
        // seconds without finishing a login, and the socket is dropped. WebSockets had no timeout at all.
        const handshakeDeadline = setTimeout(() => {
            if (client.state === 0) {
                client.terminate();
            }
        }, HANDSHAKE_TIMEOUT_MS);
        let idleTimer = setTimeout(() => client.terminate(), 30000);

        socket.on('message', (message: Buffer<ArrayBufferLike>) => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => client.terminate(), 30000);

            try {
                if (client.state === -1 || client.remaining <= 0) {
                    client.terminate();
                    return;
                }

                client.buffer(message);

                if (client.state === 0) {
                    World.onClientData(client);
                } else if (client.state === 2) {
                    OnDemand.onClientData(client);
                }
            } catch {
                socket.terminate();
            }
        });

        socket.on('close', () => {
            clearTimeout(handshakeDeadline);
            clearTimeout(idleTimer);
            ConnectionLimiter.release(address);
            client.state = -1;
            OnDemand.onClientClosed(client);
            World.onClientClosed(client);

            if (client.player) {
                client.player.addSessionLog(LoggerEventType.ENGINE, 'WS socket closed');
                client.player.client = new NullClientSocket();
            }
        });

        socket.on('error', () => {
            socket.terminate();
        });
    }
});

// ------------------------------------------------------------------- the web client
//
// THE BROWSER PLAYS THE REAL CLIENT (2026-10-06). public/client.jar is the jar the launcher
// installs, and CheerpJ - a JVM compiled to WebAssembly - runs it in the tab. That is the whole
// design: there is one client, built from Client-Java, and the browser gets the same one rather
// than a second implementation of the protocol that has to be kept in step with it forever.
//
// It replaces public/client/client.js, which came with the server and is a web client for another
// game revision: it announces 274 at login where this server takes ENGINE_REVISION, and it frames
// 116 of the 256 server packets differently. The check further down still reads whatever bundle is
// there and says so, and that page is only served if a bundle ever turns up that agrees with us.
//
// WHAT THE PAGE HAS TO SUPPLY is a socket. A tab cannot open TCP, so jagex2/io/WsSocket.java asks
// the page for one through four CheerpJ natives, and the page gives it a WebSocket to this same
// server - the route at '/' above, which already carries both the login stream and the update
// stream and tells them apart by the first byte. lostcity.ws is what turns that path on inside the
// client; a desktop client never sets it.

// THE CLIENT IS 765 BY 503 and takes that from the canvas: it calls getElementById('canvas') and
// never sets a size. The page on live had the two the wrong way round, which drew the game into a
// tall narrow strip with most of it cut off.
const WEB_CLIENT_WIDTH = 765;
const WEB_CLIENT_HEIGHT = 503;

// AND THE DISPLAY HAS TO BE TALLER THAN THE CLIENT, BY A NUMBER NOBODY HERE CAN KNOW (2026-10-07).
//
// CheerpJ draws the game's window with a title bar of its own and packs the window to fit inside
// the display: measured against the real runtime, a display of 503 gives a window of 503 and a
// CONTENT AREA of 483, and the client's bottom 20 rows - its row of chat tabs - are never drawn.
// Not clipped at the edge of the page, where you might see them half-cut: not drawn at all.
//
// The title bar is 20 pixels here and 30 in the browser this was reported from, because its height
// comes from CheerpJ's own CSS and that follows the reader's font. A constant was wrong twice. So
// the page starts with far more room than any title bar could need - the window packs against
// THAT, which is what matters, because it only packs once - and then finds where the game actually
// ended up inside that room and slides the display so it lands in the hole.
//
// AND A THIRD TIME, BY NAME (2026-11-02). The sliding used to look for CheerpJ's title bar by its
// CSS class, '.cjWindow .cjTitleBar'. CheerpJ 4.3 has no such element - the whole runtime bundle
// contains no cjWindow and no cjTitleBar, only cjStatus, cjBordered and cjResizer - so the selector
// returned null, the slide never ran, and the display sat 160 pixels taller than the hole it is
// seen through. AWT centres the game in the room it was given, which put 80 pixels of nothing above
// the client and took 80 off the bottom: the reported "web client is still cutting off the bottom".
//
// So nothing is found by name any more. The game is a CANVAS of known size, and the page measures
// where that canvas is and slides the display by exactly that much. That is true whether the
// runtime draws a title bar, draws none, top-aligns the window or centres it - which is the point,
// because the answer has now changed twice under us.
const WEB_CLIENT_ROOM = 160;

// AND WIDE ENOUGH FOR THE PLUGIN SIDEBAR, WHICH IS BESIDE THE GAME AND NOT PART OF IT
// (2026-11-16). ViewBox adds the game canvas to BorderLayout.CENTER and the sidebar to EAST, so a
// desktop window GROWS by the sidebar's width and the game keeps its 765. A browser window cannot
// grow: it is packed into the display this page makes, and if that display is 765 then AWT takes
// the sidebar's width out of CENTER instead. Measured against the live page: the game's canvas is
// 472x503 with the sidebar open, 765 - 293. The client still draws its 765-wide frame into it, so
// the right 293 pixels of every screen - a third of the login box, the right-hand end of the title
// art, the whole right column in game - are simply clipped away.
//
// 293 is Theme.WIDTH (250) plus Theme.RAIL_WIDTH (34) plus the sidebar's insets, taken from the
// live page rather than from the constants, because the insets are a look-and-feel's to choose.
const WEB_SIDEBAR_ROOM = 293;

/** The whole window: the client, and the sidebar beside it. */
const WEB_WINDOW_WIDTH = WEB_CLIENT_WIDTH + WEB_SIDEBAR_ROOM;

const LAUNCHER_URL = 'https://github.com/coreysho/DeathPlateau-Client/releases/latest/download/Death-Plateau-Launcher.jar';

const clientJarPath = path.join(process.cwd(), 'public', 'client.jar');
const hasClientJar = existsSync(clientJarPath);

// The page that runs client.jar. Everything in it is this file's, so a change to the natives and a
// change to WsSocket.java are one commit apart rather than one hand-edit on the server apart.
const CHEERPJ_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Death Plateau</title>
<style>
  html, body { margin: 0; padding: 0; background: #000; color: #9a9a9a; font: 12px sans-serif; }
  /* The hole the game is seen through: exactly the client, with the display sliding up behind it
     by the height of CheerpJ's title bar, so the bar is out of sight above rather than taking a
     strip out of the page and a window button beside the game's own. */
  #screen { margin: 0 auto; width: ${WEB_WINDOW_WIDTH}px; max-width: 100%; height: ${WEB_CLIENT_HEIGHT}px; overflow: hidden; }
  #display { width: ${WEB_WINDOW_WIDTH}px; height: ${WEB_CLIENT_HEIGHT + WEB_CLIENT_ROOM}px; }
  #foot { text-align: center; padding: 6px; }
  #foot a { color: #c8a04a; }
  /* REAL, FOCUSABLE AND ON THE PAGE, because a phone raises its keyboard for a focused input and
     for nothing else - and an input parked off-screen does not reliably count as focusable on
     iOS. So it is a pixel in the corner at zero opacity rather than at left:-1000px. */
  #kbd { position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; border: 0; padding: 0; z-index: 5; }
  #kbdbar { display: none; text-align: center; padding: 8px; }
  #kbdbar button { background: #1b1b1b; color: #c8a04a; border: 1px solid #c8a04a; border-radius: 4px; padding: 10px 18px; font: 14px sans-serif; }
</style>
<script src="https://cjrtnc.leaningtech.com/4.3/loader.js"></script>
</head>
<body>
<div id="screen"><div id="display"></div></div>
<div id="kbdbar"><button id="kbdbtn" type="button">Keyboard</button></div>
<div id="foot">The browser client is slower than the real thing. <a href="${LAUNCHER_URL}">Download the launcher</a> to play properly.</div>
<script>
// A BROWSER TAB HAS NO TCP. jagex2/io/WsSocket.java declares these four as native and this is where
// they are implemented - CheerpJ looks for a function named Java_<class with dots as underscores>_<method>.
// They are async because CheerpJ awaits them, which is also what makes a blocking read work: the
// Java thread waits inside wsRead while the browser's event loop keeps running underneath it.
//
// Bytes cross as base64 because a string is the one thing documented to survive the boundary
// unchanged. The game stream is a few kilobytes a second, so the encoding is free in practice.
const SOCKETS = new Map();
let NEXT_SOCKET = 1;

function wake(s) {
    if (s.wake) { const w = s.wake; s.wake = null; w(); }
}

// THE WAY BACK INTO THE RUNNING CLIENT. Every native is handed CheerpJ's library object, and
// through it the page can read and write a STATIC FIELD of a class that is already running - which
// is the whole of the camera-drag fix below. A method call cannot be made from here while the game
// loop is going ("Java code still running"); a field write is just memory, and it lands.
let LIB = null;
let BROWSER_INPUT = null;
// A client.jar from before BrowserInput existed: asked once, then left alone rather than looked up
// again on every mouse move for the rest of the session.
let BROWSER_INPUT_MISSING = false;

const natives = {
    async Java_jagex2_io_WsSocket_wsOpen(lib, url) {
        if (LIB === null) {
            LIB = lib;
        }
        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        const s = { ws: ws, chunks: [], size: 0, closed: false, wake: null };
        ws.onmessage = e => {
            const b = new Uint8Array(e.data);
            s.chunks.push(b);
            s.size += b.length;
            wake(s);
        };
        ws.onclose = () => { s.closed = true; wake(s); };
        ws.onerror = () => { s.closed = true; wake(s); };
        const open = await new Promise(resolve => {
            if (ws.readyState === WebSocket.OPEN) { resolve(true); return; }
            ws.onopen = () => resolve(true);
            ws.addEventListener('close', () => resolve(false));
            setTimeout(() => resolve(ws.readyState === WebSocket.OPEN), 15000);
        });
        if (!open) return -1;
        const id = NEXT_SOCKET++;
        SOCKETS.set(id, s);
        return id;
    },

    // "" is "nothing yet", null is "this socket is gone" - the two things the Java side has to be
    // able to tell apart, since one is a wait and the other is an IOException.
    async Java_jagex2_io_WsSocket_wsRead(lib, handle, max, waitMillis) {
        const s = SOCKETS.get(handle);
        if (!s) return null;
        if (s.size === 0 && !s.closed && waitMillis > 0) {
            await new Promise(resolve => {
                s.wake = resolve;
                setTimeout(() => { if (s.wake === resolve) { s.wake = null; resolve(); } }, waitMillis);
            });
        }
        if (s.size === 0) return s.closed ? null : '';
        const out = new Uint8Array(Math.min(max, s.size));
        let n = 0;
        while (n < out.length) {
            const head = s.chunks[0];
            const take = Math.min(head.length, out.length - n);
            out.set(head.subarray(0, take), n);
            n += take;
            if (take === head.length) s.chunks.shift(); else s.chunks[0] = head.subarray(take);
            s.size -= take;
        }
        let bin = '';
        for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
        return btoa(bin);
    },

    async Java_jagex2_io_WsSocket_wsWrite(lib, handle, base64) {
        const s = SOCKETS.get(handle);
        if (!s || s.closed) return;
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        s.ws.send(bytes);
    },

    async Java_jagex2_io_WsSocket_wsClose(lib, handle) {
        const s = SOCKETS.get(handle);
        if (!s) return;
        s.closed = true;
        SOCKETS.delete(handle);
        try { s.ws.close(); } catch (e) { /* already gone */ }
    }
};

const display = document.getElementById('display');

// THE DISPLAY, ONCE THERE IS A GAME TO MEASURE. The display is created taller than the client on
// purpose so that whatever chrome the runtime wants has room, and the window packs against THAT -
// shrinking it first would shrink the window with it, which is how the bottom row of tabs went
// missing in the first place. What this does is find where the game actually landed inside that
// room and slide the whole display by exactly that much, so the game's top-left corner sits in the
// top-left of #screen.
//
// IT FINDS THE GAME BY ITS SIZE, NOT BY A CLASS NAME. The previous version looked for
// '.cjWindow .cjTitleBar'; CheerpJ 4.3 has no such element and the slide silently never ran. A
// canvas of the client's own dimensions is what the game IS, and that cannot be renamed.
//
// CheerpJ reads mouse positions off the canvas's own rectangle, so moving it moves the clicks with
// it and a click at the top left of the page still arrives as 0,0 in the client.
let slidX = -1;
let slidY = -1;
let looked = 0;
// The height of the hole the game is seen through. The client's own 503 on a desktop; on a phone
// the phone's, set below before the display is made.
let holeH = ${WEB_CLIENT_HEIGHT};
function gameCanvas() {
    // BY SHAPE, NOT BY SIZE, AND FOR THE FOURTH TIME BY SOMETHING THAT CANNOT MOVE (2026-11-16).
    //
    // Every size this has been matched on has since moved. 765x503 stopped matching when the
    // plugin sidebar landed and took the width out of the game. Then the height alone stopped
    // matching too, because on a phone the game is drawn at the screen's height and not at the
    // client's 503.
    //
    // What does not move is the ARRANGEMENT: CheerpJ draws the whole window - title bar and all -
    // into one canvas, and the game's own canvas sits inside it. So the window's is always the
    // larger, and the game's is the next one down. No number from this file appears in the test.
    const canvases = display.getElementsByTagName('canvas');
    const byArea = [];
    for (let i = 0; i < canvases.length; i++) {
        const r = canvases[i].getBoundingClientRect();
        if (r.width > 1 && r.height > 1) {
            byArea.push({ el: canvases[i], area: r.width * r.height });
        }
    }
    if (byArea.length === 0) {
        return null;
    }
    byArea.sort((a, b) => b.area - a.area);
    // One canvas and no window around it: that one is the game.
    return byArea.length === 1 ? byArea[0].el : byArea[1].el;
}
function fitWindow() {
    const canvas = gameCanvas();
    if (canvas === null) {
        // NEVER LEAVE THE BOTTOM HIDDEN. If the game cannot be found at all - a runtime that draws
        // it some other way, a size we did not expect - then showing the chrome is wrong but
        // survivable, and hiding the chat tabs is not. After ten seconds of looking, open the hole
        // to the full height of the display so nothing is cut off.
        if (++looked === 10) {
            document.getElementById('screen').style.height = (holeH + ${WEB_CLIENT_ROOM}) + 'px';
        }
        return;
    }
    const d = display.getBoundingClientRect();
    const r = canvas.getBoundingClientRect();
    const x = Math.round(r.left - d.left);
    const y = Math.round(r.top - d.top);
    if (x === slidX && y === slidY) {
        return;
    }
    slidX = x;
    slidY = y;
    document.getElementById('screen').style.height = holeH + 'px';
    display.style.marginTop = -y + 'px';
    display.style.marginLeft = -x + 'px';
}
new MutationObserver(fitWindow).observe(display, { childList: true, subtree: true });
setInterval(fitWindow, 1000);

// THE MIDDLE BUTTON, WHICH CHEERPJ NEVER PASSES ON (2026-10-07). Measured against the runtime: a
// pointerdown with button 0 reaches AWT as BUTTON1 and button 2 as BUTTON3, but button 1 - the
// wheel - is dropped. The release arrives, the press never does, and the moves in between carry no
// sign of it, so GameShell.middleMouseDown can never be true and the camera cannot be dragged.
//
// So the page watches the button itself and writes the running total of the drag into
// jagex2.client.BrowserInput, which GameShell.pollBrowserCameraDrag() turns into the same delta a
// real middle-drag would have made. Totals rather than deltas so that neither side can lose one.
let dragging = false;
let lastX = 0;
let lastY = 0;
let totalX = 0;
let totalY = 0;

// The class handle, asked for once. Both the camera drag and the phone's keyboard write through
// it, so it is fetched here rather than by whichever of them happens to run first.
async function browserInput() {
    if (BROWSER_INPUT !== null) {
        return BROWSER_INPUT;
    }
    if (LIB === null || BROWSER_INPUT_MISSING) {
        return null;
    }
    try {
        BROWSER_INPUT = await LIB.jagex2.client.BrowserInput;
    } catch (e) {
        BROWSER_INPUT_MISSING = true;
        return null;
    }
    if (!BROWSER_INPUT) {
        BROWSER_INPUT_MISSING = true;
        return null;
    }
    return BROWSER_INPUT;
}

async function pushCameraDrag() {
    if (BROWSER_INPUT === null) {
        if (await browserInput() === null) {
            return;
        }
    }
    BROWSER_INPUT.cameraDragX = totalX;
    BROWSER_INPUT.cameraDragY = totalY;
}

display.addEventListener('pointerdown', e => {
    if (e.button !== 1) {
        return;
    }
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
}, true);

// On window, not on the display: a drag that runs off the edge of the game should keep turning the
// camera, the way it does on the desktop, rather than stopping at the border.
window.addEventListener('pointermove', e => {
    if (!dragging) {
        return;
    }
    totalX += e.clientX - lastX;
    totalY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    pushCameraDrag();
}, true);

window.addEventListener('pointerup', e => {
    if (e.button === 1) {
        dragging = false;
    }
}, true);

// Chrome's middle-click autoscroll would otherwise take the button for itself - and leave the
// scrolling cursor stuck over the game.
display.addEventListener('mousedown', e => { if (e.button === 1) { e.preventDefault(); } }, true);
display.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); } }, true);

// THE PHONE'S KEYBOARD (2026-11-16). The game is a canvas, so no phone will ever put a keyboard
// up for it, and the player cannot type a username - which is the first thing the game asks for.
// A reported complaint, in those words: "no keyboard when trying to login with user".
//
// A real input, focused by a real tap, is what raises it. What is typed into that input is sent to
// jagex2.client.BrowserInput one key at a time, because a synthetic KeyboardEvent aimed at the
// canvas does NOT reach AWT - measured on the live page: three characters dispatched at the canvas,
// at document, at window and at body changed nothing, while the same characters as real key events
// landed in the username field. CheerpJ does not act on untrusted events.
//
// ANDROID DOES NOT SEND A USABLE BACKSPACE. Its soft keyboards report keyCode 229 for most keys and
// fire no useful keydown at all when the field is empty, so backspace cannot be read from keydown.
// The input therefore always holds one character - a non-breaking space nobody can see - and a
// backspace is recognised by that character going missing. Enter and Tab do arrive as keydown.
const keyOut = [];

function enqueueKey(code) {
    // A burst - a paste, a password manager's autofill - queues here and is delivered in order.
    if (keyOut.length < 256) {
        keyOut.push(code);
    }
}

async function pumpKeys() {
    if (keyOut.length === 0) {
        return;
    }
    const bi = await browserInput();
    if (bi === null) {
        return;
    }
    // ONE AT A TIME, ACKNOWLEDGED. The next key is written only once the game thread has taken the
    // last one, so a keystroke can never be overwritten before it is read. See BrowserInput.
    if (bi.typedSeq !== bi.typedAck) {
        return;
    }
    bi.typedKey = keyOut.shift();
    bi.typedSeq = bi.typedSeq + 1;
}
setInterval(pumpKeys, 16);

const SENTINEL = '\u00a0';
const kbd = document.createElement('input');
kbd.id = 'kbd';
kbd.type = 'text';
kbd.value = SENTINEL;
kbd.setAttribute('autocapitalize', 'none');
kbd.setAttribute('autocomplete', 'off');
kbd.setAttribute('autocorrect', 'off');
kbd.spellcheck = false;
document.body.appendChild(kbd);

function resetField() {
    kbd.value = SENTINEL;
    try {
        kbd.setSelectionRange(SENTINEL.length, SENTINEL.length);
    } catch (e) {
        /* a browser that will not place the caret still types fine */
    }
}

kbd.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        enqueueKey(10);
        e.preventDefault();
    } else if (e.key === 'Tab') {
        enqueueKey(9);
        e.preventDefault();
    }
});

kbd.addEventListener('input', () => {
    const v = kbd.value;
    if (v.indexOf(SENTINEL) !== 0) {
        // The sentinel itself was deleted: that is the backspace.
        enqueueKey(8);
    } else {
        const typed = v.slice(SENTINEL.length);
        for (let i = 0; i < typed.length; i++) {
            const c = typed.charCodeAt(i);
            if (c >= 32 && c <= 126) {
                enqueueKey(c);
            }
        }
    }
    resetField();
});

// THE RIGHT-CLICK MENU, WHICH A FINGER CANNOT ASK FOR (2026-11-16). Half of this game is that
// menu. CheerpJ 4.3 does read long presses, but it delivers them as a mouse HOVER - right for a
// Swing menu bar, no use here, because 377 opens its menu on a right PRESS and no amount of
// hovering produces one. And a synthetic mouse event is no more use than a synthetic key one.
//
// So the press is watched for here and sent to BrowserInput, where GameShell.pollBrowserTap()
// latches it as the right press it stands in for. Held and still, not dragged: a finger is never
// quite still, so a little movement is allowed before it is treated as a drag instead.
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 12;
let pressTimer = null;
let pressX = 0;
let pressY = 0;
// WORKED OUT WHEN THE FINGER LANDS, NOT WHEN THE TIMER FIRES. Nearly half a second passes between
// the two, and the canvas's rectangle is relative to the viewport - so anything that moves the
// page in that time (a scroll, the keyboard coming up) would move the rectangle out from under a
// clientX measured before it, and the menu would open somewhere the finger never was.
let pressCanvasX = 0;
let pressCanvasY = 0;

function cancelLongPress() {
    if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
}

async function sendLongPress() {
    const bi = await browserInput();
    if (bi === null) {
        return;
    }
    if (bi.tapSeq !== bi.tapAck) {
        return;
    }
    bi.tapX = pressCanvasX;
    bi.tapY = pressCanvasY;
    bi.tapSeq = bi.tapSeq + 1;
}

display.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') {
        return;
    }
    cancelLongPress();
    const canvas = gameCanvas();
    if (canvas === null) {
        return;
    }
    pressX = e.clientX;
    pressY = e.clientY;
    // The canvas's own pixels, which is what AWT would have reported. A scaled frame scales this
    // back in mapInput with every other mouse coordinate.
    const r = canvas.getBoundingClientRect();
    pressCanvasX = Math.round(e.clientX - r.left);
    pressCanvasY = Math.round(e.clientY - r.top);
    pressTimer = setTimeout(() => {
        pressTimer = null;
        sendLongPress();
    }, LONG_PRESS_MS);
}, true);

display.addEventListener('pointermove', e => {
    if (pressTimer === null || e.pointerType !== 'touch') {
        return;
    }
    if (Math.abs(e.clientX - pressX) > LONG_PRESS_SLOP || Math.abs(e.clientY - pressY) > LONG_PRESS_SLOP) {
        cancelLongPress();
    }
}, true);

display.addEventListener('pointerup', cancelLongPress, true);
display.addEventListener('pointercancel', cancelLongPress, true);

// Only where there is no real keyboard to begin with. A desktop browser types straight into the
// canvas, as it always has, and never sees the bar.
const COARSE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
if (COARSE) {
    document.getElementById('kbdbar').style.display = 'block';
}
document.getElementById('kbdbtn').addEventListener('click', () => {
    // iOS raises the keyboard only from inside a real gesture, which this click is.
    resetField();
    kbd.focus();
});

// THE DISPLAY IS THE PHONE'S, NOT THE GAME'S (2026-11-16).
//
// Everywhere else this page makes a display the size of the game and lets the page scroll. On a
// phone there is no size of page that helps: the game is 765x503 and the screen is smaller than
// that in at least one direction whichever way up it is held. Scaling the display with CSS is not
// the answer either - CheerpJ maps a CSS pixel to an AWT pixel one for one and reads the mouse off
// the canvas's rectangle, so the picture moves and the clicks do not (measured: at 0.5 a tap on a
// widget misses it, and the far half of the window stops being reachable at all).
//
// So the window is made the size of the screen and the CLIENT draws its frame scaled to fit, with
// the mouse scaled back the same way - see Client's scaled mode, which turns itself on exactly
// when the window is smaller than the game. The two properties below are how it learns the size;
// without them the game opens at 765x503 and ViewBox holds the window at its minimum, and the
// scale could never come on.
// THE CANVAS IS NINE TIMES THE SIZE OF THE SCREEN (2026-11-16). Measured on a phone: CheerpJ makes
// its canvas at devicePixelRatio, which is 3 there, so a 765x503 client is a 2295x1509 backing
// store - 3.46 million pixels to push for every frame, on the slowest processor that will ever run
// this. Capping the ratio at 1 is nine times less of that.
//
// OPT IN, FOR NOW. CheerpJ is not documented on what else it reads the ratio for, and if it uses it
// for pointer positions as well then capping it would silently move every click - which is the one
// failure that would be hard to tell from "the game is broken". So it is a query parameter until
// somebody has held a phone and checked both: ?lowdpi=1 to try it. If clicks still land where they
// look, this becomes the default for coarse pointers and the parameter goes away.
if (new URLSearchParams(location.search).has('lowdpi')) {
    try {
        Object.defineProperty(window, 'devicePixelRatio', { get: () => 1, configurable: true });
    } catch (e) {
        /* a browser that will not let it be redefined simply keeps its own ratio */
    }
}

let viewW = ${WEB_WINDOW_WIDTH};
let viewH = ${WEB_CLIENT_HEIGHT};
if (COARSE) {
    // visualViewport, where there is one: innerHeight on a phone includes the browser's own bars
    // on some versions and not others, and the difference is the row of chat tabs again.
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : window.innerWidth);
    const vh = Math.round(vv ? vv.height : window.innerHeight);
    // Room under the game for the Keyboard button, which has to stay reachable.
    viewW = Math.max(240, vw);
    viewH = Math.max(240, vh - 52);
    holeH = viewH;
    const screenEl = document.getElementById('screen');
    screenEl.style.width = viewW + 'px';
    screenEl.style.height = viewH + 'px';
    display.style.width = viewW + 'px';
    display.style.height = (viewH + ${WEB_CLIENT_ROOM}) + 'px';
}

(async function () {
    const port = location.port || (location.protocol === 'https:' ? '443' : '80');
    const ws = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/';
    await cheerpjInit({
        version: 8,
        natives: natives,
        // The client reads its server from these (Client.SERVER_HOST and friends). Everything it
        // needs - the cache archives and the game stream both - is this same origin, so the page
        // tells it where it is rather than leaving it pointed at whatever the jar was built with.
        javaProperties: [
            'lostcity.host=' + location.hostname,
            'lostcity.webhost=' + location.hostname,
            'lostcity.webport=' + port,
            // The cache comes from wherever this page came from, scheme included. A page on https
            // whose client fetched http would have every archive blocked as mixed content.
            'lostcity.weburl=' + location.origin,
            'lostcity.ws=' + ws,
            // CheerpJ keeps /files in the browser's own storage, so the client's file store
            // survives a reload and the animations and models are downloaded once rather than
            // every visit. signlink.findcachedir reads this.
            'lostcity.cachedir=/files/.deathplateau',
            // DisplaySettings.startWidth/startHeight and the window's minimum. A desktop browser
            // sends the game's own size, which is what it has always opened at.
            'lostcity.screenwidth=' + viewW,
            'lostcity.screenheight=' + viewH
        ]
    });
    cheerpjCreateDisplay(viewW, viewH + ${WEB_CLIENT_ROOM}, display);
    await cheerpjRunMain('jagex2.client.Client', '/app/client.jar');
})();
</script>
</body>
</html>
`;

// Served when there is no client.jar and no usable bundle: the launcher is the way in, and a page
// that says so is better than one that loads a client which cannot log in.
const LAUNCHER_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Death Plateau</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0b0b0d; color: #d8d8d8;
               font: 15px/1.6 sans-serif; display: flex; align-items: center; justify-content: center; }
  main { max-width: 32em; padding: 2em; text-align: center; }
  h1 { font-size: 1.6em; margin: 0 0 .2em; color: #e8e8e8; }
  p.slogan { color: #8d8d8d; margin: 0 0 2em; }
  a.get { display: inline-block; padding: .7em 1.4em; background: #c8a04a; color: #1a1a1a;
          text-decoration: none; border-radius: 3px; font-weight: bold; }
  p.small { color: #777; font-size: .9em; margin-top: 2em; }
</style>
</head>
<body>
<main>
<h1>Death Plateau</h1>
<p class="slogan">The true golden era.</p>
<p>The game runs from the launcher - it keeps itself up to date and plays at full speed.</p>
<p><a class="get" href="${LAUNCHER_URL}">Download the launcher</a></p>
<p class="small">Java is required. There is no browser client on this world right now.</p>
</main>
</body>
</html>
`;

// Served when public/rs2.cgi is missing and a usable bundle is present.
const DEFAULT_RS2CGI = `<!DOCTYPE html>
<html>
<head>
<title>Death Plateau</title>
<style>
  html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
  canvas { display: block; margin: 0 auto; image-rendering: pixelated; }
</style>
</head>
<body>
<canvas id="canvas" width="${WEB_CLIENT_WIDTH}" height="${WEB_CLIENT_HEIGHT}"></canvas>
<script type="module">
  import { Client } from '/client/client.js';
  new Client(${Environment.NODE_ID}, false, ${Environment.NODE_MEMBERS});
</script>
</body>
</html>
`;

// COMPONENT TYPE 8 is a 377 interface component that holds one string, and this content uses it -
// the combat tab's Auto Retaliate area is one. The Java client reads it (jagex2/config/Component.java)
// and so does the server (cache/config/Component.ts), but an older web client bundle has no branch
// for it: it reads the type, falls through every case without consuming the string, and from there
// every following component is read out of the middle of the one before. It dies about two thirds of
// the way through with "Unpacking interfaces 95%: Offset is outside the bounds of the DataView" and
// the game never loads at all. tools/sim/ifunpack.ts walks the archive the same way and names it.
//
// So a bundle that cannot read this cache is repaired on the way out. The anchor is the end of the
// type 7 block, which is where the string belongs; a bundle that already handles type 8, or one
// minified differently enough that the anchor is gone, is served exactly as it is and says so.
const WEB_CLIENT_COM8_ANCHOR = '0===T.Ml[N].length&&(T.Ml[N]=null)}2!==T.Rm&&2!==T.type||(';
const WEB_CLIENT_COM8_PATCH = '0===T.Ml[N].length&&(T.Ml[N]=null)}8===T.type&&(T.text=t.xa()),2!==T.Rm&&2!==T.type||(';

// NONE OF WHICH IS LOOKED AT WHEN THERE IS A client.jar. The bundle is then not served, not
// patched and not consulted, so reading it would only put three warnings about a file nobody
// fetches into every startup - which reads like something is wrong, every boot, forever.
const clientJsPath = path.join(process.cwd(), 'public', 'client', 'client.js');
let bundleCanPlay = false;
if (hasClientJar && existsSync(clientJsPath)) {
    printInfo('web client: public/client/client.js is present and unused - client.jar is what the browser runs');
} else if (existsSync(clientJsPath)) {
    let clientJs = readFileSync(clientJsPath, 'utf8');
    if (clientJs.includes('8===T.type')) {
        printInfo('web client: reads interface component type 8 already');
    } else if (clientJs.includes(WEB_CLIENT_COM8_ANCHOR)) {
        clientJs = clientJs.replace(WEB_CLIENT_COM8_ANCHOR, WEB_CLIENT_COM8_PATCH);
        printWarning('web client: patched in interface component type 8, which this bundle could not read');
    } else {
        printWarning('web client: cannot tell whether this bundle reads interface component type 8 - if it will not load past "Unpacking interfaces", that is why');
    }

    // WHICH CLIENT THIS IS. The bundle is not built from this repository - it came with the server
    // and is maintained nowhere - so the only way to know whether it can play here is to read it.
    // Two things in it say so, and both have cost an evening:
    //
    //   THE BUILD HANDSHAKE it sends at login (`p1(255), p2(<rev>)`), which World.onClientData
    //   compares with ENGINE_REVISION and refuses with response 6. The client then shows "has been
    //   updated! Please reload this page", which reads like a stale cache and is not one: the
    //   bundle sends that same number every time, so no reload can fix it.
    //
    //   ITS TABLE OF SERVER PACKET LENGTHS, which is what frames the stream. A bundle that
    //   disagrees here cannot be let in by relaxing the revision - it would read one packet out of
    //   the middle of another the first time the server sent one it frames differently.
    const rev = /p1\(255\),\s*[\w$.]+\.p2\((\d+)\)/.exec(clientJs);
    const revOk = rev !== null && Number(rev[1]) === Environment.ENGINE_REVISION;
    if (!rev) {
        printWarning('web client: cannot find the build handshake in this bundle');
    } else if (!revOk) {
        printWarning(`web client: this bundle logs in as revision ${rev[1]} and the server takes only ${Environment.ENGINE_REVISION} - every login is refused with "has been updated, please reload this page", and reloading cannot help`);
    }
    // The longest numeric array literal in the bundle is that packet length table.
    const arrays = clientJs.match(/\[-?\d+(?:,-?\d+){200,}\]/g) ?? [];
    const table = arrays.map(a => JSON.parse(a) as number[]).sort((a, b) => b.length - a.length)[0];
    let protOk = false;
    if (table) {
        const ours: number[] = new Array(256).fill(0);
        for (const prot of Object.values(ServerGameProt)) {
            if (prot instanceof ServerGameProt) ours[prot.id] = prot.length;
        }
        for (const prot of Object.values(ServerGameZoneProt)) {
            if (prot instanceof ServerGameZoneProt) ours[prot.id] = prot.length;
        }
        let differ = 0;
        for (let i = 0; i < 256; i++) {
            if ((table[i] ?? 0) !== ours[i]) differ++;
        }
        protOk = differ === 0;
        if (differ > 0) {
            printWarning(`web client: this bundle frames ${differ} of 256 server packets differently - it is a client for another revision and cannot play here, whatever it is allowed to log in as`);
        }
    }
    bundleCanPlay = revOk && protOk;

    const patched = clientJs;
    fastify.get('/client/client.js', (_req, reply) => {
        reply.type('text/javascript').send(patched);
    });
}

// WHAT THE FRONT PAGE IS, in the order of what can actually be played: the real client under
// CheerpJ, else a bundle that agrees with this server's protocol, else the launcher.
let rs2cgiHtml: string;
if (hasClientJar) {
    rs2cgiHtml = CHEERPJ_PAGE;
    printInfo('web client: serving public/client.jar through CheerpJ');
} else if (bundleCanPlay) {
    const rs2cgiPath = path.join(process.cwd(), 'public', 'rs2.cgi');
    rs2cgiHtml = existsSync(rs2cgiPath) ? readFileSync(rs2cgiPath, 'utf8') : DEFAULT_RS2CGI;

    const canvas = /<canvas[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/.exec(rs2cgiHtml);
    if (canvas && (canvas[1] !== String(WEB_CLIENT_WIDTH) || canvas[2] !== String(WEB_CLIENT_HEIGHT))) {
        printWarning(`public/rs2.cgi declares a ${canvas[1]}x${canvas[2]} canvas; the client draws ${WEB_CLIENT_WIDTH}x${WEB_CLIENT_HEIGHT} - serving a corrected page`);
        rs2cgiHtml = rs2cgiHtml.replace(canvas[0], canvas[0].replace(`width="${canvas[1]}"`, `width="${WEB_CLIENT_WIDTH}"`).replace(`height="${canvas[2]}"`, `height="${WEB_CLIENT_HEIGHT}"`));
    }
} else {
    rs2cgiHtml = LAUNCHER_PAGE;
    printWarning('web client: no public/client.jar and no bundle that can play here - serving the launcher page instead');
}
fastify.get('/rs2.cgi', (_req, reply) => {
    reply.type('text/html').send(rs2cgiHtml);
});

// cache routes

fastify.get('/crc:cachebust', async (_req, reply) => {
    reply.send(CrcBuffer.data);
});

fastify.get<{ Params: { crc: string } }>('/title:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[1]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 1));
});

fastify.get<{ Params: { crc: string } }>('/config:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[2]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 2));
});

fastify.get<{ Params: { crc: string } }>('/interface:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[3]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 3));
});

fastify.get<{ Params: { crc: string } }>('/media:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[4]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 4));
});

fastify.get<{ Params: { crc: string } }>('/versionlist:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[5]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 5));
});

fastify.get<{ Params: { crc: string } }>('/textures:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[6]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 6));
});

fastify.get<{ Params: { crc: string } }>('/wordenc:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[7]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 7));
});

fastify.get<{ Params: { crc: string } }>('/sounds:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[8]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 8));
});

// Toplists POST their callbacks as HTML form data about as often as JSON, and Fastify answers 415
// to a content type it has no parser for. This is that parser, rather than a dependency on
// @fastify/formbody for twelve lines. Nothing else here accepts a POST body.
fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    try {
        done(null, Object.fromEntries(new URLSearchParams(body as string)));
    } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)), undefined);
    }
});

// vote callback (custom, 2026-10-27) - see engine/vote/VoteService.ts
//
// What a toplist calls when somebody votes. The site is given <server>/vote/<id>/callback and a
// shared secret; this checks the secret, writes the vote down once, and hands the tickets over if
// the player happens to be online.
//
// GET AND POST, AND QUERY AND BODY MERGED, because sites disagree and several send the same values
// in both. The answers are deliberately dull - a site is a machine, it wants a status and a word -
// and an unknown site and a wrong secret answer identically, so neither can be probed for.
fastify.route<{ Params: { site: string } }>({
    method: ['GET', 'POST'],
    url: '/vote/:site/callback',
    handler: async (req, reply) => {
        const { status, body } = VoteService.fromHttp(req.params.site, req.query, req.body);
        reply.status(status).type('text/plain').send(body);
    }
});

// THE SAME THING WITH THE SECRET IN THE PATH, for a site that sends no secret of its own and
// appends its own query to whatever url you give it - TopG does both. See VoteService's note at
// the secret check for why neither the query string nor the source address works there.
fastify.route<{ Params: { site: string; secret: string } }>({
    method: ['GET', 'POST'],
    url: '/vote/:site/callback/:secret',
    handler: async (req, reply) => {
        const { status, body } = VoteService.fromHttp(req.params.site, req.query, req.body, req.params.secret);
        reply.status(status).type('text/plain').send(body);
    }
});

fastify.register(FastifyStatic, {
    root: path.join(process.cwd(), 'public')
});

export async function startWeb() {
    if (!isProxyProtocolEnabled()) {
        await fastify.listen({ port: Environment.WEB_PORT, host: '0.0.0.0' });
        return;
    }

    // custom (2026-09-27) - behind a proxy that sends PROXY protocol (server/ProxyProtocol.ts). The web
    // server does not listen itself: this does, takes the header off a proxied connection, and hands
    // the socket on carrying the player's address - which is what req.socket.remoteAddress (the
    // WebSocket game connection, ConnectionLimiter) and req.ip read.
    await fastify.ready();
    const server = net.createServer(socket => {
        socket.on('error', () => socket.destroy());

        if (!isTrustedProxy(normalizeAddress(socket.remoteAddress))) {
            fastify.server.emit('connection', socket);
            return;
        }

        readProxyHeader(socket).then(player => {
            if (player === null) {
                return;
            }

            Object.defineProperty(socket, 'remoteAddress', { value: player, configurable: true });
            // Node's HTTP server normally reads the socket's handle directly, which would jump ahead of
            // the bytes readProxyHeader put back. Marked consumed, it reads them through the stream, in order.
            const handle = (socket as unknown as { _handle?: { _consumed?: boolean } })._handle;
            if (handle) {
                handle._consumed = true;
            }
            fastify.server.emit('connection', socket);
            socket.resume();
        });
    });

    await new Promise<void>(resolve => server.listen(Environment.WEB_PORT, '0.0.0.0', resolve));
}

// The management port (/prometheus, /reboot) is server/management/ManagementWeb.ts, not here:
// the login server starts it, and importing this file to do that re-ran all of it - the pages,
// the routes, the client jar - inside the login worker. See the comment there.
