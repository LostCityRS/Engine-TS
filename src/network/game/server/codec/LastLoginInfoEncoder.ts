import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import LastLoginInfo from '#/network/game/server/model/LastLoginInfo.js';

export default class LastLoginInfoEncoder extends ServerGameMessageEncoder<LastLoginInfo> {
    prot = ServerGameProt.LAST_LOGIN_INFO;

    encode(buf: Packet, message: LastLoginInfo): void {
        buf.p4(message.lastLoginIp);
        buf.p2(message.daysSinceLogin);
        buf.p1(message.daysSinceRecoveryChange);
        buf.p2(message.unreadMessageCount);
        buf.pbool(message.warnMembersInNonMembers);
    }
}
