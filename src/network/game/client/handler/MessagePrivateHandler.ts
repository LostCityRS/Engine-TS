import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import Packet from '#/io/Packet.js';
import MessageHandler from '#/network/game/client/handler/MessageHandler.js';
import MessagePrivate from '#/network/game/client/model/MessagePrivate.js';
import { fromBase37 } from '#/util/JString.js';
import WordPack from '#/wordenc/WordPack.js';


export default class MessagePrivateHandler extends MessageHandler<MessagePrivate> {
    handle(message: MessagePrivate, player: Player): boolean {
        const { username, input } = message;

        if (player.socialProtect || input.length > 100) {
            return false;
        }

        const buf: Packet = Packet.alloc(0);
        buf.pdata(input, 0, input.length);
        buf.pos = 0;

        const unpacked: string = WordPack.unpack(buf, input.length);
        buf.release();

        if (player.muted_until !== null && player.muted_until > new Date()) {
            World.sendPrivateMessage(player, username, unpacked);
            return false;
        }

        if (fromBase37(username) === 'invalid_name') {
            World.notifyPlayerBan('automated', player.username, Date.now() + 172800000);
            return false;
        }
        
        World.sendPrivateMessage(player, username, unpacked);

        player.socialProtect = true;
        return true;
    }
}
