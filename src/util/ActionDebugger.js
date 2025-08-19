// Lightweight per-player action debugging helper for runtime (ESM).
// Uses a WeakSet to avoid memory leaks and keeps zero dependencies.

/** @type {WeakSet<any>} */
const enabled = new WeakSet();

const ActionDebugger = {
    /**
     * @param {any} player
     * @returns {boolean}
     */
    isEnabled(player) {
        return enabled.has(player);
    },

    /**
     * Toggles debugging for the given player.
     * @param {any} player
     * @returns {boolean} true if now enabled, false if disabled
     */
    toggle(player) {
        if (enabled.has(player)) {
            enabled.delete(player);
            return false;
        }
        enabled.add(player);
        return true;
    },

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 692b0b2cf083bb1707ec8bd82cfa05d850cde162
    /**
     * Logs a message to the player if debugging is enabled.
     * @param {any} player
     * @param {...any} parts
     */
    log(player, ...parts) {
        if (!enabled.has(player)) return;
        try {
            const msg = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
            if (typeof (player?.messageGame) === 'function') {
                player.messageGame(`[debug] ${msg}`);
            }
        } catch {
            // ignore
        }
    }
<<<<<<< HEAD
=======
	/**
	 * Logs a message to the player if debugging is enabled.
	 * @param {any} player
	 * @param {...any} parts
	 */
	log(player, ...parts) {
		if (!enabled.has(player)) return;
		try {
			const msg = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
			if (typeof (player?.messageGame) === 'function') {
				player.messageGame(`[debug] ${msg}`);
			}
		} catch {
			// ignore
		}
	}
>>>>>>> d8d31ae5f202b7b6c67cb88b9e374730f336a694
=======
>>>>>>> 692b0b2cf083bb1707ec8bd82cfa05d850cde162
};

export default ActionDebugger;

