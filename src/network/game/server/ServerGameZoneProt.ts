import ServerGameProt from '#/network/game/server/ServerGameProt.js';

export default class ServerGameZoneProt extends ServerGameProt {
    // zone protocol
    static readonly LOC_MERGE = new ServerGameZoneProt(203, 14); // based on runescript command p_locmerge
    static readonly LOC_ANIM = new ServerGameZoneProt(142, 4); // NXT naming
    static readonly OBJ_DEL = new ServerGameZoneProt(208, 3); // NXT naming
    static readonly OBJ_REVEAL = new ServerGameZoneProt(106, 7); // NXT naming
    static readonly LOC_ADD_CHANGE = new ServerGameZoneProt(152, 4); // NXT naming
    static readonly MAP_PROJANIM = new ServerGameZoneProt(181, 15); // NXT naming
    static readonly LOC_DEL = new ServerGameZoneProt(88, 2); // NXT naming
    static readonly OBJ_COUNT = new ServerGameZoneProt(121, 7); // NXT naming
    static readonly MAP_ANIM = new ServerGameZoneProt(59, 6); // NXT naming
    static readonly OBJ_ADD = new ServerGameZoneProt(107, 5); // NXT naming
    static readonly SOUND_AREA = new ServerGameZoneProt(41, 4); // NXT naming
}
