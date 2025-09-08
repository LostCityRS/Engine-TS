import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import ResetClientVarCache from '#/network/game/server/model/ResetClientVarCache.js';

export default class ResetClientVarCacheEncoder extends ServerGameMessageEncoder<ResetClientVarCache> {
    prot = ServerGameProt.RESET_CLIENT_VARCACHE;

    encode(_: Packet, __: ResetClientVarCache): void {}
}
