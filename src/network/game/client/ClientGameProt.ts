export default class ClientGameProt {
    static all: ClientGameProt[] = [];
    static byId: ClientGameProt[] = [];

    static readonly NO_TIMEOUT = new ClientGameProt(6, 206, 0); // NXT naming

    static readonly IDLE_TIMER = new ClientGameProt(30, 102, 0);
    static readonly EVENT_TRACKING = new ClientGameProt(34, 19, -2);

    static readonly ANTICHEAT_OPLOGIC1 = new ClientGameProt(60, 87, 4);
    static readonly ANTICHEAT_OPLOGIC2 = new ClientGameProt(61, 95, 4);
    static readonly ANTICHEAT_OPLOGIC3 = new ClientGameProt(62, 146, 3);
    static readonly ANTICHEAT_OPLOGIC4 = new ClientGameProt(63, 186, 2);
    static readonly ANTICHEAT_OPLOGIC5 = new ClientGameProt(64, 74, 0);
    static readonly ANTICHEAT_OPLOGIC6 = new ClientGameProt(65, 250, 4);
    static readonly ANTICHEAT_OPLOGIC7 = new ClientGameProt(66, 119, 4);
    static readonly ANTICHEAT_OPLOGIC8 = new ClientGameProt(67, 171, 2);
    static readonly ANTICHEAT_OPLOGIC9 = new ClientGameProt(68, 233, 1);

    static readonly ANTICHEAT_CYCLELOGIC1 = new ClientGameProt(70, 136, 1);
    static readonly ANTICHEAT_CYCLELOGIC2 = new ClientGameProt(71, 223, -1);
    static readonly ANTICHEAT_CYCLELOGIC3 = new ClientGameProt(74, 181, 3);
    static readonly ANTICHEAT_CYCLELOGIC4 = new ClientGameProt(72, 94, 4);
    static readonly ANTICHEAT_CYCLELOGIC5 = new ClientGameProt(75, 63, 0);
    static readonly ANTICHEAT_CYCLELOGIC6 = new ClientGameProt(73, 112, -1);

    static readonly OPOBJ1 = new ClientGameProt(80, 113, 6); // NXT naming
    static readonly OPOBJ2 = new ClientGameProt(81, 238, 6); // NXT naming
    static readonly OPOBJ3 = new ClientGameProt(82, 55, 6); // NXT naming
    static readonly OPOBJ4 = new ClientGameProt(83, 17, 6); // NXT naming
    static readonly OPOBJ5 = new ClientGameProt(84, 247, 6); // NXT naming
    static readonly OPOBJT = new ClientGameProt(88, 122, 8); // NXT naming
    static readonly OPOBJU = new ClientGameProt(89, 143, 12); // NXT naming

    static readonly OPNPC1 = new ClientGameProt(100, 180, 2); // NXT naming
    static readonly OPNPC2 = new ClientGameProt(101, 252, 2); // NXT naming
    static readonly OPNPC3 = new ClientGameProt(102, 196, 2); // NXT naming
    static readonly OPNPC4 = new ClientGameProt(103, 107, 2); // NXT naming
    static readonly OPNPC5 = new ClientGameProt(104, 43, 2); // NXT naming
    static readonly OPNPCT = new ClientGameProt(108, 141, 4); // NXT naming
    static readonly OPNPCU = new ClientGameProt(109, 14, 8); // NXT naming

    static readonly OPLOC1 = new ClientGameProt(120, 1, 6); // NXT naming
    static readonly OPLOC2 = new ClientGameProt(121, 219, 6); // NXT naming
    static readonly OPLOC3 = new ClientGameProt(122, 226, 6); // NXT naming
    static readonly OPLOC4 = new ClientGameProt(123, 204, 6); // NXT naming
    static readonly OPLOC5 = new ClientGameProt(124, 86, 6); // NXT naming
    static readonly OPLOCT = new ClientGameProt(128, 208, 8); // NXT naming
    static readonly OPLOCU = new ClientGameProt(129, 147, 12); // NXT naming

    static readonly OPPLAYER1 = new ClientGameProt(140, 135, 2); // NXT naming
    static readonly OPPLAYER2 = new ClientGameProt(141, 165, 2); // NXT naming
    static readonly OPPLAYER3 = new ClientGameProt(142, 172, 2); // NXT naming
    static readonly OPPLAYER4 = new ClientGameProt(143, 54, 2); // NXT naming
    static readonly OPPLAYERT = new ClientGameProt(148, 52, 4); // NXT naming
    static readonly OPPLAYERU = new ClientGameProt(149, 210, 8); // NXT naming

    static readonly OPHELD1 = new ClientGameProt(160, 104, 6); // name based on runescript trigger
    static readonly OPHELD2 = new ClientGameProt(161, 193, 6); // name based on runescript trigger
    static readonly OPHELD3 = new ClientGameProt(162, 115, 6); // name based on runescript trigger
    static readonly OPHELD4 = new ClientGameProt(163, 194, 6); // name based on runescript trigger
    static readonly OPHELD5 = new ClientGameProt(164, 9, 6); // name based on runescript trigger
    static readonly OPHELDT = new ClientGameProt(168, 188, 8); // name based on runescript trigger
    static readonly OPHELDU = new ClientGameProt(169, 126, 12); // name based on runescript trigger

    static readonly INV_BUTTON1 = new ClientGameProt(190, 13, 6); // NXT has "IF_BUTTON1" but for our interface system, this makes more sense
    static readonly INV_BUTTON2 = new ClientGameProt(191, 58, 6); // NXT has "IF_BUTTON2" but for our interface system, this makes more sense
    static readonly INV_BUTTON3 = new ClientGameProt(192, 48, 6); // NXT has "IF_BUTTON3" but for our interface system, this makes more sense
    static readonly INV_BUTTON4 = new ClientGameProt(193, 183, 6); // NXT has "IF_BUTTON4" but for our interface system, this makes more sense
    static readonly INV_BUTTON5 = new ClientGameProt(194, 242, 6); // NXT has "IF_BUTTON5" but for our interface system, this makes more sense

    static readonly IF_BUTTON = new ClientGameProt(200, 177, 2); // NXT naming
    static readonly RESUME_PAUSEBUTTON = new ClientGameProt(201, 239, 2); // NXT naming
    static readonly CLOSE_MODAL = new ClientGameProt(202, 245, 0); // NXT naming
    static readonly RESUME_P_COUNTDIALOG = new ClientGameProt(203, 241, 4); // NXT naming
    static readonly TUTORIAL_CLICKSIDE = new ClientGameProt(204, 243, 1);

    static readonly MOVE_OPCLICK = new ClientGameProt(242, 216, -1); // comes with OP packets, name based on other MOVE packets
    static readonly REPORT_ABUSE = new ClientGameProt(243, 205, 10);
    static readonly MOVE_MINIMAPCLICK = new ClientGameProt(244, 198, -1); // NXT naming
    static readonly INV_BUTTOND = new ClientGameProt(245, 7, 7); // NXT has "IF_BUTTOND" but for our interface system, this makes more sense
    static readonly IGNORELIST_DEL = new ClientGameProt(246, 4, 8); // NXT naming
    static readonly IGNORELIST_ADD = new ClientGameProt(247, 20, 8); // NXT naming
    static readonly IF_PLAYERDESIGN = new ClientGameProt(248, 150, 13);
    static readonly CHAT_SETMODE = new ClientGameProt(249, 8, 3); // NXT naming
    static readonly MESSAGE_PRIVATE = new ClientGameProt(250, 99, -1); // NXT naming
    static readonly FRIENDLIST_DEL = new ClientGameProt(251, 61, 8); // NXT naming
    static readonly FRIENDLIST_ADD = new ClientGameProt(252, 116, 8); // NXT naming
    static readonly CLIENT_CHEAT = new ClientGameProt(253, 11, -1); // NXT naming
    static readonly MESSAGE_PUBLIC = new ClientGameProt(254, 78, -1); // NXT naming
    static readonly MOVE_GAMECLICK = new ClientGameProt(255, 182, -1); // NXT naming

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
