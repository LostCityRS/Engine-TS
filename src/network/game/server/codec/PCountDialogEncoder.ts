import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import PCountDialog from '#/network/game/server/model/PCountDialog.js';

export default class PCountDialogEncoder extends ServerGameMessageEncoder<PCountDialog> {
    prot = ServerGameProt.P_COUNTDIALOG;

    encode(_: Packet, __: PCountDialog): void {}
}
