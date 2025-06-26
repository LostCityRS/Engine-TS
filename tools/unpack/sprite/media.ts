import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import Pix from '#/cache/graphics/Pix.js';

const cache = new FileStream('data/unpack');
const media = new Jagfile(new Packet(cache.read(0, 4)!));

const names = [
    'backbase1', 'backbase2',
    'backhmid1', 'backhmid2',
    'backleft1', 'backleft2',
    'backright1', 'backright2',
    'backtop1',
    'backvmid1', 'backvmid2', 'backvmid3',
    'mapback', 'mapedge', 'mapmarker', 'mapdots', 'compass', 'mapfunction', 'mapscene',
    'redstone1', 'redstone2', 'redstone3',
    'chatback', 'invback', 'tradebacking',
    'sideicons', 'staticons', 'staticons2',
    'cross', 'mod_icons',
    'headicons', 'hitmarks',
    'combatboxes',
    'combaticons', 'combaticons2', 'combaticons3',
    'gnomeball_buttons', 'leftarrow', 'rightarrow', 'scrollbar',
    'magicoff', 'magicoff2', 'magicon', 'magicon2',
    'miscgraphics', 'miscgraphics2', 'miscgraphics3',
    'prayerglow', 'prayeroff', 'prayeron',
    'steelborder', 'steelborder2', 'sworddecor', 'wornicons'
];

for (const name of names) {
    Pix.unpackFull(media, name, `${Environment.BUILD_SRC_DIR}/sprites`);
}
