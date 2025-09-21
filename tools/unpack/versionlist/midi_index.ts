import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import { MidiPack } from '#tools/pack/PackFile.js';

const cache = new FileStream('data/unpack');
const versionlist = new Jagfile(new Packet(cache.read(0, 5)!));
const index = versionlist.read('midi_index')!;

const size = index.length;
for (let i = 0; i < size; i++) {
    const prefetch = index.g1();
    console.log(i, MidiPack.getById(i), prefetch);
}
