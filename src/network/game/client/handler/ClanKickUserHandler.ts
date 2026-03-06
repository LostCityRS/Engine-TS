import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClanKickUser from '#/network/game/client/model/ClanKickUser.js';
import { fromBase37 } from '#/util/JString.js';

export default class ClanKickUserHandler extends ClientGameMessageHandler<ClanKickUser> {
    handle(message: ClanKickUser, _player: Player): boolean {
        if (fromBase37(message.username) === 'invalid_name') {
            return false;
        }

        // TODO: remove username from players current clan, if they are priveleged enough within the clan to do so.
        return true;
    }
}
