import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetAngle extends ServerGameMessage {
    constructor(
        readonly xan: number,
        readonly component: number,
        readonly zoom: number,
        readonly yan: number
    ) {
        super();
    }
}
