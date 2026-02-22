import { ConfigType } from '#/cache/config/ConfigType.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

export default class FluType extends ConfigType {
    static configNames: Map<string, number> = new Map();
    static configs: FluType[] = [];

    static load(_dir: string) {
    }

    static parse(server: Packet, jag: Jagfile) {
        FluType.configNames = new Map();
        FluType.configs = [];

        const count = server.g2();

        const client = jag.read('flo.dat')!;
        client.pos = 2;

        for (let id = 0; id < count; id++) {
            const config = new FluType(id);
            config.decodeType(server);
            config.decodeType(client);

            FluType.configs[id] = config;

            if (config.debugname) {
                FluType.configNames.set(config.debugname, id);
            }
        }
    }

    static get(id: number): FluType {
        return FluType.configs[id];
    }

    static getId(name: string): number {
        return FluType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): FluType | null {
        const id = this.getId(name);
        if (id === -1) {
            return null;
        }

        return this.get(id);
    }

    // ----

    colour: number = 0;
    material: number = -1;
    materialscale: number = 512;
    hardshadow: boolean = true;
 

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            this.colour = dat.g3();
        } else if (code === 2) {
            this.material = dat.g2();
            if (this.material === 65535) {
                this.material = -1;
            }
        } else if (code === 3) {
            this.materialscale = dat.g2();
        } else if (code === 4) {
            this.hardshadow = false;
        } else {
            throw new Error(`Unrecognized flo config code: ${code}`);
        }
    }
}
