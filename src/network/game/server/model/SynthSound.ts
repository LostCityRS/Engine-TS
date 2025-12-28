import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class SynthSound extends ServerGameMessage {
    constructor(
        readonly synth: number,
        readonly loops: number,
        readonly delay: number
    ) {
        super();
    }
}
