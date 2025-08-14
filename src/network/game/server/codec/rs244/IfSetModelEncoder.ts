import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import IfSetModel from '#/network/game/server/model/IfSetModel.js';

export default class IfSetModelEncoder extends MessageEncoder<IfSetModel> {
    prot = ServerProt244.IF_SETMODEL;

    encode(buf: Packet, message: IfSetModel): void {
        buf.p2_alt3(message.model);
        buf.p2_alt3(message.component);
    }
}
