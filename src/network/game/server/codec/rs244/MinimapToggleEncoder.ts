import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import MinimapToggle from '#/network/game/server/model/MinimapToggle.js';

export default class MinimapToggleEncoder extends MessageEncoder<MinimapToggle> {
    prot = ServerProt244.MINIMAP_TOGGLE;

    encode(buf: Packet, message: MinimapToggle): void {
        // 0 normal
        // 1 disable click
        // 2 blacked out
        buf.p1(message.minimapType);
    }
}