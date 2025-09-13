import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

import ChatSetModeDecoder from '#/network/game/client/codec/ChatSetModeDecoder.js';
import ClientCheatDecoder from '#/network/game/client/codec/ClientCheatDecoder.js';
import CloseModalDecoder from '#/network/game/client/codec/CloseModalDecoder.js';
import EventTrackingDecoder from '#/network/game/client/codec/EventTrackingDecoder.js';
import FriendListAddDecoder from '#/network/game/client/codec/FriendListAddDecoder.js';
import FriendListDelDecoder from '#/network/game/client/codec/FriendListDelDecoder.js';
import IdleTimerDecoder from '#/network/game/client/codec/IdleTimerDecoder.js';
import IfButtonDecoder from '#/network/game/client/codec/IfButtonDecoder.js';
import IfPlayerDesignDecoder from '#/network/game/client/codec/IfPlayerDesignDecoder.js';
import IgnoreListAddDecoder from '#/network/game/client/codec/IgnoreListAddDecoder.js';
import IgnoreListDelDecoder from '#/network/game/client/codec/IgnoreListDelDecoder.js';
import InvButtonDDecoder from '#/network/game/client/codec/InvButtonDDecoder.js';
import InvButtonDecoder from '#/network/game/client/codec/InvButtonDecoder.js';
import MessagePrivateDecoder from '#/network/game/client/codec/MessagePrivateDecoder.js';
import MessagePublicDecoder from '#/network/game/client/codec/MessagePublicDecoder.js';
import MoveClickDecoder from '#/network/game/client/codec/MoveClickDecoder.js';
import OpHeldDecoder from '#/network/game/client/codec/OpHeldDecoder.js';
import OpHeldTDecoder from '#/network/game/client/codec/OpHeldTDecoder.js';
import OpHeldUDecoder from '#/network/game/client/codec/OpHeldUDecoder.js';
import OpLocDecoder from '#/network/game/client/codec/OpLocDecoder.js';
import OpLocTDecoder from '#/network/game/client/codec/OpLocTDecoder.js';
import OpLocUDecoder from '#/network/game/client/codec/OpLocUDecoder.js';
import OpNpcDecoder from '#/network/game/client/codec/OpNpcDecoder.js';
import OpNpcTDecoder from '#/network/game/client/codec/OpNpcTDecoder.js';
import OpNpcUDecoder from '#/network/game/client/codec/OpNpcUDecoder.js';
import OpObjDecoder from '#/network/game/client/codec/OpObjDecoder.js';
import OpObjTDecoder from '#/network/game/client/codec/OpObjTDecoder.js';
import OpObjUDecoder from '#/network/game/client/codec/OpObjUDecoder.js';
import OpPlayerDecoder from '#/network/game/client/codec/OpPlayerDecoder.js';
import OpPlayerTDecoder from '#/network/game/client/codec/OpPlayerTDecoder.js';
import OpPlayerUDecoder from '#/network/game/client/codec/OpPlayerUDecoder.js';
import ReportAbuseDecoder from '#/network/game/client/codec/ReportAbuseDecoder.js';
import ResumePauseButtonDecoder from '#/network/game/client/codec/ResumePauseButtonDecoder.js';
import ResumePCountDialogDecoder from '#/network/game/client/codec/ResumePCountDialogDecoder.js';
import TutorialClickSideDecoder from '#/network/game/client/codec/TutorialClickSideDecoder.js';
import ChatSetModeHandler from '#/network/game/client/handler/ChatSetModeHandler.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import CloseModalHandler from '#/network/game/client/handler/CloseModalHandler.js';
import EventTrackingHandler from '#/network/game/client/handler/EventTrackingHandler.js';
import FriendListAddHandler from '#/network/game/client/handler/FriendListAddHandler.js';
import FriendListDelHandler from '#/network/game/client/handler/FriendListDelHandler.js';
import IdleTimerHandler from '#/network/game/client/handler/IdleTimerHandler.js';
import IfButtonHandler from '#/network/game/client/handler/IfButtonHandler.js';
import IfPlayerDesignHandler from '#/network/game/client/handler/IfPlayerDesignHandler.js';
import IgnoreListAddHandler from '#/network/game/client/handler/IgnoreListAddHandler.js';
import IgnoreListDelHandler from '#/network/game/client/handler/IgnoreListDelHandler.js';
import InvButtonDHandler from '#/network/game/client/handler/InvButtonDHandler.js';
import InvButtonHandler from '#/network/game/client/handler/InvButtonHandler.js';
import MessagePrivateHandler from '#/network/game/client/handler/MessagePrivateHandler.js';
import MessagePublicHandler from '#/network/game/client/handler/MessagePublicHandler.js';
import MoveClickHandler from '#/network/game/client/handler/MoveClickHandler.js';
import OpHeldHandler from '#/network/game/client/handler/OpHeldHandler.js';
import OpHeldTHandler from '#/network/game/client/handler/OpHeldTHandler.js';
import OpHeldUHandler from '#/network/game/client/handler/OpHeldUHandler.js';
import OpLocHandler from '#/network/game/client/handler/OpLocHandler.js';
import OpLocTHandler from '#/network/game/client/handler/OpLocTHandler.js';
import OpLocUHandler from '#/network/game/client/handler/OpLocUHandler.js';
import OpNpcHandler from '#/network/game/client/handler/OpNpcHandler.js';
import OpNpcTHandler from '#/network/game/client/handler/OpNpcTHandler.js';
import OpNpcUHandler from '#/network/game/client/handler/OpNpcUHandler.js';
import OpObjHandler from '#/network/game/client/handler/OpObjHandler.js';
import OpObjTHandler from '#/network/game/client/handler/OpObjTHandler.js';
import OpObjUHandler from '#/network/game/client/handler/OpObjUHandler.js';
import OpPlayerHandler from '#/network/game/client/handler/OpPlayerHandler.js';
import OpPlayerTHandler from '#/network/game/client/handler/OpPlayerTHandler.js';
import OpPlayerUHandler from '#/network/game/client/handler/OpPlayerUHandler.js';
import ReportAbuseHandler from '#/network/game/client/handler/ReportAbuseHandler.js';
import ResumePauseButtonHandler from '#/network/game/client/handler/ResumePauseButtonHandler.js';
import ResumePCountDialogHandler from '#/network/game/client/handler/ResumePCountDialogHandler.js';
import TutorialClickSideHandler from '#/network/game/client/handler/TutorialClickSideHandler.js';

class ClientGameProtRepository {
    decoders: Map<number, ClientGameMessageDecoder<ClientGameMessage>> = new Map();
    handlers: Map<number, ClientGameMessageHandler<ClientGameMessage>> = new Map();

    protected bind(decoder: ClientGameMessageDecoder<ClientGameMessage>, handler?: ClientGameMessageHandler<ClientGameMessage>) {
        if (this.decoders.has(decoder.prot.id)) {
            throw new Error(`[ClientProtRepository] Already defines a ${decoder.prot.id}.`);
        }

        this.decoders.set(decoder.prot.id, decoder);

        if (handler) {
            this.handlers.set(decoder.prot.id, handler);
        }
    }

    getDecoder(prot: ClientGameProt) {
        return this.decoders.get(prot.id);
    }

    getHandler(prot: ClientGameProt) {
        return this.handlers.get(prot.id);
    }

    constructor() {
        this.bind(new ClientCheatDecoder(), new ClientCheatHandler());
        this.bind(new CloseModalDecoder(), new CloseModalHandler());
        this.bind(new FriendListAddDecoder(), new FriendListAddHandler());
        this.bind(new FriendListDelDecoder(), new FriendListDelHandler());
        this.bind(new IdleTimerDecoder(), new IdleTimerHandler());
        this.bind(new IfButtonDecoder(), new IfButtonHandler());
        this.bind(new IfPlayerDesignDecoder(), new IfPlayerDesignHandler());
        this.bind(new IgnoreListAddDecoder(), new IgnoreListAddHandler());
        this.bind(new IgnoreListDelDecoder(), new IgnoreListDelHandler());
        this.bind(new InvButtonDecoder(ClientGameProt.INV_BUTTON1, 1), new InvButtonHandler());
        this.bind(new InvButtonDecoder(ClientGameProt.INV_BUTTON2, 2), new InvButtonHandler());
        this.bind(new InvButtonDecoder(ClientGameProt.INV_BUTTON3, 3), new InvButtonHandler());
        this.bind(new InvButtonDecoder(ClientGameProt.INV_BUTTON4, 4), new InvButtonHandler());
        this.bind(new InvButtonDecoder(ClientGameProt.INV_BUTTON5, 5), new InvButtonHandler());
        this.bind(new InvButtonDDecoder(), new InvButtonDHandler());
        this.bind(new MessagePrivateDecoder(), new MessagePrivateHandler());
        this.bind(new MessagePublicDecoder(), new MessagePublicHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_GAMECLICK), new MoveClickHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_OPCLICK), new MoveClickHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_MINIMAPCLICK), new MoveClickHandler());
        // this.bind(new NoTimeoutDecoder(), new NoTimeoutHandler());
        this.bind(new OpHeldDecoder(ClientGameProt.OPHELD1, 1), new OpHeldHandler());
        this.bind(new OpHeldDecoder(ClientGameProt.OPHELD2, 2), new OpHeldHandler());
        this.bind(new OpHeldDecoder(ClientGameProt.OPHELD3, 3), new OpHeldHandler());
        this.bind(new OpHeldDecoder(ClientGameProt.OPHELD4, 4), new OpHeldHandler());
        this.bind(new OpHeldDecoder(ClientGameProt.OPHELD5, 5), new OpHeldHandler());
        this.bind(new OpHeldTDecoder(), new OpHeldTHandler());
        this.bind(new OpHeldUDecoder(), new OpHeldUHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC1, 1), new OpLocHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC2, 2), new OpLocHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC3, 3), new OpLocHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC4, 4), new OpLocHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC5, 5), new OpLocHandler());
        this.bind(new OpLocTDecoder(), new OpLocTHandler());
        this.bind(new OpLocUDecoder(), new OpLocUHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC1, 1), new OpNpcHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC2, 2), new OpNpcHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC3, 3), new OpNpcHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC4, 4), new OpNpcHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC5, 5), new OpNpcHandler());
        this.bind(new OpNpcTDecoder(), new OpNpcTHandler());
        this.bind(new OpNpcUDecoder(), new OpNpcUHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ1, 1), new OpObjHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ2, 2), new OpObjHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ3, 3), new OpObjHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ4, 4), new OpObjHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ5, 5), new OpObjHandler());
        this.bind(new OpObjTDecoder(), new OpObjTHandler());
        this.bind(new OpObjUDecoder(), new OpObjUHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER1, 1), new OpPlayerHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER2, 2), new OpPlayerHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER3, 3), new OpPlayerHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER4, 4), new OpPlayerHandler());
        this.bind(new OpPlayerTDecoder(), new OpPlayerTHandler());
        this.bind(new OpPlayerUDecoder(), new OpPlayerUHandler());
        this.bind(new ResumePauseButtonDecoder(), new ResumePauseButtonHandler());
        this.bind(new ResumePCountDialogDecoder(), new ResumePCountDialogHandler());
        this.bind(new TutorialClickSideDecoder(), new TutorialClickSideHandler());
        this.bind(new ChatSetModeDecoder(), new ChatSetModeHandler());
        this.bind(new EventTrackingDecoder(), new EventTrackingHandler());
        this.bind(new ReportAbuseDecoder(), new ReportAbuseHandler());
    }
}

export default new ClientGameProtRepository();
