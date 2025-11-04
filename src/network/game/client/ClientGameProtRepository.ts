import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';
import MoveClickDecoder from '#/network/game/client/codec/MoveClickDecoder.js';
import MoveClickHandler from '#/network/game/client/handler/MoveClickHandler.js';
import ClientCheatDecoder from '#/network/game/client/codec/ClientCheatDecoder.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';

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
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_GAMECLICK), new MoveClickHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_OPCLICK), new MoveClickHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_MINIMAPCLICK), new MoveClickHandler());
    }
}

export default new ClientGameProtRepository();
