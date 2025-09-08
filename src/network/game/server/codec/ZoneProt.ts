import ServerGameProt from '#/network/game/server/ServerGameProt.js';

export default class ZoneProt extends ServerGameProt {
    // zone protocol
    static readonly LOC_MERGE = new ZoneProt(203, 14); // based on runescript command p_locmerge
    static readonly LOC_ANIM = new ZoneProt(142, 4); // NXT naming
    static readonly OBJ_DEL = new ZoneProt(208, 3); // NXT naming
    static readonly OBJ_REVEAL = new ZoneProt(106, 7); // NXT naming
    static readonly LOC_ADD_CHANGE = new ZoneProt(152, 4); // NXT naming
    static readonly MAP_PROJANIM = new ZoneProt(181, 15); // NXT naming
    static readonly LOC_DEL = new ZoneProt(88, 2); // NXT naming
    static readonly OBJ_COUNT = new ZoneProt(121, 7); // NXT naming
    static readonly MAP_ANIM = new ZoneProt(59, 6); // NXT naming
    static readonly OBJ_ADD = new ZoneProt(107, 5); // NXT naming
    static readonly SOUND_AREA = new ZoneProt(41, 4); // NXT naming
}
