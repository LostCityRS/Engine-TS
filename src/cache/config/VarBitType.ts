import fs from 'fs';


import { ConfigType } from '#/cache/config/ConfigType.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import { printError } from '#/util/Logger.js';

export default class VarBitType extends ConfigType {
    private static configNames = new Map<string, number>();
    private static configs: VarBitType[] = [];

    static load(dir: string) {
        if (!fs.existsSync(`${dir}/server/varbit.dat`)) {
            return;
        }

        const server = Packet.load(`${dir}/server/varbit.dat`);
        const jag = Jagfile.load(`${dir}/client/config`);
        this.parse(server, jag);
    }

    static parse(server: Packet, jag: Jagfile) {
        VarBitType.configNames = new Map();
        VarBitType.configs = [];

        const count = server.g2();

        const client = jag.read('varbit.dat')!;
        client.pos = 2;

        for (let id = 0; id < count; id++) {
            const config = new VarBitType(id);
            config.decodeType(server);
            config.decodeType(client);

            VarBitType.configs[id] = config;

            if (config.debugname) {
                VarBitType.configNames.set(config.debugname, id);
            }
        }
    }

    static get(id: number): VarBitType {
        return VarBitType.configs[id];
    }

    static getId(name: string): number {
        return VarBitType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): VarBitType | null {
        const id = this.getId(name);
        if (id === -1) {
            return null;
        }

        return this.get(id);
    }

    static get count() {
        return this.configs.length;
    }

    // ----

    basevar = -1;
    startbit = -1;
    endbit = -1;

    decode(code: number, dat: Packet) {
        if (code === 1) {
            this.basevar = dat.g2();
            this.startbit = dat.g1();
            this.endbit = dat.g1();
        } else if (code === 250) {
            this.debugname = dat.gjstr();
        } else {
            printError(`Unrecognized varbit config code: ${code}`);
        }
    }
}
