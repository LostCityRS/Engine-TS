export default class ServerGameProt {
    // interfaces
    static readonly IF_OPENCHAT = new ServerGameProt(14, 2);
    static readonly IF_OPENMAIN_SIDE = new ServerGameProt(28, 4);
    static readonly IF_CLOSE = new ServerGameProt(129, 0);
    static readonly IF_SETTAB = new ServerGameProt(167, 3);
    static readonly IF_SETTAB_ACTIVE = new ServerGameProt(84, 1);
    static readonly IF_OPENMAIN = new ServerGameProt(168, 2);
    static readonly IF_OPENSIDE = new ServerGameProt(195, 2);

    // updating interfaces
    static readonly IF_SETCOLOUR = new ServerGameProt(2, 4);
    static readonly IF_SETHIDE = new ServerGameProt(26, 3);
    static readonly IF_SETOBJECT = new ServerGameProt(46, 6);
    static readonly IF_SETMODEL = new ServerGameProt(87, 4);
    static readonly IF_SETRECOL = new ServerGameProt(103, 6);
    static readonly IF_SETANIM = new ServerGameProt(146, 4);
    static readonly IF_SETPLAYERHEAD = new ServerGameProt(197, 2);
    static readonly IF_SETTEXT = new ServerGameProt(201, -2);
    static readonly IF_SETNPCHEAD = new ServerGameProt(204, 4);
    static readonly IF_SETPOSITION = new ServerGameProt(209, 6);

    // tutorial area
    static readonly TUT_FLASH = new ServerGameProt(126, 1);
    static readonly TUT_OPEN = new ServerGameProt(185, 2);

    // inventory
    static readonly UPDATE_INV_STOP_TRANSMIT = new ServerGameProt(15, 2);
    static readonly UPDATE_INV_FULL = new ServerGameProt(98, -2);
    static readonly UPDATE_INV_PARTIAL = new ServerGameProt(213, -2);

    // camera control
    static readonly CAM_LOOKAT = new ServerGameProt(74, 6);
    static readonly CAM_SHAKE = new ServerGameProt(13, 4);
    static readonly CAM_MOVETO = new ServerGameProt(3, 6);
    static readonly CAM_RESET = new ServerGameProt(239, 0);

    // entity updates
    static readonly NPC_INFO = new ServerGameProt(1, -2);
    static readonly PLAYER_INFO = new ServerGameProt(184, -2);

    // input tracking
    static readonly FINISH_TRACKING = new ServerGameProt(133, 0);
    static readonly ENABLE_TRACKING = new ServerGameProt(226, 0);

    // social
    static readonly MESSAGE_GAME = new ServerGameProt(4, -1);
    static readonly UPDATE_IGNORELIST = new ServerGameProt(21, -2);
    static readonly CHAT_FILTER_SETTINGS = new ServerGameProt(32, 3);
    static readonly MESSAGE_PRIVATE = new ServerGameProt(41, -1);
    static readonly UPDATE_FRIENDLIST = new ServerGameProt(152, 9);

    // misc
    static readonly UNSET_MAP_FLAG = new ServerGameProt(19, 0);
    static readonly UPDATE_RUNWEIGHT = new ServerGameProt(22, 2);
    static readonly HINT_ARROW = new ServerGameProt(25, 6);
    static readonly UPDATE_REBOOT_TIMER = new ServerGameProt(43, 2);
    static readonly UPDATE_STAT = new ServerGameProt(44, 6);
    static readonly UPDATE_RUNENERGY = new ServerGameProt(68, 1);
    static readonly RESET_ANIMS = new ServerGameProt(136, 0);
    static readonly UPDATE_PID = new ServerGameProt(139, 2);
    static readonly LAST_LOGIN_INFO = new ServerGameProt(140, 9);
    static readonly LOGOUT = new ServerGameProt(142, 0);
    static readonly P_COUNTDIALOG = new ServerGameProt(243, 0);
    static readonly SET_MULTIWAY = new ServerGameProt(254, 1);

    // maps
    static readonly DATA_LOC_DONE = new ServerGameProt(20, 2);
    static readonly DATA_LAND_DONE = new ServerGameProt(80, 2);
    static readonly DATA_LAND = new ServerGameProt(132, -2);
    static readonly DATA_LOC = new ServerGameProt(220, -2);
    static readonly REBUILD_NORMAL = new ServerGameProt(237, -2);

    // vars
    static readonly VARP_SMALL = new ServerGameProt(150, 3);
    static readonly VARP_LARGE = new ServerGameProt(175, 6);
    static readonly RESET_CLIENT_VARCACHE = new ServerGameProt(193, 0);

    // audio
    static readonly SYNTH_SOUND = new ServerGameProt(12, 5);
    static readonly MIDI_SONG = new ServerGameProt(54, -1);
    static readonly MIDI_JINGLE = new ServerGameProt(212, -2);

    // zones
    static readonly UPDATE_ZONE_PARTIAL_FOLLOWS = new ServerGameProt(7, 2);
    static readonly UPDATE_ZONE_FULL_FOLLOWS = new ServerGameProt(135, 2);
    static readonly UPDATE_ZONE_PARTIAL_ENCLOSED = new ServerGameProt(162, -2);

    constructor(
        readonly id: number,
        readonly length: number
    ) {}
}
