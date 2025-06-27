import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

const cache = new FileStream('data/unpack');
const versionlist = new Jagfile(new Packet(cache.read(0, 5)!));
const index = versionlist.read('anim_index')!;

const size = index.length / 2;
for (let i = 0; i < size; i++) {
    const flags = index.g2();
    console.log(i, flags.toString(2).padStart(8, '0'), flags);
}
