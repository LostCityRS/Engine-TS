export default class ClientGameProt {
    static byId: ClientGameProt[] = [];

    static readonly NO_TIMEOUT = new ClientGameProt(93, 0); // NXT naming

    static readonly IDLE_TIMER = new ClientGameProt(245, 0);
    static readonly EVENT_MOUSE_CLICK = new ClientGameProt(75, 4); // NXT naming
    static readonly EVENT_MOUSE_MOVE = new ClientGameProt(123, -1); // NXT naming
    static readonly EVENT_APPLET_FOCUS = new ClientGameProt(22, 1); // NXT naming
    static readonly EVENT_CAMERA_POSITION = new ClientGameProt(21, 4); // NXT naming
    static readonly EVENT_HAS_WINDOW = new ClientGameProt(9007, 4);
    static readonly EVENT_SYNTH_ERROR = new ClientGameProt(9008, 2);

    static readonly OPOBJ1 = new ClientGameProt(9020, 6); // NXT naming
    static readonly OPOBJ2 = new ClientGameProt(9021, 6); // NXT naming
    static readonly OPOBJ3 = new ClientGameProt(9022, 6); // NXT naming
    static readonly OPOBJ4 = new ClientGameProt(9023, 6); // NXT naming
    static readonly OPOBJ5 = new ClientGameProt(9024, 6); // NXT naming
    static readonly OPOBJT = new ClientGameProt(9025, 8); // NXT naming
    static readonly OPOBJU = new ClientGameProt(9026, 12); // NXT naming

    static readonly OPNPC1 = new ClientGameProt(9027, 2); // NXT naming
    static readonly OPNPC2 = new ClientGameProt(9028, 2); // NXT naming
    static readonly OPNPC3 = new ClientGameProt(9029, 2); // NXT naming
    static readonly OPNPC4 = new ClientGameProt(9030, 2); // NXT naming
    static readonly OPNPC5 = new ClientGameProt(9031, 2); // NXT naming
    static readonly OPNPCT = new ClientGameProt(9032, 4); // NXT naming
    static readonly OPNPCU = new ClientGameProt(9033, 8); // NXT naming

    static readonly OPLOC1 = new ClientGameProt(254, 6); // NXT naming
    static readonly OPLOC2 = new ClientGameProt(194, 6); // NXT naming
    static readonly OPLOC3 = new ClientGameProt(84, 6); // NXT naming
    static readonly OPLOC4 = new ClientGameProt(247, 6); // NXT naming
    static readonly OPLOC5 = new ClientGameProt(170, 6); // NXT naming
    static readonly OPLOC6 = new ClientGameProt(94, 2); // NXT naming
    static readonly OPLOCT = new ClientGameProt(9039, 8); // NXT naming
    static readonly OPLOCU = new ClientGameProt(9040, 12); // NXT naming

    static readonly OPPLAYER1 = new ClientGameProt(9041, 2); // NXT naming
    static readonly OPPLAYER2 = new ClientGameProt(9042, 2); // NXT naming
    static readonly OPPLAYER3 = new ClientGameProt(9043, 2); // NXT naming
    static readonly OPPLAYER4 = new ClientGameProt(9044, 2); // NXT naming
    static readonly OPPLAYER5 = new ClientGameProt(9045, 2); // NXT naming
    static readonly OPPLAYERT = new ClientGameProt(9046, 4); // NXT naming
    static readonly OPPLAYERU = new ClientGameProt(9047, 8); // NXT naming

    static readonly OPHELD1 = new ClientGameProt(9048, 6); // name based on runescript trigger
    static readonly OPHELD2 = new ClientGameProt(9049, 6); // name based on runescript trigger
    static readonly OPHELD3 = new ClientGameProt(9050, 6); // name based on runescript trigger
    static readonly OPHELD4 = new ClientGameProt(9051, 6); // name based on runescript trigger
    static readonly OPHELD5 = new ClientGameProt(9052, 6); // name based on runescript trigger
    static readonly OPHELDT = new ClientGameProt(9053, 8); // name based on runescript trigger
    static readonly OPHELDU = new ClientGameProt(9054, 12); // name based on runescript trigger

    static readonly IF_BUTTON1 = new ClientGameProt(155, 6); // NXT naming
    static readonly IF_BUTTON2 = new ClientGameProt(196, 6); // NXT naming
    static readonly IF_BUTTON3 = new ClientGameProt(124, 6); // NXT naming
    static readonly IF_BUTTON4 = new ClientGameProt(199, 6); // NXT naming
    static readonly IF_BUTTON5 = new ClientGameProt(234, 6); // NXT naming
    static readonly IF_BUTTON6 = new ClientGameProt(168, 6); // NXT naming
    static readonly IF_BUTTON7 = new ClientGameProt(166, 6); // NXT naming
    static readonly IF_BUTTON8 = new ClientGameProt(64, 6); // NXT naming
    static readonly IF_BUTTON9 = new ClientGameProt(53, 6); // NXT naming
    static readonly IF_BUTTON10 = new ClientGameProt(9, 6); // NXT naming

    static readonly IF_BUTTON = new ClientGameProt(79, 12); // NXT naming
    static readonly RESUME_PAUSEBUTTON = new ClientGameProt(9061, 2); // NXT naming
    static readonly CLOSE_MODAL = new ClientGameProt(184, 0); // NXT naming
    static readonly RESUME_P_COUNTDIALOG = new ClientGameProt(9063, 4); // NXT naming
    static readonly TUTORIAL_CLICKSIDE = new ClientGameProt(9064, 1); // no original name
    static readonly RESUME_P_NAMEDIALOG = new ClientGameProt(9065, 8); // NXT naming

    static readonly MAP_BUILD_COMPLETE = new ClientGameProt(110, 0); // NXT naming
    static readonly MOVE_OPCLICK = new ClientGameProt(77, -1); // (comes with OP packets, name based on other MOVE packets) // MOVE_SCRIPTED by 530?
    static readonly REPORT_ABUSE = new ClientGameProt(99, 10); // NXT calls it 'BUG_REPORT' - unsure when it was named as such, might be more appropriate here.
    static readonly MOVE_MINIMAPCLICK = new ClientGameProt(39, -1); // NXT naming
    static readonly IF_BUTTOND = new ClientGameProt(9070, 7); // NXT naming
    static readonly IGNORELIST_DEL = new ClientGameProt(213, 8); // NXT naming
    static readonly IGNORELIST_ADD = new ClientGameProt(34, 8); // NXT naming
    static readonly IF_PLAYERDESIGN = new ClientGameProt(9073, 13);
    static readonly CHAT_SETMODE = new ClientGameProt(9074, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ClientGameProt(201, -1); // NXT naming
    static readonly FRIENDLIST_DEL = new ClientGameProt(57, 8); // NXT naming
    static readonly FRIENDLIST_ADD = new ClientGameProt(120, 8); // NXT naming
    static readonly CLIENT_CHEAT = new ClientGameProt(44, -1); // NXT naming
    static readonly MESSAGE_PUBLIC = new ClientGameProt(237, -1); // NXT naming
    static readonly MOVE_GAMECLICK = new ClientGameProt(215, -1); // NXT naming

    static readonly CLAN_JOINCHAT_LEAVECHAT = new ClientGameProt(104, 8); // NXT naming
    static readonly CLAN_KICKUSER = new ClientGameProt(162, 8); // NXT naming
    static readonly FRIEND_SETRANK = new ClientGameProt(188, 9); // NXT naming

    static readonly WINDOW_STATUS = new ClientGameProt(243, 6); // NXT naming
    static readonly DETECT_MODIFIED_CLIENT = new ClientGameProt(20, 4); // NXT naming
    static readonly TRANSMITVAR_VERIFYID = new ClientGameProt(177, 2); // NXT naming
    static readonly SOUND_SONGEND = new ClientGameProt(137, 4); // NXT naming

    constructor(
        readonly id: number,
        readonly length: number
    ) {
        ClientGameProt.byId[id] = this;
    }
}
