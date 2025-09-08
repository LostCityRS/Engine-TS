import Player from '#/engine/entity/Player.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ResumePauseButton from '#/network/game/client/model/ResumePauseButton.js';

export default class ResumePauseButtonHandler extends ClientGameMessageHandler<ResumePauseButton> {
    handle(_message: ResumePauseButton, player: Player): boolean {
        if (!player.activeScript || player.activeScript.execution !== ScriptState.PAUSEBUTTON) {
            return false;
        }

        player.executeScript(player.activeScript, true, true);
        return true;
    }
}
