import MesanimType from '#/cache/config/MesanimType.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import { check, FontTypeValid, MesanimValid } from '#/engine/script/ScriptValidators.js';

const StringOps: CommandHandlers = {
    [ScriptOpcode.APPEND_NUM]: state => {
        const text = state.popString();
        const num = state.popInt();
        state.pushString(text + num);
    },

    [ScriptOpcode.APPEND]: state => {
        const [t1, t2] = state.popStrings(2);
        state.pushString(t1 + t2);
    },

    [ScriptOpcode.APPEND_SIGNNUM]: state => {
        const text = state.popString();
        const num = state.popInt();

        if (num >= 0) {
            state.pushString(`${text}+${num}`);
        } else {
            state.pushString(text + num);
        }
    },

    [ScriptOpcode.LOWERCASE]: state => {
        state.pushString(state.popString().toLowerCase());
    },

    [ScriptOpcode.TOSTRING]: state => {
        state.pushString(state.popInt().toString());
    },

    [ScriptOpcode.COMPARE]: state => {
        const [s1, s2] = state.popStrings(2);
        state.pushInt(javaStringCompare(s1, s2));
    },

    [ScriptOpcode.TEXT_SWITCH]: state => {
        const value = state.popInt();
        const [s1, s2] = state.popStrings(2);
        state.pushString(value === 1 ? s1 : s2);
    },

    [ScriptOpcode.APPEND_CHAR]: state => {
        const text = state.popString();
        const char = state.popInt();
        state.pushString(text + String.fromCharCode(char));
    },

    [ScriptOpcode.STRING_LENGTH]: state => {
        state.pushInt(state.popString().length);
    },

    [ScriptOpcode.SUBSTRING]: state => {
        const text = state.popString();
        const [start, end] = state.popInts(2);
        state.pushString(text.substring(start, end));
    },

    [ScriptOpcode.STRING_INDEXOF_CHAR]: state => {
        const text = state.popString();
        const find = String.fromCharCode(state.popInt());
        state.pushInt(text.indexOf(find));
    },

    [ScriptOpcode.STRING_INDEXOF_STRING]: state => {
        const text = state.popString();
        const find = state.popString();
        state.pushInt(text.indexOf(find));
    },

    [ScriptOpcode.SPLIT_INIT]: state => {
        const [maxWidth, linesPerPage, fontId] = state.popInts(3);
        let text = state.popString();

        const font = check(fontId, FontTypeValid);

        // todo: later this needs to lookup by <p=id> instead of <p,name>
        if (text.startsWith('<p,') && text.indexOf('>') !== -1) {
            const mesanim = text.substring(3, text.indexOf('>'));
            state.splitMesanim = MesanimType.getId(mesanim);
            text = text.substring(text.indexOf('>') + 1);
        } else {
            state.splitMesanim = -1;
        }

        state.splitPages = [];
        const lines = font.split(text, maxWidth);
        while (lines.length > 0) {
            state.splitPages.push(lines.splice(0, linesPerPage));
        }
    },

    [ScriptOpcode.SPLIT_GET]: state => {
        const [page, line] = state.popInts(2);

        state.pushString(state.splitPages[page][line]);
    },

    [ScriptOpcode.SPLIT_PAGECOUNT]: state => {
        state.pushInt(state.splitPages.length);
    },

    [ScriptOpcode.SPLIT_LINECOUNT]: state => {
        const page = state.popInt();

        state.pushInt(state.splitPages[page].length);
    },

    [ScriptOpcode.SPLIT_GETANIM]: state => {
        const page = state.popInt();
        if (state.splitMesanim === -1) {
            state.pushInt(-1);
            return;
        }

        state.pushInt(check(state.splitMesanim, MesanimValid).len[state.splitPages[page].length - 1]);
    },
};

function javaStringCompare(a: string, b: string): number {
    const len1 = a.length;
    const len2 = b.length;
    const lim = Math.min(len1, len2);

    let k = 0;
    while (k < lim) {
        const c1 = a.charCodeAt(k);
        const c2 = b.charCodeAt(k);
        if (c1 != c2) {
            return c1 - c2;
        }
        k++;
    }
    return len1 - len2;
}

export default StringOps;
