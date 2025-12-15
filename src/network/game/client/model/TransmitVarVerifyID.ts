import ClientGameMessage from "#/network/game/client/ClientGameMessage.js";
import ClientGameProtCategory from "#/network/game/client/ClientGameProtCategory.js";

export default class TransmitVarVerifyID extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly verifyID: number) {
        super();
    }
}
