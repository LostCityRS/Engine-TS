import * as rsbuf from '@2004scape/rsbuf';

import { Interaction } from '#/engine/entity/Interaction.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpPlayer from '#/network/game/client/model/OpPlayer.js';
import UnsetMapFlag from '#/network/game/server/model/UnsetMapFlag.js';

export default class OpPlayerHandler extends ClientGameMessageHandler<OpPlayer> {
    handle(message: OpPlayer, player: NetworkPlayer): boolean {
        const { pid } = message;

        if (player.delayed) {
            player.write(new UnsetMapFlag());
            return false;
        }

        const other = World.getPlayer(pid);
        if (!other) {
            player.write(new UnsetMapFlag());
            player.clearPendingAction();
            return false;
        }

        if (!rsbuf.hasPlayer(player.pid, other.pid)) {
            player.write(new UnsetMapFlag());
            player.clearPendingAction();
            return false;
        }

        // todo: validate set_player_op?

        let mode: ServerTriggerType;
        if (message.op === 1) {
            mode = ServerTriggerType.APPLAYER1;
        } else if (message.op === 2) {
            mode = ServerTriggerType.APPLAYER2;
        } else if (message.op === 3) {
            mode = ServerTriggerType.APPLAYER3;
        } else if (message.op === 4) {
            mode = ServerTriggerType.APPLAYER4;
        } else {
            mode = ServerTriggerType.APPLAYER5;
        }

        player.clearPendingAction();
        player.setInteraction(Interaction.ENGINE, other, mode);
        player.opcalled = true;
        return true;
    }
}
