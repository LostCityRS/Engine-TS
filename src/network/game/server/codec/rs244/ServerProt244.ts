import ServerProtBase from '#/network/game/server/codec/ServerProtBase.js';

export default class ServerProt244 extends ServerProtBase {
    // interfaces
    static readonly IF_OPENCHAT = new ServerProt244(109, 2);
    static readonly IF_OPENMAIN_SIDE = new ServerProt244(128, 4);
    static readonly IF_CLOSE = new ServerProt244(29, 0);
    static readonly IF_SETTAB = new ServerProt244(10, 3);
    static readonly IF_SETTAB_ACTIVE = new ServerProt244(252, 1);
    static readonly IF_OPENMAIN = new ServerProt244(159, 2);
    static readonly IF_OPENSIDE = new ServerProt244(246, 2);
    static readonly IF_OPENOVERLAY = new ServerProt244(50, 2);
    static readonly IF_OPENFULL = new ServerProt244(253, 4);

    // updating interfaces
    static readonly IF_SETANGLE = new ServerProt244(186, 8); // todo: Real name? 
    static readonly IF_SETCOLOUR = new ServerProt244(218, 4); // NXT naming
    static readonly IF_SETHIDE = new ServerProt244(82, 3); // NXT naming
    static readonly IF_SETOBJECT = new ServerProt244(21, 6); // NXT naming
    static readonly IF_SETMODEL = new ServerProt244(216, 4); // NXT naming
    static readonly IF_SETROTATION = new ServerProt244(18, 6); // todo: Real name?    
    static readonly IF_SETRECOL = new ServerProt244(103, 6); // NXT naming
    static readonly IF_SETANIM = new ServerProt244(2, 4); // NXT naming
    static readonly IF_SETPLAYERHEAD = new ServerProt244(255, 2); // NXT naming
    static readonly IF_SETTEXT = new ServerProt244(232, -2); // NXT naming
    static readonly IF_SETNPCHEAD = new ServerProt244(162, 4); // NXT naming
    static readonly IF_SETPOSITION = new ServerProt244(166, 6); // NXT naming
    static readonly IF_SETSCROLLPOS = new ServerProt244(200, 4); // NXT naming

    // tutorial area
    static readonly TUT_FLASH = new ServerProt244(238, 1);
    static readonly TUT_OPEN = new ServerProt244(158, 2);

    // inventory
    static readonly UPDATE_INV_STOP_TRANSMIT = new ServerProt244(219, 2); // NXT naming
    static readonly UPDATE_INV_FULL = new ServerProt244(206, -2); // NXT naming
    static readonly UPDATE_INV_PARTIAL = new ServerProt244(134, -2); // NXT naming

    // camera control
    static readonly CAM_LOOKAT = new ServerProt244(167, 6); // NXT naming
    static readonly CAM_SHAKE = new ServerProt244(67, 4); // NXT naming
    static readonly CAM_MOVETO = new ServerProt244(3, 6); // NXT naming
    static readonly CAM_RESET = new ServerProt244(148, 0); // NXT naming

    // entity updates
    static readonly NPC_INFO = new ServerProt244(71, -2); // NXT naming
    static readonly PLAYER_INFO = new ServerProt244(90, -2); // NXT naming

    // social
    static readonly FRIENDLIST_LOADED = new ServerProt244(251, 1); // NXT naming
    static readonly MESSAGE_GAME = new ServerProt244(63, -1); // NXT naming
    static readonly UPDATE_IGNORELIST = new ServerProt244(226, -2); // NXT naming
    static readonly CHAT_FILTER_SETTINGS = new ServerProt244(201, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ServerProt244(135, -1); // NXT naming
    static readonly UPDATE_FRIENDLIST = new ServerProt244(78, 9); // NXT naming

    // misc
    static readonly UNSET_MAP_FLAG = new ServerProt244(61, 0); // NXT has "SET_MAP_FLAG" but we cannot control the position
    static readonly UPDATE_RUNWEIGHT = new ServerProt244(174, 2); // NXT naming
    static readonly HINT_ARROW = new ServerProt244(199, 6); // NXT naming
    static readonly UPDATE_REBOOT_TIMER = new ServerProt244(190, 2); // NXT naming
    static readonly UPDATE_STAT = new ServerProt244(49, 6); // NXT naming
    static readonly UPDATE_RUNENERGY = new ServerProt244(125, 1); // NXT naming
    static readonly RESET_ANIMS = new ServerProt244(13, 0); // NXT naming
    static readonly UPDATE_PID = new ServerProt244(126, 3);
    static readonly LAST_LOGIN_INFO = new ServerProt244(76, 23); // NXT naming
    static readonly LOGOUT = new ServerProt244(5, 0); // NXT naming
    static readonly P_COUNTDIALOG = new ServerProt244(58, 0); // named after runescript command + client resume_p_countdialog packet
    static readonly SET_MULTIWAY = new ServerProt244(233, 1);
    static readonly P_NAMEDIALOG = new ServerProt244(6, 0);
    static readonly SET_PLAYER_OP = new ServerProt244(157, -1);
    static readonly MINIMAP_TOGGLE = new ServerProt244(156, 1);

    // maps
    static readonly REBUILD_NORMAL = new ServerProt244(222, 4); // NXT naming
    static readonly REBUILD_REGION = new ServerProt244(53, -1); // NXT naming

    // vars
    static readonly VARP_SMALL = new ServerProt244(182, 3); // NXT naming
    static readonly VARP_LARGE = new ServerProt244(115, 6); // NXT naming
    static readonly RESET_CLIENT_VARCACHE = new ServerProt244(113, 0); // NXT naming

    // audio
    static readonly SYNTH_SOUND = new ServerProt244(26, 5); // NXT naming
    static readonly MIDI_SONG = new ServerProt244(220, 2); // NXT naming
    static readonly MIDI_JINGLE = new ServerProt244(249, 5); // NXT naming

    // zones
    static readonly UPDATE_ZONE_PARTIAL_FOLLOWS = new ServerProt244(75, 2); // NXT naming
    static readonly UPDATE_ZONE_FULL_FOLLOWS = new ServerProt244(40, 2); // NXT naming
    static readonly UPDATE_ZONE_PARTIAL_ENCLOSED = new ServerProt244(183, -2); // NXT naming
}
