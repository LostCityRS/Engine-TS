import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import Pix from '#/cache/graphics/Pix.js';
import { TexturePack } from '#/util/PackFile.js';

const cache = new FileStream('data/unpack');
const textures = new Jagfile(new Packet(cache.read(0, 6)!));

for (let id = 0; id < 50; id++) {
    Pix.unpackFull(textures, id.toString(), `${Environment.BUILD_SRC_DIR}/textures`, TexturePack.getById(id) || id.toString());
}
