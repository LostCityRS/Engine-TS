import ServerGameProt from '#/network/game/server/ServerGameProt.js';

export default class ServerGameZoneProt extends ServerGameProt {
    // zone protocol
    static readonly LOC_MERGE = new ServerGameZoneProt(203, 14); // todo: rename to P_LOCMERGE
    static readonly LOC_ANIM = new ServerGameZoneProt(142, 4);
    static readonly OBJ_DEL = new ServerGameZoneProt(208, 3);
    static readonly OBJ_REVEAL = new ServerGameZoneProt(106, 7);
    static readonly LOC_ADD_CHANGE = new ServerGameZoneProt(152, 4);
    static readonly MAP_PROJANIM = new ServerGameZoneProt(181, 15);
    static readonly LOC_DEL = new ServerGameZoneProt(88, 2);
    static readonly OBJ_COUNT = new ServerGameZoneProt(121, 7);
    static readonly MAP_ANIM = new ServerGameZoneProt(59, 6);
    static readonly OBJ_ADD = new ServerGameZoneProt(107, 5);
    static readonly SOUND_AREA = new ServerGameZoneProt(41, 4);
}
