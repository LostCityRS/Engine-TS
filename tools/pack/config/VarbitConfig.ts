import { VarbitPack, VarpPack } from '#/util/PackFile.js';
import { PackedData, ConfigValue, ConfigLine } from '#tools/pack/config/PackShared.js';

export function parseVarbitConfig(key: string, value: string): ConfigValue | null | undefined {
    // prettier-ignore
    const numberKeys = [
        'startbit', 'endbit'
    ];

    if (numberKeys.includes(key)) {
        let number;
        if (value.startsWith('0x')) {
            // check that the string contains only hexadecimal characters, and minus sign if applicable
            if (!/^-?[0-9a-fA-F]+$/.test(value.slice(2))) {
                return null;
            }

            number = parseInt(value, 16);
        } else {
            // check that the string contains only numeric characters, and minus sign if applicable
            if (!/^-?[0-9]+$/.test(value)) {
                return null;
            }

            number = parseInt(value);
        }

        if (Number.isNaN(number)) {
            return null;
        }

        return number;
    } else if (key === 'basevar') {
        const index = VarpPack.getByName(value);
        if (index === -1) {
            return null;
        }

        return index;
    } else {
        return undefined;
    }
}

export function packVarbitConfigs(configs: Map<string, ConfigLine[]>): { client: PackedData; server: PackedData } {
    const client: PackedData = new PackedData(VarbitPack.size);
    const server: PackedData = new PackedData(VarbitPack.size);

    for (let i = 0; i < VarbitPack.size; i++) {
        const debugname = VarbitPack.getById(i);
        const config = configs.get(debugname);
        if (!config) {
            throw new Error(`Missing config for varbit ${debugname} id=${i}`);
        }

        let basevar: number | null = null;
        let startbit: number | null = null;
        let endbit: number | null = null;

        for (let j = 0; j < config.length; j++) {
            const { key, value } = config[j];

            if (key === 'basevar') {
                basevar = value as number;
            } else if (key === 'startbit') {
                startbit = value as number;
            } else if (key === 'protect') {
                endbit = value as number;
            }
        }

        if (basevar !== null && startbit !== null && endbit !== null) {
            server.p1(1);
            server.p2(basevar);
            server.p1(startbit);
            server.p1(endbit);
        }

        server.p1(250);
        server.pjstr(debugname);

        client.next();
        server.next();
    }

    return { client, server };
}
