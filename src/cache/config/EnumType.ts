import fs from 'fs';
import path from 'path';

import { ConfigType } from '#/cache/config/ConfigType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import Packet from '#/io/Packet.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Js5PackReader from '#/io/Js5PackReader.js';
import { parseJs5ArchiveIndexFromPack, splitGroupFiles } from '#/io/Js5ArchiveIndex.js';

export default class EnumType extends ConfigType {
    static configNames = new Map<string, number>();
    static configs: EnumType[] = [];

    static load(dir: string) {
        const js5Path = path.join(dir, 'server.enum.js5');
        if (fs.existsSync(js5Path)) {
            this.loadFromJs5(js5Path);
            return;
        }

        const candidates = [path.join(dir, 'server', 'enum.dat'), path.join(dir, 'enum.dat')];

        let datPath: string | null = null;
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                datPath = candidate;
                break;
            }
        }

        if (!datPath) {
            return;
        }

        const bytes = new Uint8Array(fs.readFileSync(datPath));
        const unpacked = unpackJs5Group(bytes);
        this.parse(new Packet(unpacked));
    }

    private static loadFromJs5(js5Path: string): void {
        const js5Data = new Uint8Array(fs.readFileSync(js5Path));
        const indexInfo = parseJs5ArchiveIndexFromPack(js5Data);
        const pack = new Js5PackReader(js5Data);

        EnumType.configNames = new Map();
        EnumType.configs = [];

        for (const groupId of indexInfo.groupIds) {
            const packedGroup = pack.getGroup(groupId);
            if (!packedGroup || packedGroup.length === 0) {
                continue;
            }

            const fileIds = indexInfo.fileIdsByGroup.get(groupId);
            if (!fileIds || fileIds.length === 0) {
                continue;
            }

            const groupData = unpackJs5Group(packedGroup);
            const files = splitGroupFiles(groupData, fileIds);

            for (const fileId of fileIds) {
                const fileData = files.get(fileId);
                if (!fileData) {
                    continue;
                }

                const id = (groupId << 8) | fileId;
                const config = new EnumType(id);
                config.decodeType(new Packet(fileData));
                EnumType.configs[id] = config;

                if (config.debugname) {
                    EnumType.configNames.set(config.debugname, id);
                }
            }
        }
    }


    static parse(dat: Packet) {
        EnumType.configNames = new Map();
        EnumType.configs = [];

        const count = dat.g2();

        for (let id = 0; id < count; id++) {
            const config = new EnumType(id);
            config.decodeType(dat);

            EnumType.configs[id] = config;

            if (config.debugname) {
                EnumType.configNames.set(config.debugname, id);
            }
        }
    }

    static get(id: number): EnumType {
        return EnumType.configs[id];
    }

    static getId(name: string): number {
        return EnumType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): EnumType | null {
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
    inputtype = ScriptVarType.INT;
    outputtype = ScriptVarType.INT;
    defaultInt: number = 0;
    defaultString: string = 'null';
    values = new Map<number, number | string>();
    
    // Flags to track if defaults were explicitly encoded (even if value is 0/null)
    hasExplicitDefaultInt = false;
    hasExplicitDefaultString = false;

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            this.inputtype = dat.g1();
        } else if (code === 2) {
            this.outputtype = dat.g1();
        } else if (code === 3) {
            this.defaultString = dat.gjstr();
            this.hasExplicitDefaultString = true;
        } else if (code === 4) {
            this.defaultInt = dat.g4s();
            this.hasExplicitDefaultInt = true;
        } else if (code === 5) {
            const count = dat.g2();

            for (let i = 0; i < count; i++) {
                this.values.set(dat.g4s(), dat.gjstr());
            }
        } else if (code === 6) {
            const count = dat.g2();

            for (let i = 0; i < count; i++) {
                this.values.set(dat.g4s(), dat.g4s());
            }
        } else if (code === 250) {
            this.debugname = dat.gjstr();
        } else {
            throw new Error(`Unrecognized enum config code: ${code}`);
        }
    }
}
