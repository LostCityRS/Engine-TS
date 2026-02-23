import Component, { ComActionTarget } from '#/cache/config/Component.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpObjT from '#/network/game/client/model/OpObjT.js';
import UnsetMapFlag from '#/network/game/server/model/UnsetMapFlag.js';

export default class OpObjTHandler extends ClientGameMessageHandler<OpObjT> {
    handle(message: OpObjT, player: NetworkPlayer): boolean {
        const { x, z, obj: objId, spellCom: spellComId } = message;

        if (player.delayed) {
            // normal: cannot interact while delayed
            player.write(new UnsetMapFlag());
            return false;
        }

        const spellCom = Component.get(spellComId);
        if (typeof spellCom === 'undefined' || (spellCom.actionTarget & ComActionTarget.OBJ) === 0) {
            // bad client: component is not acceptable for this packet
            player.write(new UnsetMapFlag());
            return false;
        } else if (!player.isComponentVisible(spellCom)) {
            // bad client or lag: component is not visible
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

        player.clearPendingAction();
        player.setInteraction(Interaction.ENGINE, obj, ServerTriggerType.APOBJT, spellComId);
        player.opcalled = true;
        return true;
    }
}
