import World from '#/engine/World.js';

import Player from '#/engine/entity/Player.js';

import Packet from '#/io/Packet.js';

import EventAppletFocus from '#/network/game/client/model/EventAppletFocus.js';
import EventCameraPosition from '#/network/game/client/model/EventCameraPosition.js';
import EventMouseClick from '#/network/game/client/model/EventMouseClick.js';
import EventMouseMove from '#/network/game/client/model/EventMouseMove.js';

enum InputTrackingEvent {
    CAMERA_POSITION = 1,
    APPLET_FOCUS,
    MOUSE_CLICK,
    MOUSE_MOVE
}

export default class InputTracking {
    private readonly player: Player;
    private softLimit: number = 1500;

    active: boolean = false;
    buf: Packet = Packet.alloc(1);

    constructor(player: Player) {
        this.player = player;
    }

    onCycle(): void {
        if (this.buf.pos >= this.softLimit) {
            this.flush();
        }
    }

    flush(): void {
        if (!this.active) {
            return;
        }

        if (this.buf.pos > 0) {
            World.submitInputTracking(this.player, this.buf.data.subarray(0, this.buf.pos));
        }

        this.buf.pos = 0;
    }

    cameraPosition(event: EventCameraPosition) {
        if (!this.active) {
            return;
        }

        if (this.buf.pos + 5 >= this.buf.length) {
            this.flush();
        }

        this.buf.p1(InputTrackingEvent.CAMERA_POSITION);
        this.buf.p2(event.pitch);
        this.buf.p2(event.yaw);
    }

    appletFocus(event: EventAppletFocus) {
        if (!this.active) {
            return;
        }

        if (this.buf.pos + 2 >= this.buf.length) {
            this.flush();
        }

        this.buf.p1(InputTrackingEvent.APPLET_FOCUS);
        this.buf.p1(event.focus);
    }

    mouseClick(event: EventMouseClick) {
        if (!this.active) {
            return;
        }

        if (this.buf.pos + 5 >= this.buf.length) {
            this.flush();
        }

        this.buf.p1(InputTrackingEvent.MOUSE_CLICK);
        this.buf.p4(event.info);
    }

    mouseMove(event: EventMouseMove) {
        if (!this.active || event.data.length === 0 || event.data.length > 160) {
            return;
        }

        if (this.buf.pos + event.data.length >= this.buf.length) {
            this.flush();
        }

        this.buf.p1(InputTrackingEvent.MOUSE_MOVE);
        this.buf.p1(event.data.length);
        this.buf.pdata(event.data, 0, event.data.length);
    }
}
