import ServerGameProt from '#/network/game/server/ServerGameProt.js';

export default class ServerGameZoneProt extends ServerGameProt {
    // zone protocol
    static readonly LOC_MERGE = new ServerGameZoneProt(29, 14); // based on runescript command p_locmerge
    static readonly LOC_ANIM = new ServerGameZoneProt(155, 4); // NXT naming
    static readonly OBJ_DEL = new ServerGameZoneProt(39, 3); // NXT naming
    static readonly OBJ_REVEAL = new ServerGameZoneProt(69, 7); // NXT naming
    static readonly LOC_ADD_CHANGE = new ServerGameZoneProt(232, 4); // NXT naming
    static readonly MAP_PROJANIM = new ServerGameZoneProt(137, 15); // NXT naming
    static readonly LOC_DEL = new ServerGameZoneProt(125, 2); // NXT naming
    static readonly OBJ_COUNT = new ServerGameZoneProt(209, 7); // NXT naming
    static readonly MAP_ANIM = new ServerGameZoneProt(198, 6); // NXT naming
    static readonly OBJ_ADD = new ServerGameZoneProt(234, 5); // NXT naming
}
