import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class CamShake extends ServerGameMessage {
    constructor(
        readonly axis: number,
        readonly random: number,
        readonly amplitude: number,
        readonly rate: number
    ) {
        super();
    }
}
