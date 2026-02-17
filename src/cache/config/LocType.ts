import kleur from 'kleur';

import { ConfigType } from '#/cache/config/ConfigType.js';
import { ParamHelper, ParamMap } from '#/cache/config/ParamHelper.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import { printFatalError } from '#/util/Logger.js';

export default class LocType extends ConfigType {
    static configNames: Map<string, number> = new Map();
    static configs: LocType[] = [];

    static load(_dir: string) {
    }

    static parse(server: Packet, jag: Jagfile) {
        LocType.configNames = new Map();
        LocType.configs = [];

        const count = server.g2();

        const client = jag.read('loc.dat')!;
        client.pos = 2;

        for (let id = 0; id < count; id++) {
            const config = new LocType(id);
            config.decodeType(server);
            config.decodeType(client);
            config.postDecode();

            LocType.configs[id] = config;

            if (config.debugname) {
                LocType.configNames.set(config.debugname, id);
            }
        }
    }

    static get(id: number): LocType {
        return LocType.configs[id];
    }

    static getId(name: string): number {
        return LocType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): LocType | null {
        const id = this.getId(name);
        if (id === undefined || id === -1) {
            return null;
        }

        return this.get(id);
    }

    static get count() {
        return this.configs.length;
    }

    // ----

    models: Uint16Array | null = null;
    shapes: Uint8Array | null = null;
    name: string | null = null;
    desc: string | null = null;
    recol_s: Uint16Array | null = null;
    recol_d: Uint16Array | null = null;
    retex_s: Uint16Array | null = null;
    retex_d: Uint16Array | null = null;
    recol_d_palette: Int8Array | null = null;
    width = 1;
    length = 1;
    blockwalk = true;
    blockrange = true;
    active = -1;
    hillskew = 0;
    hillskew_amount = -1;   // todo: verify name
    sharelight = false;
    occlude = false;
    anim = -1;
    hasalpha = false;
    wallwidth = 16;
    ambient = 0;
    contrast = 0;
    op: (string | null)[] | null = null;
    mapfunction = -1;
    mapscene = -1;
    mirror = false;
    shadow = true;
    resizex = 128;
    resizey = 128;
    resizez = 128;
    forceapproach = 0;
    offsetx = 0;
    offsety = 0;
    offsetz = 0;
    forcedecor = false;
    breakroutefinding = false;
    raiseobject = -1;
    multivarbit = -1;
    multivarp = -1;
    multiloc: number[] = [];
    bgsound_sound = -1;
    bgsound_range = 0;
    bgsound_mindelay = 0;
    bgsound_maxdelay = 0;
    bgsound_random: number[] = [];
    mapsceneiconrotate = false;
    mapsceneicon = -1;
    members = false;
    randomanimframe = true;

    // server-side
    category = -1;
    params: ParamMap = new Map();

    decode(code: number, dat: Packet) {
        if (code === 1) {
            const count = dat.g1();
            this.models = new Uint16Array(count);
            this.shapes = new Uint8Array(count);

            for (let i = 0; i < count; i++) {
                this.models[i] = dat.g2();
                this.shapes[i] = dat.g1();
            }
        } else if (code === 2) {
            this.name = dat.gjstr();
        } else if (code === 3) {
            this.desc = dat.gjstr();
        } else if (code === 5) {
            const count = dat.g1();
            this.models = new Uint16Array(count);

            for (let i = 0; i < count; i++) {
                this.models[i] = dat.g2();
            }
        } else if (code === 14) {
            this.width = dat.g1();
        } else if (code === 15) {
            this.length = dat.g1();
        } else if (code === 17) {
            this.blockwalk = false;
            this.blockrange = false;
        } else if (code === 18) {
            this.blockrange = false;
        } else if (code === 19) {
            this.active = dat.g1();
        } else if (code === 21) {
            this.hillskew = 1;
        } else if (code === 22) {
            this.sharelight = true;
        } else if (code === 23) {
            this.occlude = true;
        } else if (code === 24) {
            this.anim = dat.g2();

            if (this.anim == 65535) {
                this.anim = -1;
            }
        } else if (code === 25) {
            this.hasalpha = true;
        } else if (code === 27) {
            this.blockwalk = true;
        } else if (code === 28) {
            this.wallwidth = dat.g1();
        } else if (code === 29) {
            this.ambient = dat.g1b();
        } else if (code === 39) {
            this.contrast = dat.g1b();  // Value multiplied by 5 client side
        } else if (code >= 30 && code < 35) {
            if (!this.op) {
                this.op = new Array(5).fill(null);
            }

            this.op[code - 30] = dat.gjstr();
        } else if (code === 40) {
            const count = dat.g1();
            this.recol_s = new Uint16Array(count);
            this.recol_d = new Uint16Array(count);

            for (let i = 0; i < count; i++) {
                this.recol_s[i] = dat.g2();
                this.recol_d[i] = dat.g2();
            }
        } else if (code === 41) {
            const count = dat.g1();
            this.retex_s = new Uint16Array(count);
            this.retex_d = new Uint16Array(count);

            for (let i = 0; i < count; i++) {
                this.retex_s[i] = dat.g2();
                this.retex_d[i] = dat.g2();
            }
        } else if (code === 42) {
            const count = dat.g1();
            this.recol_d_palette = new Int8Array(count);

            for (let i = 0; i < count; i++) {
                this.recol_d_palette[i] = dat.g1b();
            }
        } else if (code === 60) {
            this.mapfunction = dat.g2();
        } else if (code === 61) {
            this.category = dat.g2();
        } else if (code === 62) {
            this.mirror = true;
        } else if (code === 64) {
            this.shadow = false;
        } else if (code === 65) {
            this.resizex = dat.g2();
        } else if (code === 66) {
            this.resizey = dat.g2();
        } else if (code === 67) {
            this.resizez = dat.g2();
        } else if (code === 68) {
            this.mapscene = dat.g2(); // todo: not in client by 530
        } else if (code === 69) {
            this.forceapproach = dat.g1();
        } else if (code === 70) {
            this.offsetx = dat.g2s();
        } else if (code === 71) {
            this.offsety = dat.g2s();
        } else if (code === 72) {
            this.offsetz = dat.g2s();
        } else if (code === 73) {
            this.forcedecor = true;
        } else if (code === 74) {
            this.breakroutefinding = true;
        } else if (code === 75) {
            this.raiseobject = dat.g1();
        } else if (code === 77 || code === 92) {
            this.multivarbit = dat.g2();
            if (this.multivarbit === 65535) {
                this.multivarbit = -1;
            }

            this.multivarp = dat.g2();
            if (this.multivarp === 65535) {
                this.multivarp = -1;
            }

            let defaultid = -1;
            if (code === 92) {
                defaultid = dat.g2();
                if (defaultid === 65535) {
                    defaultid = -1;
                }
            }

            const count = dat.g1();
            this.multiloc = new Array(count + 2);
            for (let i = 0; i <= count; i++) {
                this.multiloc[i] = dat.g2();
                if (this.multiloc[i] === 65535) {
                    this.multiloc[i] = -1;
                }
            }
            this.multiloc[count + 1] = defaultid;
        } else if (code === 78) {
            this.bgsound_sound = dat.g2();
            this.bgsound_range = dat.g1();
        } else if (code === 79) {
            this.bgsound_mindelay = dat.g2();
            this.bgsound_maxdelay = dat.g2();
            this.bgsound_range = dat.g1();

            const count = dat.g1();
            this.bgsound_random = new Array(count);
            for (let i = 0; i < count; i++) {
                this.bgsound_random[i] = dat.g2();
            }
        } else if (code === 81) {
            this.hillskew = 2;
            this.hillskew_amount = dat.g1(); // Value multiplied by 256 client side
        } else if (code === 88) {
            this.randomanimframe = false;
        } else if (code === 91) {
            this.members = true;
        } else if (code === 93) {
            this.hillskew = 3;
            this.hillskew_amount = dat.g2();
        } else if (code === 94) {
            this.hillskew = 4;
        } else if (code === 95) {
            this.hillskew = 5;
        } else if (code === 97) {
            this.mapsceneiconrotate = true;
        } else if (code === 102) {
            this.mapsceneicon = dat.g2(); 
        } else if (code === 249) {
            this.params = ParamHelper.decodeParams(dat);
        } else if (code === 250) {
            this.debugname = dat.gjstr();
        } else {
            printFatalError(`Unrecognized loc config code: ${code}\nThis error comes from the packed data being out of sync, try running ` + kleur.green().bold('npm run build') + ', then restarting this.');
        }
    }

    postDecode() {
        if (this.active === -1) {
            this.active = 0;

            if (this.shapes && this.shapes.length === 1 && this.shapes[0] === 10) {
                this.active = 1;
            }

            if (this.op !== null) {
                this.active = 1;
            }
        }
    }
}
