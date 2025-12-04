import World from '#/engine/World.js';

import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import Player from '#/engine/entity/Player.js';

import InputTrackingBlob from '#/engine/entity/tracking/InputTrackingBlob.js';

import Packet from '#/io/Packet.js';

export default class InputTracking {
    private readonly player: Player;
    private max: number = 500;

    active: boolean = false;
    buf: Packet = Packet.alloc(1);
    seq: number = 0;

    constructor(player: Player) {
        this.player = player;
    }

    onCycle(): void {
        if (this.buf.pos >= this.max) {
            this.flush();
        }
    }

    flush(): void {
        if (!this.active) {
            return;
        }

        if (this.buf.pos > 0) {
            const uuid = this.player instanceof NetworkPlayer ? this.player.client.uuid : 'headless';
            const blob = new InputTrackingBlob(this.buf.data.subarray(0, this.buf.pos), this.seq++, this.player.coord);
            World.submitInputTracking(this.player.username, uuid, [blob]);
        }

        this.buf.pos = 0;
    }
}
