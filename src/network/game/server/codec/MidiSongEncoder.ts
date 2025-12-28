import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import MidiSong from '#/network/game/server/model/MidiSong.js';

export default class MidiSongEncoder extends ServerGameMessageEncoder<MidiSong> {
    prot = ServerGameProt.MIDI_SONG;

    encode(buf: Packet, message: MidiSong): void {
        buf.pjstr(message.name);
        buf.p4(message.crc);
        buf.p4(message.length);
    }

    test(message: MidiSong): number {
        return 1 + message.name.length + 4 + 4;
    }
}
