import ServerGameProt from '#/network/game/server/ServerGameProt.js';

export default class ServerGameZoneProt extends ServerGameProt {
    // zone protocol
    static readonly LOC_MERGE = new ServerGameZoneProt(23, 14); // todo: rename to P_LOCMERGE
    static readonly LOC_ANIM = new ServerGameZoneProt(42, 4);
    static readonly OBJ_DEL = new ServerGameZoneProt(49, 3);
    static readonly OBJ_REVEAL = new ServerGameZoneProt(50, 7);
    static readonly LOC_ADD_CHANGE = new ServerGameZoneProt(59, 4);
    static readonly MAP_PROJANIM = new ServerGameZoneProt(69, 15);
    static readonly LOC_DEL = new ServerGameZoneProt(76, 2);
    static readonly OBJ_COUNT = new ServerGameZoneProt(151, 7);
    static readonly MAP_ANIM = new ServerGameZoneProt(191, 6);
    static readonly OBJ_ADD = new ServerGameZoneProt(223, 5);
}
