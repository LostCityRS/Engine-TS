export default class ServerGameProt {
    // interfaces
    static readonly IF_OPENCHAT = new ServerGameProt(166, 2);
    static readonly IF_OPENMAIN_SIDE = new ServerGameProt(158, 4);
    static readonly IF_CLOSE = new ServerGameProt(171, 0);
    static readonly IF_SETTAB = new ServerGameProt(215, 3);
    static readonly IF_SETTAB_ACTIVE = new ServerGameProt(241, 1);
    static readonly IF_OPENMAIN = new ServerGameProt(211, 2);
    static readonly IF_OPENSIDE = new ServerGameProt(16, 2);
    static readonly IF_OPENOVERLAY = new ServerGameProt(240, 2);

    // updating interfaces
    static readonly IF_SETCOLOUR = new ServerGameProt(183, 4); // NXT naming
    static readonly IF_SETHIDE = new ServerGameProt(10, 3); // NXT naming
    static readonly IF_SETOBJECT = new ServerGameProt(28, 6); // NXT naming
    static readonly IF_SETMODEL = new ServerGameProt(129, 4); // NXT naming
    static readonly IF_SETANIM = new ServerGameProt(134, 4); // NXT naming
    static readonly IF_SETPLAYERHEAD = new ServerGameProt(192, 2); // NXT naming
    static readonly IF_SETTEXT = new ServerGameProt(44, -2); // NXT naming
    static readonly IF_SETNPCHEAD = new ServerGameProt(142, 4); // NXT naming
    static readonly IF_SETPOSITION = new ServerGameProt(77, 6); // NXT naming
    static readonly IF_SETSCROLLPOS = new ServerGameProt(54, 4); // NXT naming

    // tutorial area
    static readonly TUT_FLASH = new ServerGameProt(90, 1);
    static readonly TUT_OPEN = new ServerGameProt(130, 2);

    // inventory
    static readonly UPDATE_INV_STOP_TRANSMIT = new ServerGameProt(227, 2); // NXT naming
    static readonly UPDATE_INV_FULL = new ServerGameProt(106, -2); // NXT naming
    static readonly UPDATE_INV_PARTIAL = new ServerGameProt(172, -2); // NXT naming

    // camera control
    static readonly CAM_LOOKAT = new ServerGameProt(233, 6); // NXT naming
    static readonly CAM_SHAKE = new ServerGameProt(64, 4); // NXT naming
    static readonly CAM_MOVETO = new ServerGameProt(200, 6); // NXT naming
    static readonly CAM_RESET = new ServerGameProt(101, 0); // NXT naming

    // entity updates
    static readonly NPC_INFO = new ServerGameProt(197, -2); // NXT naming
    static readonly PLAYER_INFO = new ServerGameProt(167, -2); // NXT naming

    // social
    static readonly FRIENDLIST_LOADED = new ServerGameProt(185, 1); // NXT naming
    static readonly MESSAGE_GAME = new ServerGameProt(161, -1); // NXT naming
    static readonly UPDATE_IGNORELIST = new ServerGameProt(3, -2); // NXT naming
    static readonly CHAT_FILTER_SETTINGS = new ServerGameProt(114, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ServerGameProt(235, -1); // NXT naming
    static readonly UPDATE_FRIENDLIST = new ServerGameProt(247, 9); // NXT naming

    // misc
    static readonly UNSET_MAP_FLAG = new ServerGameProt(115, 0); // NXT has "SET_MAP_FLAG" but we cannot control the position
    static readonly UPDATE_RUNWEIGHT = new ServerGameProt(67, 2); // NXT naming
    static readonly HINT_ARROW = new ServerGameProt(156, 6); // NXT naming
    static readonly UPDATE_REBOOT_TIMER = new ServerGameProt(89, 2); // NXT naming
    static readonly UPDATE_STAT = new ServerGameProt(105, 6); // NXT naming
    static readonly UPDATE_RUNENERGY = new ServerGameProt(83, 1); // NXT naming
    static readonly RESET_ANIMS = new ServerGameProt(47, 0); // NXT naming
    static readonly UPDATE_PID = new ServerGameProt(133, 3);
    static readonly LAST_LOGIN_INFO = new ServerGameProt(91, 10); // NXT naming
    static readonly LOGOUT = new ServerGameProt(88, 0); // NXT naming
    static readonly P_COUNTDIALOG = new ServerGameProt(210, 0); // named after runescript command + client resume_p_countdialog packet
    static readonly SET_MULTIWAY = new ServerGameProt(207, 1);
    static readonly SET_PLAYER_OP = new ServerGameProt(17, -1);
    static readonly MINIMAP_TOGGLE = new ServerGameProt(194, 1);

    // maps
    static readonly REBUILD_NORMAL = new ServerGameProt(231, 4); // NXT naming (do we really need _normal if there's no region rebuild?)

    // vars
    static readonly VARP_SMALL = new ServerGameProt(203, 3); // NXT naming
    static readonly VARP_LARGE = new ServerGameProt(245, 6); // NXT naming
    static readonly RESET_CLIENT_VARCACHE = new ServerGameProt(190, 0); // todo: rename to VARP_SYNC

    // audio
    static readonly SYNTH_SOUND = new ServerGameProt(34, 5); // NXT naming
    static readonly MIDI_SONG = new ServerGameProt(23, 2); // NXT naming
    static readonly MIDI_JINGLE = new ServerGameProt(15, 4); // NXT naming

    // zones
    static readonly UPDATE_ZONE_PARTIAL_FOLLOWS = new ServerGameProt(32, 2); // NXT naming
    static readonly UPDATE_ZONE_FULL_FOLLOWS = new ServerGameProt(153, 2); // NXT naming
    static readonly UPDATE_ZONE_PARTIAL_ENCLOSED = new ServerGameProt(195, -2); // NXT naming

    constructor(
        readonly id: number,
        readonly length: number
    ) {}
}
