import Packet from '#/io/Packet.js';

import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import EventCameraPosition from '#/network/game/client/model/EventCameraPosition.js';

export default class EventCameraPositionDecoder extends ClientGameMessageDecoder<EventCameraPosition> {
    prot = ClientGameProt.EVENT_CAMERA_POSITION;

    decode(buf: Packet) {
        const pitch = buf.g2();
        const yaw = buf.g2();

        return new EventCameraPosition(pitch, yaw);
    }
}
