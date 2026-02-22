import Packet from '#/io/Packet.js';
import ClientSocket from '#/server/ClientSocket.js';
import TcpClientSocket from '#/server/tcp/TcpClientSocket.js';
import { getGroup } from '#/util/OpenRS2.js';
import Js5PackReader from '#/io/Js5PackReader.js';

type Js5Request = {
    client: ClientSocket;
    archive: number;
    group: number;
}

class Js5 {
    urgentRequests: Js5Request[] = [];
    prefetchRequests: Js5Request[] = [];
    private clientEnumPack: Js5PackReader | null = null;
    private clientEnumPackLoaded = false;
    private clientMidiPack: Js5PackReader | null = null;
    private clientMidiPackLoaded = false;

    async cycle() {
        // todo: limit requests per client per cycle

        for (let i = 0; i < this.urgentRequests.length; i++) {
            const req = this.urgentRequests[i];
            this.sendAsync(req.client, false, req.archive, req.group);
            this.urgentRequests.splice(i--, 1);
        }

        for (let i = 0; i < this.prefetchRequests.length; i++) {
            const req = this.prefetchRequests[i];
            this.sendAsync(req.client, true, req.archive, req.group);
            this.prefetchRequests.splice(i--, 1);
        }

        setTimeout(this.cycle.bind(this), 50);
    }

    onClientData(client: ClientSocket) {
        if (client.state !== 2) {
            return;
        }

        const buf = new Packet(new Uint8Array(4));

        while (client.available >= 4) {
            client.read(buf.data, 0, 4);
            buf.pos = 0;

            const op = buf.g1();
            if (op === 0 || op === 1) {
                const archive = buf.g1();
                const group = buf.g2();

                if (op === 1) {
                    this.urgentRequests.push({ client, archive, group });
                } else {
                    this.prefetchRequests.push({ client, archive, group });
                }
            }
        }
    }

    private async send(client: ClientSocket, prefetch: boolean, archive: number, group: number) {
        if (client instanceof TcpClientSocket && !client.socket.writable) {
            return;
        }

        let data: Uint8Array | undefined;
        if (archive === 17) {
            data = this.getClientEnumGroup(group);
        } else if (archive === 6) {
            data = this.getClientMidiGroup(group);
        }

        if (!data) {
            data = await getGroup(archive, group);
        }
        if (!data || !data.length) {
            console.log('missing archive, group', archive, group);
            return;
        }

        if (archive === 255 && group === 255) {
            const response = new Packet(new Uint8Array(data.length + 3));
            response.p1(archive);
            response.p2(group);
            response.pdata(data, 0, data.length);
            client.send(response.data);
        } else {
            const ctype = data[0];
            const clen = data[1] << 24 | data[2] << 16 | data[3] << 8 | data[4];
            const len = ctype != 0 ? clen + 4 : clen;

            let settings = ctype;
            if (prefetch) {
                settings |= 0x80;
            }

            const response = new Packet(new Uint8Array(8 + len + Math.ceil(data.length / 512)));
            response.p1(archive);
            response.p2(group);
            response.p1(settings);
            response.p4(clen);

            for (let i = 5; i < len + 5; i++) {
                if ((response.pos % 512) == 0) {
                    response.p1(0xFF);
                }

                response.p1(data[i]);
            }

            client.send(response.data.subarray(0, response.pos));
        }
    }

    private sendAsync(client: ClientSocket, prefetch: boolean, archive: number, group: number): void {
        void this.send(client, prefetch, archive, group).catch(err => {
            console.warn('JS5 send failed', { archive, group, err });
        });
    }

    private getClientEnumGroup(group: number): Uint8Array | undefined {
        if (!this.clientEnumPackLoaded) {
            this.clientEnumPackLoaded = true;
            try {
                this.clientEnumPack = Js5PackReader.load('data/pack/client.enum.js5');
            } catch (err) {
                console.warn('Unable to load client enum js5pack, falling back to cache.', err);
                this.clientEnumPack = null;
            }
        }

        const data = this.clientEnumPack?.getGroup(group);
        if (!data || data.length === 0) {
            return undefined;
        }

        return data;
    }

    private getClientMidiGroup(group: number): Uint8Array | undefined {
        if (!this.clientMidiPackLoaded) {
            this.clientMidiPackLoaded = true;
            try {
                this.clientMidiPack = Js5PackReader.load('data/pack/client.midi.js5');
            } catch (err) {
                console.warn('Unable to load client midi js5pack, falling back to cache.', err);
                this.clientMidiPack = null;
            }
        }

        const data = this.clientMidiPack?.getGroup(group);
        if (!data || data.length === 0) {
            return undefined;
        }

        return data;
    }
}

export default new Js5();
