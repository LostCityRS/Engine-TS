import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import DetectModifiedClient from '#/network/game/client/model/DetectModifiedClient.js';

export default class DetectModifiedClientDecoder extends ClientGameMessageDecoder<DetectModifiedClient> {
    prot = ClientGameProt.DETECT_MODIFIED_CLIENT;

    decode(buf: Packet): DetectModifiedClient {
        const verification = buf.g4();
        return new DetectModifiedClient(verification);
    }
}
