import { randomUUID } from 'crypto';

import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import Isaac from '#/io/Isaac.js';
import Packet from '#/io/Packet.js';

export default abstract class ClientSocket {
    uuid = randomUUID();
    remoteAddress = 'unknown';
    totalBytesRead = 0;
    totalBytesWritten = 0;

    state = 0;
    player: NetworkPlayer | null = null;
    encryptor: Isaac | null = null;
    decryptor: Isaac | null = null;

    in = Packet.alloc(65535); // node won't let us read from the socket as a stream so we buffer it ourselves
    // alloc(2) is 30000 bytes, not alloc(1)'s 5000. One server message is encoded into this
    // buffer and sent, and Packet's writes go through DataView, which THROWS past the end instead
    // of wrapping - so the largest single message the server can ever send has to fit. That used
    // to be an inv update, at up to 7 bytes a slot: 5000 bytes held 713 slots and the 1410-slot
    // bank needs 9873 in the worst case. The client's inbound buffer was raised to match.
    out = Packet.alloc(2);

    opcode = -1; // current opcode being read

    // A client that did not set 0x2 in the login info byte predates hitsplats 5-7 (venom, heal, max hit)
    // and has no sprites for them - it would draw nothing, or fail. The player/npc info encoders send it
    // the nearest old splat instead (HitType.legacyHitType). A socketless player (a bot, a sim) has no
    // client to draw with, so it is never legacy.
    legacyHitmarks = false;

    // custom (2026-11-15) - the launcher's Discord sign-in, read out of the login block and kept
    // here until there is a player to hang it on (World.onLoginMessage). It is an opaque token the
    // website minted, worth the NAMES of the characters linked to that Discord account and nothing
    // else: it cannot log anybody in, and the auto-link it drives refuses to overwrite a link that
    // already exists. '' for every login that did not come from a signed-in launcher, which is
    // every login from the browser client.
    launcherSignIn = '';
    waiting = 0; // bytes to wait for (if any)

    // custom (2026-11-03) - WHEN EACH PACKET ARRIVED, which is not when the tick got round to
    // reading it and not when its batch began either.
    //
    // The world reads its input once a tick, so a handler asking Date.now() is asking when the
    // tick reached it: every round trip measured a whole tick (575 ms on loopback). The first fix
    // stamped the start of each unread batch, which is right only for a client that was otherwise
    // silent. A client being played is never silent - mouse, camera and movement packets arrive
    // continuously - so the stamp almost always belonged to an earlier packet in the same 600 ms
    // window and the measured round trip came out far too low, or 0 where that packet had landed
    // before the probe was even sent. A player on a 30 ms connection saw 1 ms and 2 ms.
    //
    // So arrivals are kept per chunk against the byte offset they end at, and a read looks up the
    // offset it is about to consume. Chunks are coalesced when they share a millisecond, which is
    // both free precision-wise and the bound on this list: a flood of one-byte segments cannot
    // grow it past one entry per millisecond. The hard cap is the backstop for a clock that does
    // not advance between them.
    private static readonly MAX_ARRIVALS: number = 1024;
    // end: cumulative received bytes this chunk runs to. at: when it landed.
    private arrivals: { end: number; at: number }[] = [];
    private received: number = 0; // cumulative bytes handed to buffer()
    private consumed: number = 0; // cumulative bytes taken by read()
    // When the packet a handler is running for started arriving, or -1 if it is not known. Set
    // from the OPCODE's arrival, so a payload split across segments is still timed from the front.
    packetArrival: number = -1;
    // ...and the arrival of the first byte the last read() consumed, which is where the above
    // comes from. See NetworkPlayer.read.
    lastReadArrival: number = -1;

    buffer(data: Buffer) {
        if (data.length + this.in.pos > this.in.length) {
            this.close();
            return;
        }

        this.received += data.length;
        const at = Date.now();
        const last = this.arrivals.length > 0 ? this.arrivals[this.arrivals.length - 1] : null;
        if (last !== null && (last.at === at || this.arrivals.length >= ClientSocket.MAX_ARRIVALS)) {
            last.end = this.received;
        } else {
            this.arrivals.push({ end: this.received, at });
        }

        this.in.pdata(data, 0, data.length);
    }

    // When the next byte waiting to be read arrived, or -1 if nothing recorded it. Drops the
    // chunks already read past on the way, so this list stays as short as the unread buffer.
    private arrivalOfNextByte(): number {
        let dropped = 0;
        while (dropped < this.arrivals.length && this.arrivals[dropped].end <= this.consumed) {
            dropped++;
        }
        if (dropped > 0) {
            this.arrivals.splice(0, dropped);
        }
        return this.arrivals.length > 0 ? this.arrivals[0].at : -1;
    }

    // available bytes we can read
    get available() {
        return this.in.pos;
    }

    // remaining bytes we can buffer
    get remaining() {
        return this.in.length - this.in.pos;
    }

    read(dest: Uint8Array, offset: number, length: number) {
        if (this.available < length) {
            return false;
        }

        // before the bytes go, while the offset they start at is still this.consumed
        this.lastReadArrival = this.arrivalOfNextByte();

        // copy data to dest
        dest.set(this.in.data.subarray(0, length), offset);
        this.in.pos -= length;
        this.consumed += length;

        // shift buffer to the next read - only the bytes still buffered, not the whole 64 KB: a flood of
        // 1-byte packets made every read copy the full buffer
        this.in.data.copyWithin(0, length, length + this.in.pos);

        return true;
    }

    // bytes handed to send() that the OS has not taken yet - grows when the peer stops reading
    abstract get bufferedBytes(): number;

    abstract send(src: Uint8Array): void;
    abstract close(): void;
    abstract terminate(): void;
}
