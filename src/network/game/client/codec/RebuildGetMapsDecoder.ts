import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import RebuildGetMaps from '#/network/game/client/model/RebuildGetMaps.js';

export default class RebuildGetMapsDecoder extends ClientGameMessageDecoder<RebuildGetMaps> {
    prot = ClientGameProt.REBUILD_GETMAPS;

    decode(buf: Packet, length: number) {
        const maps = new Int32Array(length / 3);
        for (let i = 0; i < maps.length; i++) {
            maps[i] = buf.g3();
        }

        return new RebuildGetMaps(maps);
    }
}
