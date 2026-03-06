import ObjType from '#/cache/config/ObjType.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpObjE from '#/network/game/client/model/OpObjE.js';
import MessageGame from '#/network/game/server/model/MessageGame.js';
import Environment from '#/util/Environment.js';

export default class OpObjEHandler extends ClientGameMessageHandler<OpObjE> {
    handle(message: OpObjE, player: NetworkPlayer): boolean {
        const obj = ObjType.get(message.obj);
        
        if (obj && obj.desc) {
            player.write(new MessageGame(obj.desc));
            return true;
        }
        
        if (!Environment.NODE_PRODUCTION) {
            player.write(new MessageGame(`Obj id ${message.obj} has no description.`));
        }
        
        player.write(new MessageGame(`It's a ${obj ? obj.name : 'object'}.`));
        return true;
            
    }
}
