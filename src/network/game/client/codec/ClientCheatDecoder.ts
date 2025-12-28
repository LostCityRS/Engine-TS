import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

export default class ClientCheatDecoder extends ClientGameMessageDecoder<ClientCheat> {
    prot = ClientGameProt.CLIENT_CHEAT;

    decode(buf: Packet) {
        const input = buf.gjstr();
        return new ClientCheat(input);
    }
}
