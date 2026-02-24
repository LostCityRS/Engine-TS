import { ParamHelper } from '#/cache/config/ParamHelper.js';
import type ParamType from '#/cache/config/ParamType.js';
import type StructType from '#/cache/config/StructType.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import { check, ParamTypeValid, StructTypeValid } from '#/engine/script/ScriptValidators.js';

const StructOps: CommandHandlers = {
    [ScriptOpcode.STRUCT_PARAM]: state => {
        const [structId, paramId] = state.popInts(2);

        const paramType: ParamType = check(paramId, ParamTypeValid);
        const structType: StructType = check(structId, StructTypeValid);
        if (paramType.isString()) {
            state.pushString(ParamHelper.getStringParam(paramType.id, structType, paramType.defaultString));
        } else {
            state.pushInt(ParamHelper.getIntParam(paramType.id, structType, paramType.defaultInt));
        }
    },
};

export default StructOps;
