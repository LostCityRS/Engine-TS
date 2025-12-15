import Packet from "#/io/Packet.js";
import ClientGameMessageDecoder from "#/network/game/client/ClientGameMessageDecoder.js";
import ClientGameProt from "#/network/game/client/ClientGameProt.js";
import WindowStatus from "#/network/game/client/model/WindowStatus.js";

export default class WindowStatusDecoder extends ClientGameMessageDecoder<WindowStatus> {
    prot = ClientGameProt.WINDOW_STATUS;

    decode(buf: Packet) {
        const mode = buf.g1();
        const canvasWidth = buf.g2();
        const canvasHeight = buf.g2();
        const antialiasingmode = buf.g1();

        return new WindowStatus(mode, canvasWidth, canvasHeight, antialiasingmode);
    }
}
