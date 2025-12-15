import Player from "#/engine/entity/Player.js";
import ClientGameMessageHandler from "#/network/game/client/ClientGameMessageHandler.js";
import ClanJoinLeaveChat from "#/network/game/client/model/ClanJoinLeaveChat.js";
import { fromBase37 } from "#/util/JString.js";

export default class ClanJoinLeaveChatHandler extends ClientGameMessageHandler<ClanJoinLeaveChat> {
    handle(message: ClanJoinLeaveChat, player: Player): boolean {
        // Client specifically sends 0 if wished action is to leave, do base37 after this to avoid false positives with leaving.
        if (message.clanname === 0n)
        {
            // Leave current clan, if player is in one.
            return true;
        }

        if (fromBase37(message.clanname) === 'invalid_name')
        {
            return false;
        }

        // Join clan, if it exists
        return true;
    }
}
