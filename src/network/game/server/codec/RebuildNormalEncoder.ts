import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import RebuildNormal from '#/network/game/server/model/RebuildNormal.js';
import { getXtea } from '#/util/OpenRS2.js';

export default class RebuildNormalEncoder extends ServerGameMessageEncoder<RebuildNormal> {
    prot = ServerGameProt.REBUILD_NORMAL;
    usable = true;

    encode(buf: Packet, message: RebuildNormal): void {
        buf.p2_alt2(message.localX);

        for (const map of message.mapsquares) {
            const x = (map >> 8) & 0xFF;
            const z = map & 0xFF;

            const xtea = getXtea(x, z);
            if (xtea) {
                for (let i = 0; i < xtea.key.length; i++) {
                    buf.p4_alt3(xtea.key[i]);
                }
            } else {
                for (let i = 0; i < 4; i++) {
                    buf.p4_alt3(0);
                }
            }
        }

        buf.p1_alt3(message.level);
        buf.p2(message.zoneX);
        buf.p2_alt2(message.zoneZ);
        buf.p2_alt2(message.localZ);
    }

    test(_message: RebuildNormal): number {
        return -2;
    }
}
