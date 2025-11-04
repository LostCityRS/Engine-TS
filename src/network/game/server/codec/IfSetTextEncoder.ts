import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetText from '#/network/game/server/model/IfSetText.js';

export default class IfSetTextEncoder extends ServerGameMessageEncoder<IfSetText> {
    prot = ServerGameProt.IF_SETTEXT;

    encode(buf: Packet, _message: IfSetText): void {
        buf.p4_alt3(0);
        buf.pjstr('');
        buf.p2_alt2(0);

        // buf.p2_alt3(message.component);
        // buf.pjstr(message.text);
    }

    test(message: IfSetText): number {
        return 2 + 1 + message.text.length;
    }
}
