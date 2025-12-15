import DetectModifiedClient from '#/network/game/client/model/DetectModifiedClient.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import Player from '#/engine/entity/Player.js';
import Environment from '#/util/Environment.js';
import World from '#/engine/World.js';

export default class DetectModifiedClientHandler extends ClientGameMessageHandler<DetectModifiedClient> {

    handle(message: DetectModifiedClient, player: Player): boolean {
        if (!Environment.NODE_DEBUG && message.verification !== 1057001181) {
            World.notifyPlayerBan('automated', player.username, Date.now() + 172800000);
        }

        return true;
    }
}
