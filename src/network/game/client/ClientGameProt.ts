export default class ClientGameProt {
    static all: ClientGameProt[] = [];
    static byId: ClientGameProt[] = [];

    static readonly REBUILD_GETMAPS = new ClientGameProt(4, 150, -1);
    static readonly NO_TIMEOUT = new ClientGameProt(6, 108, 0); // NXT naming

    static readonly IDLE_TIMER = new ClientGameProt(30, 70, 0);
    static readonly EVENT_TRACKING = new ClientGameProt(34, 81, -2);
    static readonly EVENT_CAMERA_POSITION = new ClientGameProt(35, 189, 6); // NXT naming

    static readonly ANTICHEAT_OPLOGIC1 = new ClientGameProt(60, 7, 4);
    static readonly ANTICHEAT_OPLOGIC2 = new ClientGameProt(61, 88, 4);
    static readonly ANTICHEAT_OPLOGIC3 = new ClientGameProt(62, 30, 3);
    static readonly ANTICHEAT_OPLOGIC4 = new ClientGameProt(63, 176, 2);
    static readonly ANTICHEAT_OPLOGIC5 = new ClientGameProt(64, 220, 0);
    static readonly ANTICHEAT_OPLOGIC6 = new ClientGameProt(65, 66, 4);
    static readonly ANTICHEAT_OPLOGIC7 = new ClientGameProt(66, 17, 4);
    static readonly ANTICHEAT_OPLOGIC8 = new ClientGameProt(67, 2, 2);
    static readonly ANTICHEAT_OPLOGIC9 = new ClientGameProt(68, 238, 1);

    static readonly ANTICHEAT_CYCLELOGIC1 = new ClientGameProt(70, 233, 1);
    static readonly ANTICHEAT_CYCLELOGIC2 = new ClientGameProt(71, 146, -1);
    static readonly ANTICHEAT_CYCLELOGIC3 = new ClientGameProt(74, 215, 3);
    static readonly ANTICHEAT_CYCLELOGIC4 = new ClientGameProt(72, 236, 4);
    static readonly ANTICHEAT_CYCLELOGIC5 = new ClientGameProt(75, 85, 0);
    static readonly ANTICHEAT_CYCLELOGIC6 = new ClientGameProt(73, 219, -1);

    static readonly OPOBJ1 = new ClientGameProt(80, 140, 6); // NXT naming
    static readonly OPOBJ2 = new ClientGameProt(81, 40, 6); // NXT naming
    static readonly OPOBJ3 = new ClientGameProt(82, 200, 6); // NXT naming
    static readonly OPOBJ4 = new ClientGameProt(83, 178, 6); // NXT naming
    static readonly OPOBJ5 = new ClientGameProt(84, 247, 6); // NXT naming
    static readonly OPOBJT = new ClientGameProt(88, 138, 8); // NXT naming
    static readonly OPOBJU = new ClientGameProt(89, 239, 12); // NXT naming

    static readonly OPNPC1 = new ClientGameProt(100, 194, 2); // NXT naming
    static readonly OPNPC2 = new ClientGameProt(101, 8, 2); // NXT naming
    static readonly OPNPC3 = new ClientGameProt(102, 27, 2); // NXT naming
    static readonly OPNPC4 = new ClientGameProt(103, 113, 2); // NXT naming
    static readonly OPNPC5 = new ClientGameProt(104, 100, 2); // NXT naming
    static readonly OPNPCT = new ClientGameProt(108, 134, 4); // NXT naming
    static readonly OPNPCU = new ClientGameProt(109, 202, 8); // NXT naming

    static readonly OPLOC1 = new ClientGameProt(120, 245, 6); // NXT naming
    static readonly OPLOC2 = new ClientGameProt(121, 172, 6); // NXT naming
    static readonly OPLOC3 = new ClientGameProt(122, 96, 6); // NXT naming
    static readonly OPLOC4 = new ClientGameProt(123, 97, 6); // NXT naming
    static readonly OPLOC5 = new ClientGameProt(124, 116, 6); // NXT naming
    static readonly OPLOCT = new ClientGameProt(128, 9, 8); // NXT naming
    static readonly OPLOCU = new ClientGameProt(129, 75, 12); // NXT naming

    static readonly OPPLAYER1 = new ClientGameProt(140, 164, 2); // NXT naming
    static readonly OPPLAYER2 = new ClientGameProt(141, 53, 2); // NXT naming
    static readonly OPPLAYER3 = new ClientGameProt(142, 185, 2); // NXT naming
    static readonly OPPLAYER4 = new ClientGameProt(143, 206, 2); // NXT naming
    static readonly OPPLAYERT = new ClientGameProt(148, 177, 4); // NXT naming
    static readonly OPPLAYERU = new ClientGameProt(149, 248, 8); // NXT naming

    static readonly OPHELD1 = new ClientGameProt(160, 195, 6); // name based on runescript trigger
    static readonly OPHELD2 = new ClientGameProt(161, 71, 6); // name based on runescript trigger
    static readonly OPHELD3 = new ClientGameProt(162, 133, 6); // name based on runescript trigger
    static readonly OPHELD4 = new ClientGameProt(163, 157, 6); // name based on runescript trigger
    static readonly OPHELD5 = new ClientGameProt(164, 211, 6); // name based on runescript trigger
    static readonly OPHELDT = new ClientGameProt(168, 48, 8); // name based on runescript trigger
    static readonly OPHELDU = new ClientGameProt(169, 130, 12); // name based on runescript trigger

    static readonly INV_BUTTON1 = new ClientGameProt(190, 31, 6); // NXT has "IF_BUTTON1" but for our interface system, this makes more sense
    static readonly INV_BUTTON2 = new ClientGameProt(191, 59, 6); // NXT has "IF_BUTTON2" but for our interface system, this makes more sense
    static readonly INV_BUTTON3 = new ClientGameProt(192, 212, 6); // NXT has "IF_BUTTON3" but for our interface system, this makes more sense
    static readonly INV_BUTTON4 = new ClientGameProt(193, 38, 6); // NXT has "IF_BUTTON4" but for our interface system, this makes more sense
    static readonly INV_BUTTON5 = new ClientGameProt(194, 6, 6); // NXT has "IF_BUTTON5" but for our interface system, this makes more sense
    static readonly IF_BUTTON = new ClientGameProt(200, 155, 2); // NXT naming

    static readonly RESUME_PAUSEBUTTON = new ClientGameProt(201, 235, 2); // NXT naming
    static readonly CLOSE_MODAL = new ClientGameProt(202, 231, 0); // NXT naming
    static readonly RESUME_P_COUNTDIALOG = new ClientGameProt(203, 237, 4); // NXT naming
    static readonly TUTORIAL_CLICKSIDE = new ClientGameProt(204, 175, 1);

    static readonly MOVE_OPCLICK = new ClientGameProt(242, 93, -1); // comes with OP packets, name based on other MOVE packets
    static readonly REPORT_ABUSE = new ClientGameProt(243, 190, 10);
    static readonly MOVE_MINIMAPCLICK = new ClientGameProt(244, 165, -1); // NXT naming
    static readonly INV_BUTTOND = new ClientGameProt(245, 159, 6); // NXT has "IF_BUTTOND" but for our interface system, this makes more sense
    static readonly IGNORELIST_DEL = new ClientGameProt(246, 171, 8); // NXT naming
    static readonly IGNORELIST_ADD = new ClientGameProt(247, 79, 8); // NXT naming
    static readonly IF_PLAYERDESIGN = new ClientGameProt(248, 52, 13);
    static readonly CHAT_SETMODE = new ClientGameProt(249, 244, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ClientGameProt(250, 148, -1); // NXT naming
    static readonly FRIENDLIST_DEL = new ClientGameProt(251, 11, 8); // NXT naming
    static readonly FRIENDLIST_ADD = new ClientGameProt(252, 118, 8); // NXT naming
    static readonly CLIENT_CHEAT = new ClientGameProt(253, 4, -1); // NXT naming
    static readonly MESSAGE_PUBLIC = new ClientGameProt(254, 158, -1); // NXT naming
    static readonly MOVE_GAMECLICK = new ClientGameProt(255, 181, -1); // NXT naming

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
