import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class RebuildGetMaps extends ClientGameMessage {
    category = ClientGameProtCategory.RESTRICTED_EVENT;

    constructor(
        readonly maps: Int32Array
    ) {
        super();
    }
}
