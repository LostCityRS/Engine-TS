import { PackFile } from '#tools/pack/core/PackFile.js';

const chatcatPack = new PackFile('chatcat');
chatcatPack.load('data/src/pack/chatcat.pack');

export function getChatCatId(name: string): number {
    return chatcatPack.getByName(name);
}

export function getChatCatName(id: number): string {
    return chatcatPack.getById(id);
}

export function hasChatCatName(name: string): boolean {
    return chatcatPack.names.has(name);
}

export function getAllChatCatNames(): string[] {
    return Array.from(chatcatPack.names);
}
