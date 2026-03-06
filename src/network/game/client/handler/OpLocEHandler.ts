import LocType from '#/cache/config/LocType.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpLocE from '#/network/game/client/model/OpLocE.js';
import MessageGame from '#/network/game/server/model/MessageGame.js';
import Environment from '#/util/Environment.js';

export default class OpLocEHandler extends ClientGameMessageHandler<OpLocE> {
    handle(message: OpLocE, player: NetworkPlayer): boolean {
        const loc = LocType.get(message.loc);

        if (loc && loc.desc) {
            player.write(new MessageGame(loc.desc));
            return true;
        }

        if (!Environment.NODE_PRODUCTION) {
            player.write(new MessageGame(`Loc id ${message.loc} has no description.`));
        }

        player.write(new MessageGame(`It's a ${loc ? loc.name : 'object'}.`));
        return true;
    }
}
