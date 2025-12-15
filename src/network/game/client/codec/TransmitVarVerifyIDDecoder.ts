import Packet from '#/io/Packet.js'
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import TransmitVarVerifyID from '#/network/game/client/model/TransmitVarVerifyID.js';

export default class TransmitVarVerifyIDDecoder extends ClientGameMessageDecoder<TransmitVarVerifyID> {
    prot = ClientGameProt.TRANSMITVAR_VERIFYID;

    decode(buf: Packet) {
        const verifyID = buf.g2();
        return new TransmitVarVerifyID(verifyID);
    }
}
