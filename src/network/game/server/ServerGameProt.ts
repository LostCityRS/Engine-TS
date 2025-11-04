export default class ServerGameProt {
    // interfaces
    static readonly IF_OPENTOP = new ServerGameProt(145, 4);
    static readonly IF_OPENSUB = new ServerGameProt(155, 9);

    // updating interfaces
    static readonly IF_SETANGLE = new ServerGameProt(132, 8); // todo: Real name? 
    static readonly IF_SETCOLOUR = new ServerGameProt(2, 4); // NXT naming
    static readonly IF_SETHIDE = new ServerGameProt(21, 3); // NXT naming
    static readonly IF_SETOBJECT = new ServerGameProt(50, 6); // NXT naming
    static readonly IF_SETMODEL = new ServerGameProt(130, 4); // NXT naming
    static readonly IF_SETROTATION = new ServerGameProt(207, 6); // todo: Real name?    
    static readonly IF_SETANIM = new ServerGameProt(36, 4); // NXT naming
    static readonly IF_SETPLAYERHEAD = new ServerGameProt(66, 2); // NXT naming
    static readonly IF_SETTEXT = new ServerGameProt(171, -2); // NXT naming
    static readonly IF_SETNPCHEAD = new ServerGameProt(73, 4); // NXT naming
    static readonly IF_SETPOSITION = new ServerGameProt(119, 6); // NXT naming
    static readonly IF_SETSCROLLPOS = new ServerGameProt(220, 4); // NXT naming

    // tutorial area
    static readonly TUT_FLASH = new ServerGameProt(9005, 1);
    static readonly TUT_OPEN = new ServerGameProt(9006, 2);

    // inventory
    static readonly UPDATE_INV_STOP_TRANSMIT = new ServerGameProt(144, 2); // NXT naming
    static readonly UPDATE_INV_FULL = new ServerGameProt(105, -2); // NXT naming
    static readonly UPDATE_INV_PARTIAL = new ServerGameProt(22, -2); // NXT naming

    // camera control
    static readonly CAM_LOOKAT = new ServerGameProt(125, 6); // NXT naming
    static readonly CAM_SHAKE = new ServerGameProt(27, 4); // NXT naming
    static readonly CAM_MOVETO = new ServerGameProt(154, 6); // NXT naming
    static readonly CAM_RESET = new ServerGameProt(24, 0); // NXT naming

    // entity updates
    static readonly NPC_INFO = new ServerGameProt(32, -2); // NXT naming
    static readonly PLAYER_INFO = new ServerGameProt(225, -2); // NXT naming

    // social
    static readonly FRIENDLIST_LOADED = new ServerGameProt(197, 1); // NXT naming
    static readonly MESSAGE_GAME = new ServerGameProt(70, -1); // NXT naming
    static readonly UPDATE_IGNORELIST = new ServerGameProt(126, -2); // NXT naming
    static readonly CHAT_FILTER_SETTINGS = new ServerGameProt(232, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ServerGameProt(0, -1); // NXT naming
    static readonly UPDATE_FRIENDLIST = new ServerGameProt(62, -1); // NXT naming

    // misc
    static readonly UNSET_MAP_FLAG = new ServerGameProt(61, 0); // NXT has "SET_MAP_FLAG" but we cannot control the position
    static readonly UPDATE_RUNWEIGHT = new ServerGameProt(159, 2); // NXT naming
    static readonly HINT_ARROW = new ServerGameProt(217, 6); // NXT naming
    static readonly UPDATE_REBOOT_TIMER = new ServerGameProt(85, 2); // NXT naming
    static readonly UPDATE_STAT = new ServerGameProt(38, 6); // NXT naming
    static readonly UPDATE_RUNENERGY = new ServerGameProt(234, 1); // NXT naming
    static readonly RESET_ANIMS = new ServerGameProt(131, 0); // NXT naming
    static readonly UPDATE_PID = new ServerGameProt(169, 3);
    static readonly LAST_LOGIN_INFO = new ServerGameProt(164, 4); // NXT naming
    static readonly LOGOUT = new ServerGameProt(86, 0); // NXT naming
    static readonly P_COUNTDIALOG = new ServerGameProt(58, 0); // named after runescript command + client resume_p_countdialog packet
    static readonly SET_MULTIWAY = new ServerGameProt(9000, 1);
    static readonly P_NAMEDIALOG = new ServerGameProt(9001, 0);
    static readonly SET_PLAYER_OP = new ServerGameProt(44, -1);
    static readonly MINIMAP_TOGGLE = new ServerGameProt(192, 1);

    // maps
    static readonly REBUILD_NORMAL = new ServerGameProt(162, -2); // NXT naming
    static readonly REBUILD_REGION = new ServerGameProt(214, -2); // NXT naming

    // vars
    static readonly VARP_SMALL = new ServerGameProt(60, 3); // NXT naming
    static readonly VARP_LARGE = new ServerGameProt(226, 6); // NXT naming
    static readonly RESET_CLIENT_VARCACHE = new ServerGameProt(89, 0); // NXT naming

    // audio
    static readonly SYNTH_SOUND = new ServerGameProt(172, 5); // NXT naming
    static readonly MIDI_SONG = new ServerGameProt(4, 2); // NXT naming
    static readonly MIDI_JINGLE = new ServerGameProt(208, 5); // NXT naming

    // zones
    static readonly UPDATE_ZONE_PARTIAL_FOLLOWS = new ServerGameProt(112, 2); // NXT naming
    static readonly UPDATE_ZONE_FULL_FOLLOWS = new ServerGameProt(26, 2); // NXT naming
    static readonly UPDATE_ZONE_PARTIAL_ENCLOSED = new ServerGameProt(230, -2); // NXT naming

    constructor(
        readonly id: number,
        readonly length: number
    ) {}
}

// const lengths = [-1, 0, 8, 0, 2, 0, 0, 0, 0, 12, 0, 1, 0, 3, 7, 0, 15, 6, 0, 0, 4, 7, -2, -1, 2, 0, 2, 8, 0, 0, 0, 0, -2, 5, 0, 0, 8, 3, 6, 0, 0, 0, -1, 0, -1, 0, 0, 6, -2, 0, 12, 0, 0, 0, -1, -2, 10, 0, 0, 0, 3, 0, -1, 0, 0, 5, 6, 0, 0, 8, -1, -1, 0, 8, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 6, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 5, 0, 0, -2, 0, 0, 0, 0, 0, 12, 2, 0, -2, -2, 20, 0, 0, 10, 0, 15, 0, -1, 0, 8, -2, 0, 0, 0, 8, 0, 12, 0, 0, 7, 0, 0, 0, 0, 0, -1, -1, 0, 4, 5, 0, 0, 0, 6, 0, 0, 0, 0, 8, 9, 0, 0, 0, 2, -1, 0, -2, 0, 4, 14, 0, 0, 0, 24, 0, -2, 5, 0, 0, 0, 10, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 2, 1, 0, 0, 2, -1, 1, 0, 0, 0, 0, 14, 0, 0, 0, 0, 10, 5, 0, 0, 0, 0, 0, -2, 0, 0, 9, 0, 0, 8, 0, 0, 0, 0, -2, 6, 0, 0, 0, -2, 0, 3, 0, 1, 7, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 3, 0, 0];
