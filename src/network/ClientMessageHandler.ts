import type ClientMessage from '#/network/ClientMessage.js';

export default abstract class ClientMessageHandler<T extends ClientMessage> {
    abstract handle(message: T): boolean;
}
