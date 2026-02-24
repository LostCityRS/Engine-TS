import Packet from '#/io/Packet.js';

import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import EventMouseClick from '#/network/game/client/model/EventMouseClick.js';

export default class EventMouseClickDecoder extends ClientGameMessageDecoder<EventMouseClick> {
    prot = ClientGameProt.EVENT_MOUSE_CLICK;

    decode(buf: Packet) {
        const info = buf.g4();

        return new EventMouseClick(info);
    }
}
