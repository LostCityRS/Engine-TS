import { ConfigType } from '#/cache/config/ConfigType.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

export default class FloType extends ConfigType {
    static configNames: Map<string, number> = new Map();
    static configs: FloType[] = [];

    static load(_dir: string) {
    }

    static parse(server: Packet, jag: Jagfile) {
        FloType.configNames = new Map();
        FloType.configs = [];

        const count = server.g2();

        const client = jag.read('flo.dat')!;
        client.pos = 2;

        for (let id = 0; id < count; id++) {
            const config = new FloType(id);
            config.decodeType(server);
            config.decodeType(client);

            FloType.configs[id] = config;

            if (config.debugname) {
                FloType.configNames.set(config.debugname, id);
            }
        }
    }

    static loadJag(config: Jagfile) {
        FloType.configNames = new Map();
        FloType.configs = [];

        const client = config.read('flo.dat')!;
        const count = client.g2();

        for (let id = 0; id < count; id++) {
            const config = new FloType(id);
            config.decodeType(client);

            FloType.configs[id] = config;

            if (config.debugname) {
                FloType.configNames.set(config.debugname, id);
            }
        }
    }

    static get(id: number): FloType {
        return FloType.configs[id];
    }

    static getId(name: string): number {
        return FloType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): FloType | null {
        const id = this.getId(name);
        if (id === -1) {
            return null;
        }

        return this.get(id);
    }

    // ----

    colour: number = 0;
    materials: number = -1;
    occlude: boolean = true;
    averagecolour: number = -1;
    materialscale: number = 512;
    hardshadow: boolean = true;
    priority: number = 8;
    blend: boolean = false;
    waterfogcolour: number = 1190717;
    waterfogscale: number = 512;
    code8: boolean = false; // Client-only opcode marker

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            this.colour = dat.g3();
        } else if (code === 2) {
            this.materials = dat.g1();
        } else if (code === 3) {
            this.materials = dat.g2();
            if (this.materials === 65535) {
                this.materials = -1;
            }
        } else if (code === 5) {
            this.occlude = false;
        } else if (code === 6) {
            this.debugname = dat.gjstr();
        } else if (code === 7) {
            this.averagecolour = dat.g3();
        } else if (code === 8) {
            // Client-only code, we store it only to write the opcode later during packing.
            this.code8 = true;
        } else if (code === 9) {
            this.materialscale = dat.g2();
        } else if (code === 10) {
            this.hardshadow = false;
        } else if (code === 11) {
            this.priority = dat.g1();
        } else if (code === 12) {
            this.blend = true;
        } else if (code === 13) {
            this.waterfogcolour = dat.g3();
        } else if (code === 14) {
            this.waterfogscale = dat.g1();
        } else {
            throw new Error(`Unrecognized flo config code: ${code}`);
        }
    }
}
