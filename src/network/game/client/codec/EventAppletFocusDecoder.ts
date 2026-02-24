import Packet from '#/io/Packet.js';

import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import EventAppletFocus from '#/network/game/client/model/EventAppletFocus.js';

export default class EventAppletFocusDecoder extends ClientGameMessageDecoder<EventAppletFocus> {
    prot = ClientGameProt.EVENT_APPLET_FOCUS;

    decode(buf: Packet) {
        const focus = buf.g1();

        return new EventAppletFocus(focus);
    }
}
