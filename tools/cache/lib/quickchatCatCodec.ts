import Packet from '#/io/Packet.js';
import QuickChatCatType from '#/cache/config/QuickChatCatType.js';

export function encodeQuickChatCat(config: QuickChatCatType): Uint8Array {
    const buf = Packet.alloc(2);

    // Opcode 4: optional marker with no payload (appears first in archive 25)
    if (config.hasOpcode4) {
        buf.p1(4);
    }

    // Opcode 1: description
    if (config.description) {
        buf.p1(1);
        buf.pjstr(config.description);
    }

    // Opcode 2: subcategories
    if (config.subcategories && config.subcategories.length > 0) {
        buf.p1(2);
        buf.p1(config.subcategories.length);
        for (let i = 0; i < config.subcategories.length; i++) {
            buf.p2(config.subcategories[i]);
            const shortcut = config.subcategoryShortcuts?.[i] ?? 0;
            buf.p1(shortcut & 0xff);
        }
    }

    // Opcode 3: phrases
    if (config.phrases && config.phrases.length > 0) {
        buf.p1(3);
        buf.p1(config.phrases.length);
        for (let i = 0; i < config.phrases.length; i++) {
            buf.p2(config.phrases[i]);
            const shortcut = config.phraseShortcuts?.[i] ?? 0;
            buf.p1(shortcut & 0xff);
        }
    }

    // Opcode 250: debugname
    if (config.debugname) {
        buf.p1(250);
        buf.pjstr(config.debugname);
    }

    buf.p1(0);
    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
