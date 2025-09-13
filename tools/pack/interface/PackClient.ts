import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import { packInterface } from '#tools/pack/interface/PackShared.js';
import { shouldBuild } from '#tools/pack/PackFile.js';

export function packClientInterface(cache: FileStream, modelFlags: number[]) {
    const jag = new Jagfile();

    if (
        shouldBuild(`${Environment.BUILD_SRC_DIR}/scripts`, '.if', 'data/pack/client/interface') ||
        shouldBuild('tools/pack/interface', '.ts', 'data/pack/client/interface')
    ) {
        const { client, server } = packInterface(modelFlags);

        if (Environment.BUILD_VERIFY && !Packet.checkcrc(client.data, 0, client.pos, 316858560)) {
            throw new Error('.if checksum mismatch!\nYou can disable this safety check by setting BUILD_VERIFY=false');
        }

        jag.write('data', client);
        jag.save('data/pack/client/interface');
        client.release();

        server.save('data/pack/server/interface.dat');
        server.release();
    }

    cache.write(0, 3, fs.readFileSync('data/pack/client/interface'));
}
