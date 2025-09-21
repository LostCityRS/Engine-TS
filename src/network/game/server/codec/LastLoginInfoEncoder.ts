import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import LastLoginInfo from '#/network/game/server/model/LastLoginInfo.js';

export default class LastLoginInfoEncoder extends ServerGameMessageEncoder<LastLoginInfo> {
    prot = ServerGameProt.LAST_LOGIN_INFO;

    encode(buf: Packet, message: LastLoginInfo): void {
        buf.p2_alt1(message.daysSincePasswordChange);
        buf.p2_alt3(0); //unused
        buf.p2(0); // unused
        buf.p2(0); // unused
        buf.p2_alt1(message.currentDay);
        buf.p2_alt2(message.unreadMessageCount);
        buf.p2_alt2(message.previousLoginDay);
        buf.p2(message.membersCreditDays);
        buf.p4_alt1(message.lastLoginIp);
        buf.p2_alt3(message.daysSinceRecoveryChange);
        buf.p1_alt1(0); //unused
    }
}
