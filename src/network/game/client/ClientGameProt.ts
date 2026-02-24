export default class ClientGameProt {
    static byId: ClientGameProt[] = [];

    static readonly NO_TIMEOUT = new ClientGameProt(40, 0);

    static readonly IDLE_TIMER = new ClientGameProt(202, 0);
    static readonly EVENT_MOUSE_CLICK = new ClientGameProt(19, 4);
    static readonly EVENT_MOUSE_MOVE = new ClientGameProt(171, -1);
    static readonly EVENT_APPLET_FOCUS = new ClientGameProt(187, 1);
    static readonly EVENT_CAMERA_POSITION = new ClientGameProt(140, 4);
    static readonly EVENT_HAS_WINDOW = new ClientGameProt(78, 4);
    static readonly EVENT_SYNTH_ERROR = new ClientGameProt(80, 2);

    static readonly ANTICHEAT_OPLOGIC1 = new ClientGameProt(95, 4);
    static readonly ANTICHEAT_OPLOGIC2 = new ClientGameProt(165, 1);
    static readonly ANTICHEAT_OPLOGIC3 = new ClientGameProt(157, 4);
    static readonly ANTICHEAT_OPLOGIC4 = new ClientGameProt(222, 3);
    static readonly ANTICHEAT_OPLOGIC5 = new ClientGameProt(126, 1);

    static readonly ANTICHEAT_CYCLELOGIC1 = new ClientGameProt(244, -1);
    static readonly ANTICHEAT_CYCLELOGIC2 = new ClientGameProt(168, 0);
    static readonly ANTICHEAT_CYCLELOGIC3 = new ClientGameProt(197, 4);
    static readonly ANTICHEAT_CYCLELOGIC4 = new ClientGameProt(173, 3);
    static readonly ANTICHEAT_CYCLELOGIC5 = new ClientGameProt(248, 0);
    static readonly ANTICHEAT_CYCLELOGIC6 = new ClientGameProt(22, 2);

    static readonly OPOBJ1 = new ClientGameProt(77, 6);
    static readonly OPOBJ2 = new ClientGameProt(100, 6);
    static readonly OPOBJ3 = new ClientGameProt(71, 6);
    static readonly OPOBJ4 = new ClientGameProt(54, 6);
    static readonly OPOBJ5 = new ClientGameProt(230, 6);
    static readonly OPOBJT = new ClientGameProt(83, 8);
    static readonly OPOBJU = new ClientGameProt(211, 12);

    static readonly OPNPC1 = new ClientGameProt(112, 2);
    static readonly OPNPC2 = new ClientGameProt(67, 2);
    static readonly OPNPC3 = new ClientGameProt(13, 2);
    static readonly OPNPC4 = new ClientGameProt(42, 2);
    static readonly OPNPC5 = new ClientGameProt(8, 2);
    static readonly OPNPCT = new ClientGameProt(104, 4);
    static readonly OPNPCU = new ClientGameProt(57, 8);

    static readonly OPLOC1 = new ClientGameProt(181, 6);
    static readonly OPLOC2 = new ClientGameProt(241, 6);
    static readonly OPLOC3 = new ClientGameProt(50, 6);
    static readonly OPLOC4 = new ClientGameProt(136, 6);
    static readonly OPLOC5 = new ClientGameProt(55, 6);
    static readonly OPLOCT = new ClientGameProt(210, 8);
    static readonly OPLOCU = new ClientGameProt(152, 12);

    static readonly OPPLAYER1 = new ClientGameProt(245, 2);
    static readonly OPPLAYER2 = new ClientGameProt(233, 2);
    static readonly OPPLAYER3 = new ClientGameProt(194, 2);
    static readonly OPPLAYER4 = new ClientGameProt(116, 2);
    static readonly OPPLAYER5 = new ClientGameProt(45, 2);
    static readonly OPPLAYERT = new ClientGameProt(31, 4);
    static readonly OPPLAYERU = new ClientGameProt(143, 8);

    static readonly OPHELD1 = new ClientGameProt(203, 6);
    static readonly OPHELD2 = new ClientGameProt(24, 6);
    static readonly OPHELD3 = new ClientGameProt(161, 6);
    static readonly OPHELD4 = new ClientGameProt(228, 6);
    static readonly OPHELD5 = new ClientGameProt(4, 6);
    static readonly OPHELDT = new ClientGameProt(36, 8);
    static readonly OPHELDU = new ClientGameProt(1, 12);

    static readonly INV_BUTTON1 = new ClientGameProt(3, 6);
    static readonly INV_BUTTON2 = new ClientGameProt(177, 6);
    static readonly INV_BUTTON3 = new ClientGameProt(91, 6);
    static readonly INV_BUTTON4 = new ClientGameProt(231, 6);
    static readonly INV_BUTTON5 = new ClientGameProt(158, 6);

    static readonly IF_BUTTON = new ClientGameProt(79, 2);
    static readonly RESUME_PAUSEBUTTON = new ClientGameProt(226, 2);
    static readonly CLOSE_MODAL = new ClientGameProt(110, 0);
    static readonly RESUME_P_COUNTDIALOG = new ClientGameProt(75, 4);
    static readonly TUT_CLICKSIDE = new ClientGameProt(119, 1);
    static readonly RESUME_P_NAMEDIALOG = new ClientGameProt(206, 8);

    static readonly MAP_BUILD_COMPLETE = new ClientGameProt(6, 0);
    static readonly MOVE_OPCLICK = new ClientGameProt(247, -1);
    static readonly REPORT_ABUSE = new ClientGameProt(184, 10); // todo: rename to SEND_SNAPSHOT
    static readonly MOVE_MINIMAPCLICK = new ClientGameProt(213, -1);
    static readonly INV_BUTTOND = new ClientGameProt(123, 7);
    static readonly IGNORELIST_DEL = new ClientGameProt(160, 8);
    static readonly IGNORELIST_ADD = new ClientGameProt(217, 8);
    static readonly IDK_SAVEDESIGN = new ClientGameProt(163, 13);
    static readonly CHAT_SETMODE = new ClientGameProt(176, 3);
    static readonly MESSAGE_PRIVATE = new ClientGameProt(227, -1);
    static readonly FRIENDLIST_DEL = new ClientGameProt(141, 8);
    static readonly FRIENDLIST_ADD = new ClientGameProt(120, 8);
    static readonly CLIENT_CHEAT = new ClientGameProt(56, -1);
    static readonly MESSAGE_PUBLIC = new ClientGameProt(49, -1);
    static readonly MOVE_GAMECLICK = new ClientGameProt(28, -1);

    constructor(
        readonly id: number,
        readonly length: number
    ) {
        ClientGameProt.byId[id] = this;
    }
}
