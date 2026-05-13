import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import RebuildRegion, { packRegionTemplate } from '#/network/game/server/model/RebuildRegion.js';

export default class RebuildRegionEncoder extends ServerGameMessageEncoder<RebuildRegion> {
    prot = ServerGameProt.REBUILD_REGION;

    encode(buf: Packet, message: RebuildRegion): void {
        // 377 decode order for packet 53:
        // 1) zoneX (g2_alt2)
        // 2) 4*13*13 template flags + optional 26-bit templates in bit access
        // 3) zoneZ (g2_alt2)
        buf.p2_alt2(message.zoneX);

        const templateByZone = new Map<number, number>();
        for (const template of message.templates) {
            const key = (template.level << 22) | ((template.zoneX & 0x7ff) << 11) | (template.zoneZ & 0x7ff);
            templateByZone.set(key, packRegionTemplate(template));
        }

        buf.bitStart();

        // Emit 4*13*13 zone templates centered around the player's build-area center zone.
        for (let level = 0; level < 4; level++) {
            for (let zoneX = message.zoneX - 6; zoneX <= message.zoneX + 6; zoneX++) {
                for (let zoneZ = message.zoneZ - 6; zoneZ <= message.zoneZ + 6; zoneZ++) {
                    const key = (level << 22) | ((zoneX & 0x7ff) << 11) | (zoneZ & 0x7ff);
                    const packed = templateByZone.get(key);

                    if (packed === undefined) {
                        buf.pBit(1, 0);
                    } else {
                        buf.pBit(1, 1);
                        buf.pBit(26, packed);
                    }
                }
            }
        }

        buf.bitEnd();
        buf.p2_alt2(message.zoneZ);
    }
}
