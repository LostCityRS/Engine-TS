import ClientSocket from '#/server/ClientSocket.js';
import { WebSocketData } from '#/web.js';

export default class WSClientSocket extends ClientSocket {
    socket: Bun.ServerWebSocket<WebSocketData> | null = null;

    constructor() {
        super();
    }

    init(socket: Bun.ServerWebSocket<WebSocketData>, remoteAddress: string) {
        this.socket = socket;
        this.remoteAddress = remoteAddress;
    }

    send(src: Uint8Array): void {
        if (this.socket) {
            this.socket.send(src);
        }
    }

    close(): void {
        // give time to acknowledge and receive packets
        this.state = -1;

        setTimeout(() => {
            if (this.socket) {
                this.socket.close();
            }
        }, 1000);
    }

    terminate(): void {
        this.state = -1;

        if (this.socket) {
            this.socket.terminate();
        }
    }
}
