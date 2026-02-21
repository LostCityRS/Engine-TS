import { TargetOp } from '#/engine/entity/PathingEntity.js';
import ScriptFile from '#/engine/script/ScriptFile.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import Packet from '#/io/Packet.js';
import { printFatalError, printWarning } from '#/util/Logger.js';
import { Js5Archive } from '#/io/Js5Archive.js';

// maintains a list of scripts (id <-> name)
export default class ScriptProvider {
    /**
     * Array of loaded scripts.
     */
    private static scripts: ScriptFile[] = [];

    /**
     * Mapping of unique trigger + type/category/global key to script.
     */
    private static scriptLookup = new Map<number, ScriptFile>();

    /**
     * Mapping of script names to its id.
     */
    private static scriptNames = new Map<string, number>();

    /**
     * Loads all scripts from `dir` in JS5Pack format.
     *
     * @param dir The directory that holds the `server.scripts.js5` file.
     * @returns The number of scripts loaded.
     */
    static load(dir: string): number {
        const js5Path = `${dir}/server/server.scripts.js5`;
        
        if (!Js5Archive.exists(js5Path)) {
            printFatalError(`No scripts found at ${js5Path}. Please compile scripts first.`);
        }

        const groups = Js5Archive.load(js5Path);
        return this.parseGroups(groups);
    }

    static async loadAsync(dir: string): Promise<number> {
        const js5Path = `${dir}/server/server.scripts.js5`;
        
        if (!Js5Archive.exists(js5Path)) {
            printFatalError(`No scripts found at ${js5Path}. Please compile scripts first.`);
        }

        const groups = await Js5Archive.loadAsync(js5Path);
        return this.parseGroups(groups);
    }

    private static parseGroups(groups: Map<number, Uint8Array>): number {
        try {
            if (groups.size === 0) {
                printFatalError('No scripts found in JS5 archive.');
                return -1;
            }

            const scriptArray = new Array<ScriptFile>(Math.max(...groups.keys()) + 1);
            const scriptNames = new Map<string, number>();
            const scriptLookup = new Map<number, ScriptFile>();

            let loaded = 0;

            // Sort by group ID to process in order
            const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);

            for (const [groupId, scriptData] of sortedGroups) {
                try {
                    const script = ScriptFile.decode(groupId, new Packet(scriptData));
                    scriptArray[groupId] = script;
                    scriptNames.set(script.name, groupId);

                    // add the script to lookup table if the value isn't -1
                    if (script.info.lookupKey !== 0xffffffff) {
                        scriptLookup.set(script.info.lookupKey, script);
                    }

                    loaded++;
                } catch (err) {
                    console.error(err);
                    printWarning(`Warning: Failed to load script ${groupId}, something may have been partially written`);
                    return -1;
                }
            }

            ScriptProvider.scripts = scriptArray;
            ScriptProvider.scriptNames = scriptNames;
            ScriptProvider.scriptLookup = scriptLookup;
            return loaded;
        } catch (err) {
            console.error(err);
            printFatalError('Failed to parse JS5 script archive.');
            return -1;
        }
    }

    /**
     * Finds a script by `id`.
     * @param id The script id to find.
     * @returns The script.
     */
    static get(id: number): ScriptFile | undefined {
        return this.scripts[id];
    }

    /**
     * Finds a script by `name`.
     * @param name The script name to find.
     * @returns The script.
     */
    static getByName(name: string): ScriptFile | undefined {
        const id = ScriptProvider.scriptNames.get(name);
        if (id === undefined) {
            return undefined;
        }
        return ScriptProvider.scripts[id];
    }

    /**
     * Used to look up a script by the `type` and `category`.
     *
     * This function will attempt to search for a script given the specific `type`,
     * if one is not found it attempts one for `category`, and if still not found
     * it will attempt for the global script.
     *
     * @param trigger The script trigger to find.
     * @param type The script subject type id.
     * @param category The script subject category id.
     */
    static getByTrigger(trigger: TargetOp, type: number = -1, category: number = -1): ScriptFile | undefined {
        let script = ScriptProvider.scriptLookup.get(trigger | (0x2 << 8) | (type << 10));
        if (script) {
            return script;
        }
        script = ScriptProvider.scriptLookup.get(trigger | (0x1 << 8) | (category << 10));
        if (script) {
            return script;
        }
        return ScriptProvider.scriptLookup.get(trigger);
    }

    /**
     * Used to look up a script by a specific combo. Does not attempt any other combinations.
     *
     * If `type` is not `-1`, only the `type` specific script will be looked up. Likewise
     * for `category`. If both `type` and `category` are `-1`, then only the global script
     * will be looked up.
     *
     * @param trigger The script trigger to find.
     * @param type The script subject type id.
     * @param category The script subject category id.
     */
    static getByTriggerSpecific(trigger: ServerTriggerType, type: number = -1, category: number = -1): ScriptFile | undefined {
        if (type !== -1) {
            return ScriptProvider.scriptLookup.get(trigger | (0x2 << 8) | (type << 10));
        } else if (category !== -1) {
            return ScriptProvider.scriptLookup.get(trigger | (0x1 << 8) | (category << 10));
        }
        return ScriptProvider.scriptLookup.get(trigger);
    }
}
