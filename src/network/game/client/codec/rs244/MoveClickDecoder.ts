import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import MoveClick from '#/network/game/client/model/MoveClick.js';


export default class MoveClickDecoder extends MessageDecoder<MoveClick> {
    constructor(readonly prot: ClientProt244) {
        super();
    }

    decode(buf: Packet, length: number) {
        const startX: number = buf.g2_alt3();
        const ctrlHeld: number = buf.g1();
        const startZ: number = buf.g2_alt3();

        const offset: number = this.prot === ClientProt244.MOVE_MINIMAPCLICK ? 14 : 0;
        const waypoints: number = (length - buf.pos - offset) / 2;

        const path: { x: number; z: number }[] = [{ x: startX, z: startZ }];

        for (let index: number = 1; index <= waypoints && index < 25; index++) {
            path.push({
                x: startX + buf.g1b(),
                z: startZ + buf.g1b_alt3()
            });
        }

        return new MoveClick(path, ctrlHeld, this.prot === ClientProt244.MOVE_OPCLICK);
    }
}
