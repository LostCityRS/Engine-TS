import { PackFile } from '#tools/pack/core/PackFile.js';

const chatphrasePack = new PackFile('chatphrase');
chatphrasePack.load('data/src/pack/chatphrase.pack');

export function getChatPhraseId(name: string): number {
    return chatphrasePack.getByName(name);
}

export function getChatPhraseName(id: number): string {
    return chatphrasePack.getById(id);
}

export function hasChatPhraseName(name: string): boolean {
    return chatphrasePack.names.has(name);
}

export function getAllChatPhraseNames(): string[] {
    return Array.from(chatphrasePack.names);
}
