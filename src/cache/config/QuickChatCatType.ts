import { ConfigType } from '#/cache/config/ConfigType.js';
import Packet from '#/io/Packet.js';

export default class QuickChatCatType extends ConfigType {
    private static configNames = new Map<string, number>();
    private static configs: QuickChatCatType[] = [];

    static load(_dir: string) {
    }

    static parse(dat: Packet) {
        QuickChatCatType.configNames = new Map();
        QuickChatCatType.configs = [];

        const count = dat.g2();

        for (let id = 0; id < count; id++) {
            const config = new QuickChatCatType(id);
            config.decodeType(dat);

            QuickChatCatType.configs[id] = config;

            if (config.debugname) {
                QuickChatCatType.configNames.set(config.debugname, id);
            }
        }
    }

    static get(id: number): QuickChatCatType {
        return QuickChatCatType.configs[id];
    }

    static getId(name: string): number {
        return QuickChatCatType.configNames.get(name) ?? -1;
    }

    static getByName(name: string): QuickChatCatType | null {
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
    description: string | null = null;

    subcategories: number[] | null = null;
    subcategoryShortcuts: number[] | null = null;

    phrases: number[] | null = null;
    phraseShortcuts: number[] | null = null;
    hasOpcode4: boolean = false;

    private static shortcutByteToCode(value: number): number {
        return value & 0xff;
    }

    applyMembersHighBit(): void {
        if (this.phrases) {
            for (let i = 0; i < this.phrases.length; i++) {
                this.phrases[i] |= 0x8000;
            }
        }

        if (this.subcategories) {
            for (let i = 0; i < this.subcategories.length; i++) {
                this.subcategories[i] |= 0x8000;
            }
        }
    }

    getPhraseIdByShortcut(shortcut: number): number {
        if (!this.phrases || !this.phraseShortcuts) {
            return -1;
        }

        for (let i = 0; i < this.phrases.length; i++) {
            if (this.phraseShortcuts[i] === shortcut) {
                return this.phrases[i];
            }
        }

        return -1;
    }

    getSubCategoryIdByShortcut(shortcut: number): number {
        if (!this.subcategories || !this.subcategoryShortcuts) {
            return -1;
        }

        for (let i = 0; i < this.subcategories.length; i++) {
            if (this.subcategoryShortcuts[i] === shortcut) {
                return this.subcategories[i];
            }
        }

        return -1;
    }

    decode(code: number, dat: Packet): void {
        if (code === 1) {
            this.description = dat.gjstr();
        } else if (code === 2) {
            const count = dat.g1();
            this.subcategories = new Array<number>(count);
            this.subcategoryShortcuts = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.subcategories[i] = dat.g2();
                this.subcategoryShortcuts[i] = QuickChatCatType.shortcutByteToCode(dat.g1b());
            }
        } else if (code === 3) {
            const count = dat.g1();
            this.phrases = new Array<number>(count);
            this.phraseShortcuts = new Array<number>(count);

            for (let i = 0; i < count; i++) {
                this.phrases[i] = dat.g2();
                this.phraseShortcuts[i] = QuickChatCatType.shortcutByteToCode(dat.g1b());
            }
        } else if (code === 4) {
            // Present in some quickchat cat archives, no payload.
            this.hasOpcode4 = true;
        } else if (code === 250) {
            this.debugname = dat.gjstr();
        } else {
            throw new Error(`Unrecognized quickchat cat config code: ${code}`);
        }
    }

    toString() {
        return this.debugname ?? this.description ?? `quickchatcat_${this.id}`;
    }
}
