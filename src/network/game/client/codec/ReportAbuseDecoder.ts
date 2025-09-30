import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ReportAbuse from '#/network/game/client/model/ReportAbuse.js';

export default class ReportAbuseDecoder extends ClientGameMessageDecoder<ReportAbuse> {
    prot = ClientGameProt.REPORT_ABUSE;

    decode(buf: Packet) {
        const offender = buf.g8();
        const reason = buf.g1();
        const moderatorMute = buf.gbool();

        return new ReportAbuse(offender, reason, moderatorMute);
    }
}
