import Component from '#/cache/config/Component.js';
import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateInvFull from '#/network/game/server/model/UpdateInvFull.js';

export default class UpdateInvFullEncoder extends ServerGameMessageEncoder<UpdateInvFull> {
    prot = ServerGameProt.UPDATE_INV_FULL;

    encode(buf: Packet, message: UpdateInvFull): void {
        const { component, inv } = message;

        const comType = Component.get(component);
        // prevent a client crash by capping to inv size || interface size
        const size = Math.min(inv.capacity, comType.width * comType.height);

        // only send up to the last slot in use (anything beyond is cleared by the client)
        let max = 0;
        for (let slot = 0; slot < size; slot++) {
            const obj = inv.get(slot);

            if (obj) {
                max = slot + 1;
            }
        }

        buf.p2(component);
        buf.p1(max);
        for (let slot = 0; slot < max; slot++) {
            const obj = inv.get(slot);

            if (obj) {
                buf.p2(obj.id + 1);

                if (obj.count >= 255) {
                    buf.p1(255);
                    buf.p4(obj.count);
                } else {
                    buf.p1(obj.count);
                }
            } else {
                buf.p2(0);
                buf.p1(0);
            }
        }
    }

    test(message: UpdateInvFull): number {
        const { component, inv } = message;

        const comType = Component.get(component);
        const size = Math.min(inv.capacity, comType.width * comType.height);

        let length: number = 0;
        length += 3;
        for (let slot = 0; slot < size; slot++) {
            const obj = inv.get(slot);
            if (obj) {
                length += 2;

                if (obj.count >= 255) {
                    length += 5;
                } else {
                    length += 1;
                }
            } else {
                length += 3;
            }
        }
        return length;
    }
}
