import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import TutFlash from '#/network/game/server/model/TutFlash.js';

export default class TutFlashEncoder extends ServerGameMessageEncoder<TutFlash> {
    prot = ServerGameProt.TUT_FLASH;

    encode(buf: Packet, message: TutFlash): void {
        buf.p1(message.tab);
    }
}
