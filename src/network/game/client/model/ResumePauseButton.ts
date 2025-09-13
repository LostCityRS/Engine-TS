import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class ResumePauseButton extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;
}
