import Player from "#/engine/entity/Player.js";
import World from '#/engine/World.js';
import ClientGameMessageHandler from "#/network/game/client/ClientGameMessageHandler.js";
import WindowStatus, { WindowMode } from "#/network/game/client/model/WindowStatus.js";

export default class WindowStatusHandler extends ClientGameMessageHandler<WindowStatus> {
    handle(message: WindowStatus, player: Player): boolean {
        if (message.mode < WindowMode.SD || message.mode > WindowMode.HD_FULLSCREEN) {
            World.notifyPlayerBan('automated', player.username, Date.now() + 172800000);
            return false;
        }

        // TODO: Handle the actual returned data from this.

        return true;
    }
}
