import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import IfPlayerDesign from '#/network/game/client/model/IfPlayerDesign.js';

export default class IfPlayerDesignDecoder extends ClientGameMessageDecoder<IfPlayerDesign> {
    prot = ClientGameProt.IF_PLAYERDESIGN;

    decode(buf: Packet) {
        const gender = buf.g1();

        const idkit: number[] = [];
        for (let i = 0; i < 7; i++) {
            idkit[i] = buf.g1();

            if (idkit[i] === 255) {
                idkit[i] = -1;
            }
        }

        const color: number[] = [];
        for (let i = 0; i < 5; i++) {
            color[i] = buf.g1();
        }

        return new IfPlayerDesign(gender, idkit, color);
    }
}
