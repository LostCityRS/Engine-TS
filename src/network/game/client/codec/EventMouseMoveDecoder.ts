import Packet from '#/io/Packet.js';

import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import EventMouseMove from '#/network/game/client/model/EventMouseMove.js';

export default class EventMouseMoveDecoder extends ClientGameMessageDecoder<EventMouseMove> {
    prot = ClientGameProt.EVENT_MOUSE_MOVE;

    decode(buf: Packet, len: number) {
        const bytes: Uint8Array = new Uint8Array(len);
        buf.gdata(bytes, 0, len);

        return new EventMouseMove(bytes);
    }
}
