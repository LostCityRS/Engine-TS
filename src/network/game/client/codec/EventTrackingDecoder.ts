import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import EventTracking from '#/network/game/client/model/EventTracking.js';

export default class EventTrackingDecoder extends ClientGameMessageDecoder<EventTracking> {
    prot = ClientGameProt.EVENT_TRACKING;

    decode(buf: Packet, len: number): EventTracking {
        const bytes: Uint8Array = new Uint8Array(len);
        buf.gdata(bytes, 0, len);
        return new EventTracking(bytes);
    }
}
