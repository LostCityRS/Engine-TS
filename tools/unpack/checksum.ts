import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

const cache = new FileStream('data/unpack');

function printCrcs(jagName: string, jag: Jagfile) {
    for (const name of jag.fileName) {
        const file = jag.read(name)!;
        console.log(jagName, name, Packet.getcrc(file.data, 0, file.length));

        file.save(`data/unpack/${jagName}/${name}`, file.length);
    }
}

printCrcs('config', new Jagfile(new Packet(cache.read(0, 2))));
printCrcs('interface', new Jagfile(new Packet(cache.read(0, 3))));
printCrcs('synth', new Jagfile(new Packet(cache.read(0, 8))));
