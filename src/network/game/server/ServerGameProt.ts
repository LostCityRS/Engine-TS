export default class ServerGameProt {
    // interfaces
    static readonly IF_OPENCHAT = new ServerGameProt(109, 2);
    static readonly IF_OPENMAIN_SIDE = new ServerGameProt(128, 4);
    static readonly IF_CLOSE = new ServerGameProt(29, 0);
    static readonly IF_SETTAB = new ServerGameProt(10, 3);
    static readonly IF_SETTAB_ACTIVE = new ServerGameProt(252, 1);
    static readonly IF_OPENMAIN = new ServerGameProt(159, 2);
    static readonly IF_OPENSIDE = new ServerGameProt(246, 2);
    static readonly IF_OPENOVERLAY = new ServerGameProt(50, 2);
    static readonly IF_OPENFULL = new ServerGameProt(253, 4);

    // updating interfaces
    static readonly IF_SETANGLE = new ServerGameProt(186, 8);
    static readonly IF_SETCOLOUR = new ServerGameProt(218, 4);
    static readonly IF_SETHIDE = new ServerGameProt(82, 3);
    static readonly IF_SETOBJECT = new ServerGameProt(21, 6);
    static readonly IF_SETMODEL = new ServerGameProt(216, 4);
    static readonly IF_SETROTATION = new ServerGameProt(18, 6);
    static readonly IF_SETANIM = new ServerGameProt(2, 4);
    static readonly IF_SETPLAYERHEAD = new ServerGameProt(255, 2);
    static readonly IF_SETTEXT = new ServerGameProt(232, -2);
    static readonly IF_SETNPCHEAD = new ServerGameProt(162, 4);
    static readonly IF_SETPOSITION = new ServerGameProt(166, 6);
    static readonly IF_SETSCROLLPOS = new ServerGameProt(200, 4);

    // tutorial area
    static readonly TUT_FLASH = new ServerGameProt(238, 1);
    static readonly TUT_OPEN = new ServerGameProt(158, 2);

    // inventory
    static readonly UPDATE_INV_STOP_TRANSMIT = new ServerGameProt(219, 2);
    static readonly UPDATE_INV_FULL = new ServerGameProt(206, -2);
    static readonly UPDATE_INV_PARTIAL = new ServerGameProt(134, -2);

    // camera control
    static readonly CAM_LOOKAT = new ServerGameProt(167, 6);
    static readonly CAM_SHAKE = new ServerGameProt(67, 4);
    static readonly CAM_MOVETO = new ServerGameProt(3, 6);
    static readonly CAM_RESET = new ServerGameProt(148, 0);

    // entity updates
    static readonly NPC_INFO = new ServerGameProt(71, -2);
    static readonly PLAYER_INFO = new ServerGameProt(90, -2);

    // social
    static readonly FRIENDLIST_LOADED = new ServerGameProt(251, 1);
    static readonly MESSAGE_GAME = new ServerGameProt(63, -1);
    static readonly UPDATE_IGNORELIST = new ServerGameProt(226, -2);
    static readonly CHAT_FILTER_SETTINGS = new ServerGameProt(201, 3);
    static readonly MESSAGE_PRIVATE = new ServerGameProt(135, -1);
    static readonly UPDATE_FRIENDLIST = new ServerGameProt(78, 9);

    // misc
    static readonly UNSET_MAP_FLAG = new ServerGameProt(61, 0);
    static readonly UPDATE_RUNWEIGHT = new ServerGameProt(174, 2);
    static readonly HINT_ARROW = new ServerGameProt(199, 6);
    static readonly UPDATE_REBOOT_TIMER = new ServerGameProt(190, 2);
    static readonly UPDATE_STAT = new ServerGameProt(49, 6);
    static readonly UPDATE_RUNENERGY = new ServerGameProt(125, 1);
    static readonly RESET_ANIMS = new ServerGameProt(13, 0);
    static readonly UPDATE_PID = new ServerGameProt(126, 3);
    static readonly LAST_LOGIN_INFO = new ServerGameProt(76, 23);
    static readonly LOGOUT = new ServerGameProt(5, 0);
    static readonly P_COUNTDIALOG = new ServerGameProt(58, 0);
    static readonly SET_MULTIWAY = new ServerGameProt(233, 1);
    static readonly SET_PLAYER_OP = new ServerGameProt(157, -1);
    static readonly P_NAMEDIALOG = new ServerGameProt(6, 0);
    static readonly MINIMAP_TOGGLE = new ServerGameProt(156, 1);

    // maps
    static readonly REBUILD_NORMAL = new ServerGameProt(222, 4);
    static readonly REBUILD_REGION = new ServerGameProt(53, -2);

    // vars
    static readonly VARP_SMALL = new ServerGameProt(182, 3);
    static readonly VARP_LARGE = new ServerGameProt(115, 6);
    static readonly RESET_CLIENT_VARCACHE = new ServerGameProt(113, 0);

    // audio
    static readonly SYNTH_SOUND = new ServerGameProt(26, 5);
    static readonly MIDI_SONG = new ServerGameProt(220, 2);
    static readonly MIDI_JINGLE = new ServerGameProt(249, 5);

    // zones
    static readonly UPDATE_ZONE_PARTIAL_FOLLOWS = new ServerGameProt(75, 2);
    static readonly UPDATE_ZONE_FULL_FOLLOWS = new ServerGameProt(40, 2);
    static readonly UPDATE_ZONE_PARTIAL_ENCLOSED = new ServerGameProt(183, -2);

    constructor(
        readonly id: number,
        readonly length: number
    ) {}
}
