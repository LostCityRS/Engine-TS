import ScriptVarType from '#/cache/config/ScriptVarType.js';
import Packet from '#/io/Packet.js';
import EnumType from '#/cache/config/EnumType.js';

export function encodeEnum(config: EnumType): Uint8Array {
    const buf = Packet.alloc(2);

    const hasContent = config.values.size > 0 ||
        config.inputtype !== ScriptVarType.INT ||
        config.outputtype !== ScriptVarType.INT ||
        (config.outputtype === ScriptVarType.STRING && config.defaultString !== 'null' && config.defaultString !== '') ||
        (config.outputtype !== ScriptVarType.STRING && config.defaultInt !== 0);

    if (hasContent) {
        buf.p1(1);
        buf.p1(config.inputtype);
    }

    if (hasContent) {
        buf.p1(2);
        buf.p1(config.outputtype);
    }

    if (config.values.size > 0) {
        const isStringValues = config.outputtype === ScriptVarType.STRING;

        if (isStringValues) {
            buf.p1(5);
            buf.p2(config.values.size);
            for (const [key, value] of config.values) {
                buf.p4(key);
                buf.pjstr(String(value));
            }
        } else {
            buf.p1(6);
            buf.p2(config.values.size);
            for (const [key, value] of config.values) {
                buf.p4(key);
                buf.p4(Number(value));
            }
        }
    }

    if (config.outputtype === ScriptVarType.STRING) {
        if (config.hasExplicitDefaultString || (config.defaultString !== 'null' && config.defaultString !== '')) {
            buf.p1(3);
            buf.pjstr(config.defaultString);
        }
    } else {
        if (config.hasExplicitDefaultInt || config.defaultInt !== 0) {
            buf.p1(4);
            buf.p4(config.defaultInt);
        }
    }

    if (config.debugname) {
        buf.p1(250);
        buf.pjstr(config.debugname);
    }

    buf.p1(0);

    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
