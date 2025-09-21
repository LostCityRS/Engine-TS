import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class AnticheatCycleLogic extends ClientGameMessage {
    category = ClientGameProtCategory.CLIENT_EVENT;
}
