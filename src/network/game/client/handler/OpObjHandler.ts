import ObjType from '#/cache/config/ObjType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpObj from '#/network/game/client/model/OpObj.js';
import UnsetMapFlag from '#/network/game/server/model/UnsetMapFlag.js';

export default class OpObjHandler extends ClientGameMessageHandler<OpObj> {
    handle(message: OpObj, player: NetworkPlayer): boolean {
        const { x, z, obj: objId } = message;

        if (player.delayed) {
            // normal: cannot interact while delayed
            player.write(new UnsetMapFlag());
            return false;
        }

        const absLeftX = player.originX - 52;
        const absRightX = player.originX + 52;
        const absTopZ = player.originZ + 52;
        const absBottomZ = player.originZ - 52;
        if (x < absLeftX || x > absRightX || z < absBottomZ || z > absTopZ) {
            // bad client: tile is not visible on client
            player.write(new UnsetMapFlag());
            return false;
        }

        const obj = World.getObj(x, z, player.level, objId, player.hash64);
        if (!obj) {
            // bad client or lag: obj does not exist
            player.write(new UnsetMapFlag());
            return false;
        }

        const type = ObjType.get(obj.type);
        if (type.op[message.op - 1] === null || type.op[message.op - 1] === 'hidden') {
            // bad client or lag: obj does not exist
            player.write(new UnsetMapFlag());
            return false;
        }

        const trigger: ServerTriggerType = ServerTriggerType.APOBJ1 + (message.op - 1);
        player.clearPendingAction();
        player.setInteraction(Interaction.ENGINE, obj, trigger);
        player.opcalled = true;
        return true;
    }
}
