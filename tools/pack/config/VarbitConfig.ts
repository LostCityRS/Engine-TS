import { VarbitPack, VarpPack } from '#tools/pack/PackFile.js';
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
    const client: PackedData = new PackedData(VarbitPack.max);
    const server: PackedData = new PackedData(VarbitPack.max);

    for (let id = 0; id < VarbitPack.max; id++) {
        const debugname = VarbitPack.getById(id);
        const config = configs.get(debugname);

        if (config) {
            let basevar: number | null = null;
            let startbit: number | null = null;
            let endbit: number | null = null;

            for (let j = 0; j < config.length; j++) {
                const { key, value } = config[j];

                if (key === 'basevar') {
                    basevar = value as number;
                } else if (key === 'startbit') {
                    startbit = value as number;
                } else if (key === 'endbit') {
                    endbit = value as number;
                }
            }

            if (basevar !== null && startbit !== null && endbit !== null) {
                client.p1(1);
                client.p2(basevar);
                client.p1(startbit);
                client.p1(endbit);
            }
        }

        if (debugname.length) {
            server.p1(250);
            server.pjstr(debugname);
        }

        client.next();
        server.next();
    }

    return { client, server };
}
