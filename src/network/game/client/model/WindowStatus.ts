import ClientGameMessage from "#/network/game/client/ClientGameMessage.js";
import ClientGameProtCategory from "#/network/game/client/ClientGameProtCategory.js";

export const enum WindowMode {
    SD, // 0
    HD_NON_RESIZABLE, // 1
    HD_RESIZEABLE, // 2
    HD_FULLSCREEN // 3
}

export default class WindowStatus extends ClientGameMessage {
    category = ClientGameProtCategory.CLIENT_EVENT;

    constructor(
        readonly mode: WindowMode,
        readonly canvasWidth: number,
        readonly canvasHeight: number,
        readonly antialiasingmode: number
    ) {
        super();
    }
}
