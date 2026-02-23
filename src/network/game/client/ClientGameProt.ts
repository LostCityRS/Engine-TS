export default class ClientGameProt {
    static byId: ClientGameProt[] = [];

    static readonly REBUILD_GETMAPS = new ClientGameProt(150, -1);
    static readonly NO_TIMEOUT = new ClientGameProt(108, 0);

    static readonly IDLE_TIMER = new ClientGameProt(70, 0);
    static readonly EVENT_TRACKING = new ClientGameProt(81, -2);
    static readonly EVENT_CAMERA_POSITION = new ClientGameProt(189, 6);

    static readonly ANTICHEAT_OPLOGIC1 = new ClientGameProt(7, 4);
    static readonly ANTICHEAT_OPLOGIC2 = new ClientGameProt(88, 4);
    static readonly ANTICHEAT_OPLOGIC3 = new ClientGameProt(30, 3);
    static readonly ANTICHEAT_OPLOGIC4 = new ClientGameProt(176, 2);
    static readonly ANTICHEAT_OPLOGIC5 = new ClientGameProt(220, 0);
    static readonly ANTICHEAT_OPLOGIC6 = new ClientGameProt(66, 4);
    static readonly ANTICHEAT_OPLOGIC7 = new ClientGameProt(17, 4);
    static readonly ANTICHEAT_OPLOGIC8 = new ClientGameProt(2, 2);
    static readonly ANTICHEAT_OPLOGIC9 = new ClientGameProt(238, 1);

    static readonly ANTICHEAT_CYCLELOGIC1 = new ClientGameProt(233, 1);
    static readonly ANTICHEAT_CYCLELOGIC2 = new ClientGameProt(146, -1);
    static readonly ANTICHEAT_CYCLELOGIC3 = new ClientGameProt(215, 3);
    static readonly ANTICHEAT_CYCLELOGIC4 = new ClientGameProt(236, 4);
    static readonly ANTICHEAT_CYCLELOGIC5 = new ClientGameProt(85, 0);
    static readonly ANTICHEAT_CYCLELOGIC6 = new ClientGameProt(219, -1);

    static readonly OPOBJ1 = new ClientGameProt(140, 6);
    static readonly OPOBJ2 = new ClientGameProt(40, 6);
    static readonly OPOBJ3 = new ClientGameProt(200, 6);
    static readonly OPOBJ4 = new ClientGameProt(178, 6);
    static readonly OPOBJ5 = new ClientGameProt(247, 6);
    static readonly OPOBJT = new ClientGameProt(138, 8);
    static readonly OPOBJU = new ClientGameProt(239, 12);

    static readonly OPNPC1 = new ClientGameProt(194, 2);
    static readonly OPNPC2 = new ClientGameProt(8, 2);
    static readonly OPNPC3 = new ClientGameProt(27, 2);
    static readonly OPNPC4 = new ClientGameProt(113, 2);
    static readonly OPNPC5 = new ClientGameProt(100, 2);
    static readonly OPNPCT = new ClientGameProt(134, 4);
    static readonly OPNPCU = new ClientGameProt(202, 8);

    static readonly OPLOC1 = new ClientGameProt(245, 6);
    static readonly OPLOC2 = new ClientGameProt(172, 6);
    static readonly OPLOC3 = new ClientGameProt(96, 6);
    static readonly OPLOC4 = new ClientGameProt(97, 6);
    static readonly OPLOC5 = new ClientGameProt(116, 6);
    static readonly OPLOCT = new ClientGameProt(9, 8);
    static readonly OPLOCU = new ClientGameProt(75, 12);

    static readonly OPPLAYER1 = new ClientGameProt(164, 2);
    static readonly OPPLAYER2 = new ClientGameProt(53, 2);
    static readonly OPPLAYER3 = new ClientGameProt(185, 2);
    static readonly OPPLAYER4 = new ClientGameProt(206, 2);
    static readonly OPPLAYERT = new ClientGameProt(177, 4);
    static readonly OPPLAYERU = new ClientGameProt(248, 8);

    static readonly OPHELD1 = new ClientGameProt(195, 6);
    static readonly OPHELD2 = new ClientGameProt(71, 6);
    static readonly OPHELD3 = new ClientGameProt(133, 6);
    static readonly OPHELD4 = new ClientGameProt(157, 6);
    static readonly OPHELD5 = new ClientGameProt(211, 6);
    static readonly OPHELDT = new ClientGameProt(48, 8);
    static readonly OPHELDU = new ClientGameProt(130, 12);

    static readonly INV_BUTTON1 = new ClientGameProt(31, 6);
    static readonly INV_BUTTON2 = new ClientGameProt(59, 6);
    static readonly INV_BUTTON3 = new ClientGameProt(212, 6);
    static readonly INV_BUTTON4 = new ClientGameProt(38, 6);
    static readonly INV_BUTTON5 = new ClientGameProt(6, 6);

    static readonly IF_BUTTON = new ClientGameProt(155, 2);
    static readonly RESUME_PAUSEBUTTON = new ClientGameProt(235, 2);
    static readonly CLOSE_MODAL = new ClientGameProt(231, 0);
    static readonly RESUME_P_COUNTDIALOG = new ClientGameProt(237, 4);
    static readonly TUT_CLICKSIDE = new ClientGameProt(175, 1);

    static readonly MOVE_OPCLICK = new ClientGameProt(93, -1);
    static readonly REPORT_ABUSE = new ClientGameProt(190, 10); // todo: rename to SEND_SNAPSHOT
    static readonly MOVE_MINIMAPCLICK = new ClientGameProt(165, -1);
    static readonly INV_BUTTOND = new ClientGameProt(159, 6);
    static readonly IGNORELIST_DEL = new ClientGameProt(171, 8);
    static readonly IGNORELIST_ADD = new ClientGameProt(79, 8);
    static readonly IDK_SAVEDESIGN = new ClientGameProt(52, 13);
    static readonly CHAT_SETMODE = new ClientGameProt(244, 3);
    static readonly MESSAGE_PRIVATE = new ClientGameProt(148, -1);
    static readonly FRIENDLIST_DEL = new ClientGameProt(11, 8);
    static readonly FRIENDLIST_ADD = new ClientGameProt(118, 8);
    static readonly CLIENT_CHEAT = new ClientGameProt(4, -1);
    static readonly MESSAGE_PUBLIC = new ClientGameProt(158, -1);
    static readonly MOVE_GAMECLICK = new ClientGameProt(181, -1);

    constructor(
        readonly id: number,
        readonly length: number
    ) {
        ClientGameProt.byId[id] = this;
    }
}
