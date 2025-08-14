import Component from '#/cache/config/Component.js';
import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import UpdateInvFull from '#/network/game/server/model/UpdateInvFull.js';

export default class UpdateInvFullEncoder extends MessageEncoder<UpdateInvFull> {
    prot = ServerProt244.UPDATE_INV_FULL;

    encode(buf: Packet, message: UpdateInvFull): void {
        const { component, inv } = message;

        const comType = Component.get(component);
        const size = Math.min(inv.capacity, comType.width * comType.height);

        // todo: size should be the index of the last non-empty slot
        buf.p2(component);
        buf.p2(size);
        for (let slot = 0; slot < size; slot++) {
            const obj = inv.get(slot);

            if (obj) {
                buf.p2_alt3(obj.id + 1);

                if (obj.count >= 255) {
                    buf.p1_alt2(255);
                    buf.p4_alt1(obj.count);
                } else {
                    buf.p1_alt2(obj.count);
                }
            } else {
                buf.p2_alt3(0);
                buf.p1_alt2(0);
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
