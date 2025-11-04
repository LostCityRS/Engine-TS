import fs from 'fs';

import { ScriptOpcodeMap } from '#/engine/script/ScriptOpcode.js';
import ScriptOpcodePointers from '#/engine/script/ScriptOpcodePointers.js';

export function generateServerSymbols() {
    fs.mkdirSync('data/symbols', { recursive: true });

    let commandSymbols = '';
    const commands = Array.from(ScriptOpcodeMap.entries())
        .sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < commands.length; i++) {
        const [name, opcode] = commands[i];
        const pointers = ScriptOpcodePointers[opcode];

        // format:
        // opcode<tab>command<tab>require<tab>corrupt<tab>set<tab>conditional<tab>secondary<tab>secondaryRequire

        if (pointers) {
            commandSymbols += `${opcode}\t${name.toLowerCase()}`;
        } else {
            commandSymbols += `${opcode}\t${name.toLowerCase()}\n`;
        }

        if (!pointers) {
            continue;
        }

        commandSymbols += '\t';

        if (pointers.require) {
            commandSymbols += pointers.require.join(',');
            if (pointers.require2) {
                commandSymbols += ':';
                commandSymbols += pointers.require2.join(',');
            }
        } else {
            commandSymbols += 'none';
        }

        commandSymbols += '\t';

        if (pointers.set) {
            if (pointers.conditional) {
                commandSymbols += 'CONDITIONAL:';
            }
            commandSymbols += pointers.set.join(',');
            if (pointers.set2) {
                commandSymbols += ':';
                commandSymbols += pointers.set2.join(',');
            }
        } else {
            commandSymbols += 'none';
        }

        commandSymbols += '\t';

        if (pointers.corrupt) {
            commandSymbols += pointers.corrupt.join(',');
            if (pointers.corrupt2) {
                commandSymbols += ':';
                commandSymbols += pointers.corrupt2.join(',');
            }
        } else {
            commandSymbols += 'none';
        }

        commandSymbols += '\n';
    }
    fs.writeFileSync('data/symbols/commands.sym', commandSymbols);
}

generateServerSymbols();
