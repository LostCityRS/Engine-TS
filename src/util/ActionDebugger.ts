// TypeScript facade for ActionDebugger to aid editor IntelliSense.
// Runtime uses the ESM file ActionDebugger.js due to NodeNext + allowJs.

type PlayerLike = {
	messageGame?: (msg: string) => void;
};

const enabled = new WeakSet<PlayerLike>();

export default class ActionDebugger {
    static isEnabled(player: PlayerLike): boolean {
        return enabled.has(player);
    }

    static toggle(player: PlayerLike): boolean {
        if (enabled.has(player)) {
            enabled.delete(player);
            return false;
        }
        enabled.add(player);
        return true;
    }

    static log(player: PlayerLike, ...parts: unknown[]): void {
        if (!enabled.has(player)) return;
        try {
            const msg = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
            player.messageGame?.(`[debug] ${msg}`);
        } catch {
            // ignore
        }
    }
}

