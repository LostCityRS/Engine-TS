import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClanJoinLeaveChat from '#/network/game/client/model/ClanJoinLeaveChat.js';

export default class ClanJoinLeaveChatDecoder extends ClientGameMessageDecoder<ClanJoinLeaveChat> {
    prot = ClientGameProt.CLAN_JOINCHAT_LEAVECHAT;

    decode(buf: Packet) {
        const clanname = buf.g8();
        return new ClanJoinLeaveChat(clanname);
    }
}
