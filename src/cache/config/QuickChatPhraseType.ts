import { ConfigType } from '#/cache/config/ConfigType.js';
import Packet from '#/io/Packet.js';

export default class QuickChatPhraseType extends ConfigType {
    private static configNames = new Map<string, number>();
    private static configs: QuickChatPhraseType[] = [];

    // TODO: Rework once we have more information on how dynamic command parameters work.
    // Index = command ID, Value = number of parameters that command takes
    static readonly DYNAMIC_COMMAND_PARAM_COUNTS = [
        1, 0, 0, 0, 1, 0, 2, 1, 1, 1, 0, 2, 0, 0, 1, 0
    ];

    static load(_dir: string) {
    }

    static parse(dat: Packet) {
        QuickChatPhraseType.configNames = new Map();
        QuickChatPhraseType.configs = [];

        const count = dat.g2();

        for (let id = 0; id < count; id++) {
            const config = new QuickChatPhraseType(id);
            config.decodeType(dat);

            QuickChatPhraseType.configs[id] = config;

            if (config.debugname) {
                QuickChatPhraseType.configNames.set(config.debugname, id);
            }
        }
    }

    static get(id: number): QuickChatPhraseType {
        return QuickChatPhraseType.configs[id];
    }

    static getId(name: string): number {
        return QuickChatPhraseType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): QuickChatPhraseType | null {
        const id = this.getId(name);
        if (id === -1) {
            return null;
        }

        return this.get(id);
    }

    static get count() {
        return this.configs.length;
    }

    // ---
    text: string[] | null = null;
    autoResponses: number[] | null = null;
    dynamicCommands: number[] | null = null;
    dynamicCommandParameters: number[][] | null = null;
    searchable: boolean = true;

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            // Text split by '<' (char code 60) delimiter
            const textStr = dat.gjstr();
            this.text = textStr.split('<');
        } else if (code === 2) {
            // Auto responses (IDs to response phrasetype configs)
            const count = dat.g1();
            this.autoResponses = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.autoResponses[i] = dat.g2();
            }
        } else if (code === 3) {
            // Dynamic commands (for variable substitution in phrases)
            const count = dat.g1();
            this.dynamicCommands = new Array<number>(count);
            this.dynamicCommandParameters = new Array<number[]>(count);

            for (let i = 0; i < count; i++) {
                const commandId = dat.g2();
                this.dynamicCommands[i] = commandId;

                // Parameter count is determined by static lookup table, not from packet
                const paramCount = QuickChatPhraseType.DYNAMIC_COMMAND_PARAM_COUNTS[commandId] ?? 0;
                this.dynamicCommandParameters[i] = new Array<number>(paramCount);
                for (let p = 0; p < paramCount; p++) {
                    this.dynamicCommandParameters[i][p] = dat.g2();
                }
            }
        } else if (code === 4) {
            // Searchable flag
            this.searchable = false;
        } else if (code === 250) {
            this.debugname = dat.gjstr();
        } else {
            throw new Error(`Unrecognized quickchat phrase config code: ${code}`);
        }
    }

    applyMembersHighBit(): void {
        if (this.autoResponses) {
            for (let i = 0; i < this.autoResponses.length; i++) {
                this.autoResponses[i] |= 0x8000;
            }
        }
    }

    toString() {
        return this.debugname ?? `quickchatphrase_${this.id}`;
    }
}
