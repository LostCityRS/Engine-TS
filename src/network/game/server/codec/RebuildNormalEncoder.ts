import { PRELOADED_CRC } from '#/cache/PreloadedPacks.js';
import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import RebuildNormal from '#/network/game/server/model/RebuildNormal.js';

export default class RebuildNormalEncoder extends ServerGameMessageEncoder<RebuildNormal> {
    prot = ServerGameProt.REBUILD_NORMAL;

    encode(buf: Packet, message: RebuildNormal): void {
        buf.p2(message.zoneX);
        buf.p2(message.zoneZ);
        for (const packed of message.mapsquares) {
            const x: number = packed >> 8;
            const z: number = packed & 0xff;
            buf.p1(x);
            buf.p1(z);
            buf.p4(PRELOADED_CRC.get(`m${x}_${z}`) ?? 0);
            buf.p4(PRELOADED_CRC.get(`l${x}_${z}`) ?? 0);
        }
    }

    test(message: RebuildNormal): number {
        return 2 + 2 + message.mapsquares.size * (1 + 1 + 4 + 4);
    }
}
