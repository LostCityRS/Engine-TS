import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import MoveClick from '#/network/game/client/model/MoveClick.js';

export default class MoveClickDecoder extends ClientGameMessageDecoder<MoveClick> {
    constructor(readonly prot: ClientGameProt) {
        super();
    }

    decode(buf: Packet, length: number) {
        const ctrlHeld: number = buf.g1();
        const startX: number = buf.g2();
        const startZ: number = buf.g2();

        const offset: number = this.prot === ClientGameProt.MOVE_MINIMAPCLICK ? 14 : 0;
        const waypoints: number = (length - buf.pos - offset) / 2;

        const path: { x: number; z: number }[] = [{ x: startX, z: startZ }];

        for (let index: number = 1; index <= waypoints && index < 25; index++) {
            path.push({
                x: startX + buf.g1b(),
                z: startZ + buf.g1b()
            });
        }

        return new MoveClick(path, ctrlHeld, this.prot === ClientGameProt.MOVE_OPCLICK);
    }
}
