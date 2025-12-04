export default class ClientGameProt {
    static all: ClientGameProt[] = [];
    static byId: ClientGameProt[] = [];

    static readonly NO_TIMEOUT = new ClientGameProt(6, 40, 0); // NXT naming

    static readonly IDLE_TIMER = new ClientGameProt(30, 202, 0);
    static readonly EVENT_MOUSE_CLICK = new ClientGameProt(31, 19, 4); // NXT naming
    static readonly EVENT_MOUSE_MOVE = new ClientGameProt(32, 171, -1); // NXT naming
    static readonly EVENT_APPLET_FOCUS = new ClientGameProt(33, 187, 1); // NXT naming
    static readonly EVENT_CAMERA_POSITION = new ClientGameProt(35, 140, 4); // NXT naming
    static readonly EVENT_HAS_WINDOW = new ClientGameProt(36, 78, 4);
    static readonly EVENT_SYNTH_ERROR = new ClientGameProt(37, 80, 2);

    static readonly ANTICHEAT_OPLOGIC1 = new ClientGameProt(60, 95, 4);
    static readonly ANTICHEAT_OPLOGIC2 = new ClientGameProt(61, 165, 1);
    static readonly ANTICHEAT_OPLOGIC3 = new ClientGameProt(62, 157, 4);
    static readonly ANTICHEAT_OPLOGIC4 = new ClientGameProt(63, 222, 3);
    static readonly ANTICHEAT_OPLOGIC5 = new ClientGameProt(64, 126, 1);

    static readonly ANTICHEAT_CYCLELOGIC1 = new ClientGameProt(70, 244, -1);
    static readonly ANTICHEAT_CYCLELOGIC2 = new ClientGameProt(71, 168, 0);
    static readonly ANTICHEAT_CYCLELOGIC3 = new ClientGameProt(72, 197, 4);
    static readonly ANTICHEAT_CYCLELOGIC4 = new ClientGameProt(73, 173, 3);
    static readonly ANTICHEAT_CYCLELOGIC5 = new ClientGameProt(74, 248, 0);
    static readonly ANTICHEAT_CYCLELOGIC6 = new ClientGameProt(75, 22, 2);

    static readonly OPOBJ1 = new ClientGameProt(80, 77, 6); // NXT naming
    static readonly OPOBJ2 = new ClientGameProt(81, 100, 6); // NXT naming
    static readonly OPOBJ3 = new ClientGameProt(82, 71, 6); // NXT naming
    static readonly OPOBJ4 = new ClientGameProt(83, 54, 6); // NXT naming
    static readonly OPOBJ5 = new ClientGameProt(84, 230, 6); // NXT naming
    static readonly OPOBJT = new ClientGameProt(88, 83, 8); // NXT naming
    static readonly OPOBJU = new ClientGameProt(89, 211, 12); // NXT naming

    static readonly OPNPC1 = new ClientGameProt(100, 112, 2); // NXT naming
    static readonly OPNPC2 = new ClientGameProt(101, 67, 2); // NXT naming
    static readonly OPNPC3 = new ClientGameProt(102, 13, 2); // NXT naming
    static readonly OPNPC4 = new ClientGameProt(103, 42, 2); // NXT naming
    static readonly OPNPC5 = new ClientGameProt(104, 8, 2); // NXT naming
    static readonly OPNPCT = new ClientGameProt(108, 104, 4); // NXT naming
    static readonly OPNPCU = new ClientGameProt(109, 57, 8); // NXT naming

    static readonly OPLOC1 = new ClientGameProt(120, 181, 6); // NXT naming
    static readonly OPLOC2 = new ClientGameProt(121, 241, 6); // NXT naming
    static readonly OPLOC3 = new ClientGameProt(122, 50, 6); // NXT naming
    static readonly OPLOC4 = new ClientGameProt(123, 136, 6); // NXT naming
    static readonly OPLOC5 = new ClientGameProt(124, 55, 6); // NXT naming
    static readonly OPLOCT = new ClientGameProt(128, 210, 8); // NXT naming
    static readonly OPLOCU = new ClientGameProt(129, 152, 12); // NXT naming

    static readonly OPPLAYER1 = new ClientGameProt(140, 245, 2); // NXT naming
    static readonly OPPLAYER2 = new ClientGameProt(141, 233, 2); // NXT naming
    static readonly OPPLAYER3 = new ClientGameProt(142, 194, 2); // NXT naming
    static readonly OPPLAYER4 = new ClientGameProt(143, 116, 2); // NXT naming
    static readonly OPPLAYER5 = new ClientGameProt(144, 45, 2); // NXT naming
    static readonly OPPLAYERT = new ClientGameProt(148, 31, 4); // NXT naming
    static readonly OPPLAYERU = new ClientGameProt(149, 143, 8); // NXT naming

    static readonly OPHELD1 = new ClientGameProt(160, 203, 6); // name based on runescript trigger
    static readonly OPHELD2 = new ClientGameProt(161, 24, 6); // name based on runescript trigger
    static readonly OPHELD3 = new ClientGameProt(162, 161, 6); // name based on runescript trigger
    static readonly OPHELD4 = new ClientGameProt(163, 228, 6); // name based on runescript trigger
    static readonly OPHELD5 = new ClientGameProt(164, 4, 6); // name based on runescript trigger
    static readonly OPHELDT = new ClientGameProt(168, 36, 8); // name based on runescript trigger
    static readonly OPHELDU = new ClientGameProt(169, 1, 12); // name based on runescript trigger

    static readonly INV_BUTTON1 = new ClientGameProt(190, 3, 6); // NXT has "IF_BUTTON1" but for our interface system, this makes more sense
    static readonly INV_BUTTON2 = new ClientGameProt(191, 177, 6); // NXT has "IF_BUTTON2" but for our interface system, this makes more sense
    static readonly INV_BUTTON3 = new ClientGameProt(192, 91, 6); // NXT has "IF_BUTTON3" but for our interface system, this makes more sense
    static readonly INV_BUTTON4 = new ClientGameProt(193, 231, 6); // NXT has "IF_BUTTON4" but for our interface system, this makes more sense
    static readonly INV_BUTTON5 = new ClientGameProt(194, 158, 6); // NXT has "IF_BUTTON5" but for our interface system, this makes more sense

    static readonly IF_BUTTON = new ClientGameProt(200, 79, 2); // NXT naming
    static readonly RESUME_PAUSEBUTTON = new ClientGameProt(201, 226, 2); // NXT naming
    static readonly CLOSE_MODAL = new ClientGameProt(202, 110, 0); // NXT naming
    static readonly RESUME_P_COUNTDIALOG = new ClientGameProt(203, 75, 4); // NXT naming
    static readonly TUTORIAL_CLICKSIDE = new ClientGameProt(204, 119, 1); // no original name
    static readonly RESUME_P_NAMEDIALOG = new ClientGameProt(205, 206, 8); // NXT naming

    static readonly MAP_BUILD_COMPLETE = new ClientGameProt(241, 6, 0); // NXT naming
    static readonly MOVE_OPCLICK = new ClientGameProt(242, 247, -1); // (comes with OP packets, name based on other MOVE packets)
    static readonly REPORT_ABUSE = new ClientGameProt(243, 184, 10);
    static readonly MOVE_MINIMAPCLICK = new ClientGameProt(244, 213, -1); // NXT naming
    static readonly INV_BUTTOND = new ClientGameProt(245, 123, 7); // NXT has "IF_BUTTOND" but for our interface system, this makes more sense
    static readonly IGNORELIST_DEL = new ClientGameProt(246, 160, 8); // NXT naming
    static readonly IGNORELIST_ADD = new ClientGameProt(247, 217, 8); // NXT naming
    static readonly IF_PLAYERDESIGN = new ClientGameProt(248, 163, 13);
    static readonly CHAT_SETMODE = new ClientGameProt(249, 176, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ClientGameProt(250, 227, -1); // NXT naming
    static readonly FRIENDLIST_DEL = new ClientGameProt(251, 141, 8); // NXT naming
    static readonly FRIENDLIST_ADD = new ClientGameProt(252, 120, 8); // NXT naming
    static readonly CLIENT_CHEAT = new ClientGameProt(253, 56, -1); // NXT naming
    static readonly MESSAGE_PUBLIC = new ClientGameProt(254, 49, -1); // NXT naming
    static readonly MOVE_GAMECLICK = new ClientGameProt(255, 28, -1); // NXT naming

    // in these old revisions we can actually get the packet index from a leftover array in the client source
    constructor(
        readonly index: number,
        readonly id: number,
        readonly length: number
    ) {
        ClientGameProt.all[index] = this;
        ClientGameProt.byId[id] = this;
    }
}
