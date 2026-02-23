import Packet from '#/io/Packet.js';
import QuickChatPhraseType from '#/cache/config/QuickChatPhraseType.js';

export function encodeQuickChatPhrase(config: QuickChatPhraseType): Uint8Array {
    const buf = Packet.alloc(2);

    // Opcode 1: text (split by '<' character)
    if (config.text && config.text.length > 0) {
        buf.p1(1);
        const fullText = config.text.join('<');
        buf.pjstr(fullText);
    }

    // Opcode 2: auto responses
    if (config.autoResponses && config.autoResponses.length > 0) {
        buf.p1(2);
        buf.p1(config.autoResponses.length);
        for (let i = 0; i < config.autoResponses.length; i++) {
            buf.p2(config.autoResponses[i]);
        }
    }

    // Opcode 3: dynamic commands with parameters
    if (config.dynamicCommands && config.dynamicCommands.length > 0) {
        buf.p1(3);
        buf.p1(config.dynamicCommands.length);
        for (let i = 0; i < config.dynamicCommands.length; i++) {
            const commandId = config.dynamicCommands[i];
            buf.p2(commandId);

            const params = config.dynamicCommandParameters?.[i] ?? [];
            for (let p = 0; p < params.length; p++) {
                buf.p2(params[p]);
            }
        }
    }

    // Opcode 4: searchable flag (only if false)
    if (!config.searchable) {
        buf.p1(4);
    }

    // Opcode 250: debugname
    if (config.debugname) {
        buf.p1(250);
        buf.pjstr(config.debugname);
    }

    buf.p1(0);
    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
