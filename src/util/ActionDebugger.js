// Lightweight per-player action debugging helper for runtime (ESM).
// Uses a WeakSet to avoid memory leaks and keeps zero dependencies.

/** @type {WeakSet<any>} */
const enabled = new WeakSet();

function toDebugPart(v) {
    if (typeof v === 'string') return v;
    try {
        return JSON.stringify(v);
    } catch {
        try {
            return String(v);
        } catch {
            return '[unserializable]';
        }
    }
}

const ActionDebugger = {
    /**
   * Check if debugging is enabled for a player.
   * @param {any} player
   * @returns {boolean}
   */
    isEnabled(player) {
        return enabled.has(player);
    },

    /**
   * Enable debugging for a player.
   * @param {any} player
   * @returns {boolean} true if it was just enabled, false if it was already enabled
   */
    enable(player) {
        const wasEnabled = enabled.has(player);
        if (!wasEnabled) enabled.add(player);
        return !wasEnabled;
    },

    /**
   * Disable debugging for a player.
   * @param {any} player
   * @returns {boolean} true if it was just disabled, false if it was already disabled
   */
    disable(player) {
        const wasEnabled = enabled.has(player);
        if (wasEnabled) enabled.delete(player);
        return wasEnabled;
    },

    /**
   * Toggle debugging for a player.
   * @param {any} player
   * @returns {boolean} true if now enabled, false if now disabled
   */
    toggle(player) {
        if (enabled.has(player)) {
            enabled.delete(player);
            return false;
        }
        enabled.add(player);
        return true;
    },

    /**
   * Log a message to the player if debugging is enabled.
   * @param {any} player
   * @param {...any} parts
   */
    log(player, ...parts) {
        if (!enabled.has(player)) return;
        try {
            const msg = parts.map(toDebugPart).join(' ');
            if (typeof player?.messageGame === 'function') {
                player.messageGame(`[debug] ${msg}`);
            }
        } catch {
            // ignore
        }
    }
};

export default ActionDebugger;
