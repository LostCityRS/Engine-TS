import ServerGameProt from '#/network/game/server/ServerGameProt.js';

export default class ServerGameZoneProt extends ServerGameProt {
    // zone protocol
    static readonly LOC_MERGE = new ServerGameZoneProt(23, 14); // based on runescript command p_locmerge
    static readonly LOC_ANIM = new ServerGameZoneProt(42, 4); // NXT naming
    static readonly OBJ_DEL = new ServerGameZoneProt(49, 3); // NXT naming
    static readonly OBJ_REVEAL = new ServerGameZoneProt(50, 7); // NXT naming
    static readonly LOC_ADD_CHANGE = new ServerGameZoneProt(59, 4); // NXT naming
    static readonly MAP_PROJANIM = new ServerGameZoneProt(69, 15); // NXT naming
    static readonly LOC_DEL = new ServerGameZoneProt(76, 2); // NXT naming
    static readonly OBJ_COUNT = new ServerGameZoneProt(151, 7); // NXT naming
    static readonly MAP_ANIM = new ServerGameZoneProt(191, 6); // NXT naming
    static readonly OBJ_ADD = new ServerGameZoneProt(223, 5); // NXT naming
}
