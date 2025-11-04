import ServerGameProt from '#/network/game/server/ServerGameProt.js';

export default class ServerGameZoneProt extends ServerGameProt {
    // zone protocol
    static readonly LOC_MERGE = new ServerGameZoneProt(202, 14); // based on runescript command p_locmerge
    static readonly LOC_ANIM = new ServerGameZoneProt(20, 4); // NXT naming
    static readonly OBJ_DEL = new ServerGameZoneProt(240, 3); // NXT naming
    static readonly OBJ_REVEAL = new ServerGameZoneProt(135, 7); // NXT naming
    static readonly LOC_ADD_CHANGE = new ServerGameZoneProt(179, 4); // NXT naming
    static readonly MAP_PROJANIM = new ServerGameZoneProt(104, 15); // NXT naming
    static readonly LOC_DEL = new ServerGameZoneProt(195, 2); // NXT naming
    static readonly OBJ_COUNT = new ServerGameZoneProt(14, 7); // NXT naming
    static readonly MAP_ANIM = new ServerGameZoneProt(17, 6); // NXT naming
    static readonly OBJ_ADD = new ServerGameZoneProt(33, 5); // NXT naming
    static readonly SOUND_AREA = new ServerGameZoneProt(97, 4); // NXT naming
}
