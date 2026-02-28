import kleur from 'kleur';

import { ConfigType } from '#/cache/config/ConfigType.js';
import { ParamHelper, ParamMap } from '#/cache/config/ParamHelper.js';
import ParamType from '#/cache/config/ParamType.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import { printFatalError } from '#/util/Logger.js';

export default class ObjType extends ConfigType {
    static configNames: Map<string, number> = new Map();
    static configs: ObjType[] = [];

    static load(_dir: string) {
    }

    static parse(server: Packet, jag: Jagfile) {
        ObjType.configNames = new Map();
        ObjType.configs = [];

        const count = server.g2();

        const client = jag.read('obj.dat')!;
        client.pos = 2;

        for (let id = 0; id < count; id++) {
            const config = new ObjType(id);
            config.decodeType(server);
            config.decodeType(client);

            ObjType.configs[id] = config;

            if (config.debugname) {
                ObjType.configNames.set(config.debugname, id);
            }
        }

        for (let id = 0; id < count; id++) {
            const config = ObjType.configs[id];

            if (config.certtemplate != -1) {
                config.toCertificate();
            }

            if (config.dummyitem !== 0) {
                config.tradeable = false;
            }

            if (!Environment.NODE_MEMBERS && config.members) {
                config.tradeable = false;
                config.op = null;
                config.iop = null;

                config.params.forEach((_, key): void => {
                    if (ParamType.get(key)?.autodisable) {
                        config.params.delete(key);
                    }
                });
            }
        }
    }

    static get(id: number): ObjType {
        return ObjType.configs[id];
    }

    static getId(name: string): number {
        return ObjType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): ObjType | null {
        const id = this.getId(name);
        if (id === -1) {
            return null;
        }

        return this.get(id);
    }

    static get count() {
        return this.configs.length;
    }

    static getWearPosId(name: string): number {
        switch (name) {
            case 'hat':
                return 0;
            case 'back':
                return 1;
            case 'front':
                return 2;
            case 'righthand':
                return 3;
            case 'torso':
                return 4;
            case 'lefthand':
                return 5;
            case 'arms':
                return 6;
            case 'legs':
                return 7;
            case 'head':
                return 8;
            case 'hands':
                return 9;
            case 'feet':
                return 10;
            case 'jaw':
                return 11;
            case 'ring':
                return 12;
            case 'quiver':
                return 13;
            default:
                return -1;
        }
    }

    // ----
    model = 0;
    name: string | null = null;
    desc: string | null = null;
    recol_s: Uint16Array | null = null;
    recol_d: Uint16Array | null = null;
    retex_s: Uint16Array | null = null;
    retex_d: Uint16Array | null = null;
    recol_d_palette: Int8Array | null = null;
    stockmarket = false;
    zoom2d = 2000;
    xan2d = 0;
    yan2d = 0;
    zan2d = 0;
    xof2d = 0;
    yof2d = 0;
    code9 = false;
    code10 = -1;
    stackable = false;
    cost = 1;
    members = false;
    op: (string | null)[] | null = null;
    iop: (string | null)[] | null = null;
    manwear = -1;
    manwear2 = -1;
    manwearOffsetX = 0;
    manwearOffsetY = 0;
    manwearOffsetZ = 0;
    womanwear = -1;
    womanwear2 = -1;
    womanwearOffsetX = 0;
    womanwearOffsetY = 0;
    womanwearOffsetZ = 0;
    manwear3 = -1;
    womanwear3 = -1;
    manhead = -1;
    manhead2 = -1;
    womanhead = -1;
    womanhead2 = -1;
    countobj: Uint16Array | null = null;
    countco: Uint16Array | null = null;
    certlink = -1;
    certtemplate = -1;
    resizex = 128;
    resizey = 128;
    resizez = 128;
    ambient = 0;
    contrast = 0;
    team = 0;
    lentlink = -1;
    lenttemplate = -1;

    cursor1op = -1;
    cursor1 = -1;
    cursor2op = -1;
    cursor2 = -1;
    cursor1iop = -1;
    cursor1i = -1;
    cursor2iop = -1;
    cursor2i = -1;

    // server-side
    wearpos = -1;
    wearpos2 = -1;
    wearpos3 = -1;
    weight = 0; // in grams
    category = -1;
    dummyitem = 0;
    tradeable = true;
    respawnrate = 100; // default to 1-minute
    params: ParamMap = new Map();

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            this.model = dat.g2();
        } else if (code === 2) {
            this.name = dat.gjstr();
        } else if (code === 3) {
            this.desc = dat.gjstr();
        } else if (code === 4) {
            this.zoom2d = dat.g2();
        } else if (code === 5) {
            this.xan2d = dat.g2();
        } else if (code === 6) {
            this.yan2d = dat.g2();
        } else if (code === 7) {
            this.xof2d = dat.g2s();
        } else if (code === 8) {
            this.yof2d = dat.g2s();
        } else if (code === 11) {
            this.stackable = true;
        } else if (code === 12) {
            this.cost = dat.g4s();
        } else if (code === 13) {
            this.wearpos = dat.g1();
        } else if (code === 14) {
            this.wearpos2 = dat.g1();
        } else if (code === 15) {
            this.tradeable = false;
        } else if (code === 16) {
            this.members = true;
        } else if (code === 23) {
            this.manwear = dat.g2();
        } else if (code === 24) {
            this.manwear2 = dat.g2();
        } else if (code === 25) {
            this.womanwear = dat.g2();
        } else if (code === 26) {
            this.womanwear2 = dat.g2();
        } else if (code === 27) {
            this.wearpos3 = dat.g1();
        } else if (code >= 30 && code < 35) {
            if (!this.op) {
                this.op = new Array(5).fill(null);
            }
            this.op[code - 30] = dat.gjstr();
        } else if (code >= 35 && code < 40) {
            if (!this.iop) {
                this.iop = new Array(5).fill(null);
            }
            this.iop[code - 35] = dat.gjstr();
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
        } else if (code === 65) {
            this.stockmarket = true;
        } else if (code === 75) {
            this.weight = dat.g2s();
        } else if (code === 78) {
            this.manwear3 = dat.g2();
        } else if (code === 79) {
            this.womanwear3 = dat.g2();
        } else if (code === 90) {
            this.manhead = dat.g2();
        } else if (code === 91) {
            this.womanhead = dat.g2();
        } else if (code === 92) {
            this.manhead2 = dat.g2();
        } else if (code === 93) {
            this.womanhead2 = dat.g2();
        } else if (code === 94) {
            this.category = dat.g2();
        } else if (code === 95) {
            this.zan2d = dat.g2();
        } else if (code === 96) {
            this.dummyitem = dat.g1();
        } else if (code === 97) {
            this.certlink = dat.g2();
        } else if (code === 98) {
            this.certtemplate = dat.g2();
        } else if (code >= 100 && code < 110) {
            if (!this.countobj || !this.countco) {
                this.countobj = new Uint16Array(10);
                this.countco = new Uint16Array(10);
            }
            this.countobj[code - 100] = dat.g2();
            this.countco[code - 100] = dat.g2();
        } else if (code === 110) {
            this.resizex = dat.g2();
        } else if (code === 111) {
            this.resizey = dat.g2();
        } else if (code === 112) {
            this.resizez = dat.g2();
        } else if (code === 113) {
            this.ambient = dat.g1b();
        } else if (code === 114) {
            this.contrast = dat.g1b();  // Value multiplied by 5 client side
        } else if (code === 115) {
            this.team = dat.g1();
        } else if (code === 121) {
            this.lentlink = dat.g2();
        } else if (code === 122) {
            this.lenttemplate = dat.g2();
        } else if (code === 125) {
            this.manwearOffsetX = dat.g1b();
            this.manwearOffsetY = dat.g1b();
            this.manwearOffsetZ = dat.g1b();
        } else if (code === 126) {
            this.womanwearOffsetX = dat.g1b();
            this.womanwearOffsetY = dat.g1b();
            this.womanwearOffsetZ = dat.g1b();
        } else if (code === 127) {
            this.cursor1op = dat.g1();
            this.cursor1 = dat.g2();
        } else if (code === 128) {
            this.cursor2op = dat.g1();
            this.cursor2 = dat.g2();
        } else if (code === 129) {
            this.cursor1iop = dat.g1();
            this.cursor1i = dat.g2();
        } else if (code === 130) {
            this.cursor2iop = dat.g1();
            this.cursor2i = dat.g2();
        } else if (code === 201) {
            this.respawnrate = dat.g2();
        } else if (code === 249) {
            this.params = ParamHelper.decodeParams(dat);
        } else if (code === 250) {
            this.debugname = dat.gjstr();
        } else {
            printFatalError(`Unrecognized obj config code: ${code}\nThis error comes from the packed data being out of sync, try running ` + kleur.green().bold('npm run build') + ', then restarting this.');
        }
    }

    toCertificate() {
        const template = ObjType.get(this.certtemplate)!;
        this.model = template.model;
        this.zoom2d = template.zoom2d;
        this.xan2d = template.xan2d;
        this.yan2d = template.yan2d;
        this.zan2d = template.zan2d;
        this.xof2d = template.xof2d;
        this.yof2d = template.yof2d;
        this.recol_s = template.recol_s;
        this.recol_d = template.recol_d;
        this.recol_d_palette = template.recol_d_palette;
        this.retex_s = template.retex_s;
        this.retex_d = template.retex_d;

        const link = ObjType.get(this.certlink)!;
        this.name = link.name;
        this.members = link.members;
        this.cost = link.cost;
        this.tradeable = link.tradeable;

        let article = 'a';
        const c = (link.name || '').toLowerCase().charAt(0);
        if (c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u') {
            article = 'an';
        }
        this.desc = `Swap this note at any bank for ${article} ${link.name}.`;

        this.stackable = true;
    }

    toLentObj() {
        const template = ObjType.get(this.lenttemplate)!;
        this.model = template.model;
        this.zoom2d = template.zoom2d;
        this.xan2d = template.xan2d;
        this.yan2d = template.yan2d;
        this.zan2d = template.zan2d;
        this.xof2d = template.xof2d;
        this.yof2d = template.yof2d;

        const link = ObjType.get(this.lentlink)!;
        this.name = link.name;
        this.recol_s = link.recol_s;
        this.recol_d = link.recol_d;
        this.recol_d_palette = link.recol_d_palette;
        this.retex_s = link.retex_s;
        this.retex_d = link.retex_d;
        this.manhead = link.manhead;
        this.manhead2 = link.manhead2;
        this.manwear = link.manwear;
        this.manwear2 = link.manwear2;
        this.manwear3 = link.manwear3;
        this.manwearOffsetX = link.manwearOffsetX;
        this.manwearOffsetY = link.manwearOffsetY;
        this.manwearOffsetZ = link.manwearOffsetZ;
        this.womanhead = link.womanhead;
        this.womanhead2 = link.womanhead2;
        this.womanwear = link.womanwear;
        this.womanwear2 = link.womanwear2;
        this.womanwear3 = link.womanwear3;
        this.womanwearOffsetX = link.womanwearOffsetX;
        this.womanwearOffsetY = link.womanwearOffsetY;
        this.womanwearOffsetZ = link.womanwearOffsetZ;
        this.op = link.op;
        this.team = link.team;
        this.members = link.members;
        this.params = link.params;

        // Need to verify descriptions for lent items.
        // this.desc = 
        this.tradeable = false;
        this.cost = 0;

        this.iop = new Array(5).fill(null);
        if (link.iop != null) {
            for (let i = 0; i < link.iop.length; i++) {
                this.iop[i] = link.iop[i];
            }
        }
        this.iop[0] = 'Discard';
    }
}
