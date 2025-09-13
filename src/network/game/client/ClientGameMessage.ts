import ClientMessage from '#/network/ClientMessage.js';
import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';

export default abstract class ClientGameMessage extends ClientMessage {
    abstract readonly category: ClientGameProtCategory;
}
