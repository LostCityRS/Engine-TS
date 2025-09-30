export default class ServerGameProt {
    // interfaces
    static readonly IF_OPENCHAT = new ServerGameProt(189, 2);
    static readonly IF_OPENMAIN_SIDE = new ServerGameProt(207, 4);
    static readonly IF_CLOSE = new ServerGameProt(214, 0);
    static readonly IF_SETTAB = new ServerGameProt(200, 3);
    static readonly IF_SETTAB_ACTIVE = new ServerGameProt(56, 1);
    static readonly IF_OPENMAIN = new ServerGameProt(10, 2);
    static readonly IF_OPENSIDE = new ServerGameProt(176, 2);
    static readonly IF_OPENOVERLAY = new ServerGameProt(158, 2);

    // updating interfaces
    static readonly IF_SETCOLOUR = new ServerGameProt(78, 4); // NXT naming
    static readonly IF_SETHIDE = new ServerGameProt(123, 3); // NXT naming
    static readonly IF_SETOBJECT = new ServerGameProt(164, 6); // NXT naming
    static readonly IF_SETMODEL = new ServerGameProt(245, 4); // NXT naming
    static readonly IF_SETRECOL = new ServerGameProt(103, 6); // NXT naming
    static readonly IF_SETANIM = new ServerGameProt(219, 4); // NXT naming
    static readonly IF_SETPLAYERHEAD = new ServerGameProt(108, 2); // NXT naming
    static readonly IF_SETTEXT = new ServerGameProt(154, -2); // NXT naming
    static readonly IF_SETNPCHEAD = new ServerGameProt(129, 4); // NXT naming
    static readonly IF_SETPOSITION = new ServerGameProt(241, 6); // NXT naming

    // tutorial area
    static readonly TUT_FLASH = new ServerGameProt(168, 1);
    static readonly TUT_OPEN = new ServerGameProt(174, 2);

    // inventory
    static readonly UPDATE_INV_STOP_TRANSMIT = new ServerGameProt(162, 2); // NXT naming
    static readonly UPDATE_INV_FULL = new ServerGameProt(72, -2); // NXT naming
    static readonly UPDATE_INV_PARTIAL = new ServerGameProt(132, -2); // NXT naming

    // camera control
    static readonly CAM_LOOKAT = new ServerGameProt(222, 6); // NXT naming
    static readonly CAM_SHAKE = new ServerGameProt(50, 4); // NXT naming
    static readonly CAM_MOVETO = new ServerGameProt(12, 6); // NXT naming
    static readonly CAM_RESET = new ServerGameProt(53, 0); // NXT naming

    // entity updates
    static readonly NPC_INFO = new ServerGameProt(244, -2); // NXT naming
    static readonly PLAYER_INFO = new ServerGameProt(86, -2); // NXT naming

    // input tracking
    static readonly FINISH_TRACKING = new ServerGameProt(60, 0);
    static readonly ENABLE_TRACKING = new ServerGameProt(22, 0);

    // social
    static readonly MESSAGE_GAME = new ServerGameProt(95, -1); // NXT naming
    static readonly UPDATE_IGNORELIST = new ServerGameProt(7, -2); // NXT naming
    static readonly CHAT_FILTER_SETTINGS = new ServerGameProt(9, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ServerGameProt(30, -1); // NXT naming
    static readonly UPDATE_FRIENDLIST = new ServerGameProt(70, 9); // NXT naming

    // misc
    static readonly UNSET_MAP_FLAG = new ServerGameProt(62, 0); // NXT has "SET_MAP_FLAG" but we cannot control the position
    static readonly UPDATE_RUNWEIGHT = new ServerGameProt(160, 2); // NXT naming
    static readonly HINT_ARROW = new ServerGameProt(49, 6); // NXT naming
    static readonly UPDATE_REBOOT_TIMER = new ServerGameProt(85, 2); // NXT naming
    static readonly UPDATE_STAT = new ServerGameProt(24, 6); // NXT naming
    static readonly UPDATE_RUNENERGY = new ServerGameProt(177, 1); // NXT naming
    static readonly RESET_ANIMS = new ServerGameProt(242, 0); // NXT naming
    static readonly UPDATE_PID = new ServerGameProt(210, 3);
    static readonly LAST_LOGIN_INFO = new ServerGameProt(44, 10); // NXT naming
    static readonly LOGOUT = new ServerGameProt(17, 0); // NXT naming
    static readonly P_COUNTDIALOG = new ServerGameProt(152, 0); // named after runescript command + client resume_p_countdialog packet
    static readonly SET_MULTIWAY = new ServerGameProt(97, 1);

    // maps
    static readonly REBUILD_NORMAL = new ServerGameProt(165, 4); // NXT naming (do we really need _normal if there's no region rebuild?)

    // vars
    static readonly VARP_SMALL = new ServerGameProt(236, 3); // NXT naming
    static readonly VARP_LARGE = new ServerGameProt(226, 6); // NXT naming
    static readonly RESET_CLIENT_VARCACHE = new ServerGameProt(87, 0); // NXT naming

    // audio
    static readonly SYNTH_SOUND = new ServerGameProt(151, 5); // NXT naming
    static readonly MIDI_SONG = new ServerGameProt(240, 2); // NXT naming
    static readonly MIDI_JINGLE = new ServerGameProt(173, 4); // NXT naming

    // zones
    static readonly UPDATE_ZONE_PARTIAL_FOLLOWS = new ServerGameProt(94, 2); // NXT naming
    static readonly UPDATE_ZONE_FULL_FOLLOWS = new ServerGameProt(131, 2); // NXT naming
    static readonly UPDATE_ZONE_PARTIAL_ENCLOSED = new ServerGameProt(233, -2); // NXT naming

    constructor(
        readonly id: number,
        readonly length: number
    ) {}
}
