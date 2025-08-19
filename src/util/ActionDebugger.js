// Lightweight per-player action debugging helper for runtime (ESM).
// Uses a WeakSet to avoid memory leaks and keeps zero dependencies.

/** @type {WeakSet<any>} */
const enabled = new WeakSet();

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
   * @returns {boolean} true if just enabled, false if already enabled
   */
    enable(player) {
        if (!enabled.has(player)) {
            enabled.add(player);
            return true;
        }
        return false;
    },

    /**
   * Disable debugging for a player.
   * @param {any} player
   * @returns {boolean} true if just disabled, false if already disabled
   */
    disable(player) {
        if (enabled.has(player)) {
            enabled.delete(player);
            return true;
        }
        return false;
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
            const msg = parts
                .map((p) => {
                    if (typeof p === 'string') return p;
                    try {
                        return JSON.stringify(p);
                    } catch {
                        return String(p);
                    }
                })
                .join(' ');
            if (typeof player?.messageGame === 'function') {
                player.messageGame(`[debug] ${msg}`);
            }
        } catch {
            // ignore
        }
    }
};

export default ActionDebugger;
