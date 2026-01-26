import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpObjE from '#/network/game/client/model/OpObjE.js';

export default class OpObjEHandler extends ClientGameMessageHandler<OpObjE> {
    handle(_message: OpObjE, _player: NetworkPlayer): boolean {
        // TODO
        return true;
    }
}
