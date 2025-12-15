import Packet from "#/io/Packet.js";
import ClientGameMessageDecoder from "#/network/game/client/ClientGameMessageDecoder.js";
import ClientGameProt from "#/network/game/client/ClientGameProt.js";
import ClanKickUser from '#/network/game/client/model/ClanKickUser.js';


export default class ClanKickUserDecoder extends ClientGameMessageDecoder<ClanKickUser> {
    prot = ClientGameProt.CLAN_KICKUSER;

    decode(buf: Packet): ClanKickUser {
        const username = buf.g8();
        return new ClanKickUser(username);
    }
}
