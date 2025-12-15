import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';
import MoveClickDecoder from '#/network/game/client/codec/MoveClickDecoder.js';
import MoveClickHandler from '#/network/game/client/handler/MoveClickHandler.js';
import ClientCheatDecoder from '#/network/game/client/codec/ClientCheatDecoder.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import IgnoreListAddDecoder from '#/network/game/client/codec/IgnoreListAddDecoder.js';
import IgnoreListAddHandler from '#/network/game/client/handler/IgnoreListAddHandler.js';
import IgnoreListDelDecoder from '#/network/game/client/codec/IgnoreListDelDecoder.js';
import IgnoreListDelHandler from '#/network/game/client/handler/IgnoreListDelHandler.js';
import FriendListAddDecoder from '#/network/game/client/codec/FriendListAddDecoder.js';
import FriendListAddHandler from '#/network/game/client/handler/FriendListAddHandler.js';
import FriendListDelDecoder from '#/network/game/client/codec/FriendListDelDecoder.js';
import FriendListDelHandler from '#/network/game/client/handler/FriendListDelHandler.js';
import ReportAbuseDecoder from '#/network/game/client/codec/ReportAbuseDecoder.js';
import ReportAbuseHandler from '#/network/game/client/handler/ReportAbuseHandler.js';
import ClanJoinLeaveChatDecoder from '#/network/game/client/codec/ClanJoinLeaveChatDecoder.js';
import ClanJoinLeaveChatHandler from '#/network/game/client/handler/ClanJoinLeaveChatHandler.js';
import ClanKickUserDecoder from '#/network/game/client/codec/ClanKickUserDecoder.js';
import ClanKickUserHandler from '#/network/game/client/handler/ClanKickUserHandler.js';
import FriendSetRankDecoder from '#/network/game/client/codec/FriendSetRankDecoder.js';
import FriendSetRankHandler from '#/network/game/client/handler/FriendSetRankHandler.js';
import WindowStatusDecoder from '#/network/game/client/codec/WindowStatusDecoder.js';
import WindowStatusHandler from '#/network/game/client/handler/WindowStatusHandler.js';

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
        this.bind(new IgnoreListAddDecoder, new IgnoreListAddHandler());
        this.bind(new IgnoreListDelDecoder, new IgnoreListDelHandler());

        this.bind(new FriendListAddDecoder, new FriendListAddHandler());
        this.bind(new FriendListDelDecoder, new FriendListDelHandler());
        this.bind(new FriendSetRankDecoder, new FriendSetRankHandler());

        this.bind(new ReportAbuseDecoder, new ReportAbuseHandler());

        this.bind(new ClientCheatDecoder(), new ClientCheatHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_GAMECLICK), new MoveClickHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_OPCLICK), new MoveClickHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_MINIMAPCLICK), new MoveClickHandler());

        this.bind(new ClanJoinLeaveChatDecoder(), new ClanJoinLeaveChatHandler());
        this.bind(new ClanKickUserDecoder(), new ClanKickUserHandler());

        this.bind(new WindowStatusDecoder(), new WindowStatusHandler());
    }
}

export default new ClientGameProtRepository();
