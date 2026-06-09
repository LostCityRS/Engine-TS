import { CoordGrid } from '#/engine/CoordGrid.js';
import { isZoneAllocated } from '#/engine/GameMap.js';
import routeFinder from '#/engine/routefinder/index.js';
import World from '#/engine/World.js';
import InstanceZone from '#/engine/zone/InstanceZone.js';
import ZoneMap from '#/engine/zone/ZoneMap.js';
import { printDebug } from '#/util/Logger.js';

type InstanceRecord = {
    uid: number;
    sw: CoordGrid;
    floors: number;
    zonesEast: number;
    zonesNorth: number;
    exitCoord: CoordGrid | null;
};

export default class InstanceController {
    static readonly FIRST_INSTANCE_SW_MAPSQUARE: number = 25857; // m101_1

    static readonly INSTANCES_PER_ROW: number = 32;
    static readonly INSTANCE_ROWS: number = 64;
    static readonly TOTAL_INSTANCES: number = InstanceController.INSTANCES_PER_ROW * InstanceController.INSTANCE_ROWS;

    static readonly INSTANCE_SIZE_TILES: number = 128;
    static readonly INSTANCE_GAP_TILES: number = 64;
    static readonly INSTANCE_SW_STRIDE_TILES: number = InstanceController.INSTANCE_SIZE_TILES + InstanceController.INSTANCE_GAP_TILES;
    static readonly MAX_MISSING_SOURCE_ZONE_LOGS: number = 5;
    static readonly DEBUG_INSTANCE_COPY_VERBOSE: boolean = false;

    nextInstancePointer: number = 0;
    readonly instances: InstanceRecord[] = [];
    private missingSourceZoneLogCount: number = 0;

    // ---
    // Public methods
    // ---

    /**
     * Create a new instance record and reserve a slot in the global instance grid.
     * This exists to give scripts a stable instance identity/footprint first,
     * while zones are materialized lazily as each chunk is copied in.
     */
    createInstance(floors: number, zonesEast: number, zonesNorth: number): CoordGrid {
        this.missingSourceZoneLogCount = 0;

        // Reclaim all stale instance slots, then find the next available slot pointer.
        if (InstanceController.DEBUG_INSTANCE_COPY_VERBOSE) {
            printDebug(`[Instance] createInstance request floors=${floors}, zonesEast=${zonesEast}, zonesNorth=${zonesNorth}, nextPointer=${this.nextInstancePointer}`);
        }
        this.clearStaleInstances();
        this.findNextSlot();

        // Instances are laid out in a fixed grid of 128x128 tiles, with a 64-tile buffer between them.
        const slotX: number = this.nextInstancePointer % InstanceController.INSTANCES_PER_ROW;
        const slotZ: number = Math.trunc(this.nextInstancePointer / InstanceController.INSTANCES_PER_ROW);
        const firstMapsquareX: number = InstanceController.FIRST_INSTANCE_SW_MAPSQUARE >> 8;
        const firstMapsquareZ: number = InstanceController.FIRST_INSTANCE_SW_MAPSQUARE & 0xff;
        const baseTileX: number = (firstMapsquareX << 6) + slotX * InstanceController.INSTANCE_SW_STRIDE_TILES;
        const baseTileZ: number = (firstMapsquareZ << 6) + slotZ * InstanceController.INSTANCE_SW_STRIDE_TILES;
        const uid: number = this.nextInstancePointer;
        const sw: CoordGrid = { level: 0, x: baseTileX, z: baseTileZ };
        if (InstanceController.DEBUG_INSTANCE_COPY_VERBOSE) {
            printDebug(`[Instance] selected slot pointer=${uid}, slot=(${slotX},${slotZ}), sw=(${sw.x},${sw.z},L0)`);
        }

        // Keep only the instance metadata here; zones are materialized lazily when copied from the overworld.
        this.instances.push({
            uid,
            sw,
            floors,
            zonesEast,
            zonesNorth,
            exitCoord: null
        });

        this.incrementSlotPointer();
        return sw;
    }

    /**
     * Copy one source zone into a destination chunk of an existing instance.
     * This is purposed to be the single controlled path for lazy instance chunk
     * creation, bounds enforcement, and source->instance template assignment.
     */
    copyZone(instanceSw: CoordGrid, instanceOffset: CoordGrid, source: CoordGrid, rotation: 0 | 1 | 2 | 3): void {
        const instance = this.instances.find(candidate => candidate.sw.level === instanceSw.level && candidate.sw.x === instanceSw.x && candidate.sw.z === instanceSw.z);
        if (!instance) {
            throw new Error(`copyZone failed: instance not found at sw=(${instanceSw.x}, ${instanceSw.z}, L${instanceSw.level})`);
        }

        if (instanceOffset.level < 0 || instanceOffset.level >= instance.floors || instanceOffset.x < 0 || instanceOffset.x >= instance.zonesEast || instanceOffset.z < 0 || instanceOffset.z >= instance.zonesNorth) {
            throw new Error(
                `copyZone out of bounds: offset=(${instanceOffset.x}, ${instanceOffset.z}, L${instanceOffset.level}) size=(${instance.zonesEast}, ${instance.zonesNorth}, floors=${instance.floors}) sw=(${instanceSw.x}, ${instanceSw.z}, L${instanceSw.level})`
            );
        }

        const target: CoordGrid = {
            level: instanceSw.level + instanceOffset.level,
            x: instanceSw.x + (instanceOffset.x << 3),
            z: instanceSw.z + (instanceOffset.z << 3)
        };

        // Multiway is a per-zone flag independent of whether the source Zone is materialized, so
        // propagate it here to cover both the copyFromZone and assignTemplate paths. SET (add/delete)
        // so a reused slot copying a non-multi source clears any stale multi flag.
        World.gameMap.setMultiZone(ZoneMap.zoneIndex(target.x, target.z, target.level), World.gameMap.isMultiZone(ZoneMap.zoneIndex(source.x, source.z, source.level)));

        const targetZone = this.ensureInstanceZone(target.x, target.z, target.level);
        const sourceZone = World.gameMap.getZoneIfExists(source.x, source.z, source.level);

        if (!sourceZone) {
            // Keep template metadata so client rebuild can still draw this chunk,
            // even when the source zone is not materialized server-side.
            targetZone.assignTemplate(source, rotation);

            if (InstanceController.DEBUG_INSTANCE_COPY_VERBOSE) {
                if (this.missingSourceZoneLogCount < InstanceController.MAX_MISSING_SOURCE_ZONE_LOGS) {
                    printDebug(`[Instance] copyZone skipped: source zone missing src=(${source.x},${source.z},L${source.level}) -> dst=(${target.x},${target.z},L${target.level})`);
                } else if (this.missingSourceZoneLogCount === InstanceController.MAX_MISSING_SOURCE_ZONE_LOGS) {
                    printDebug('[Instance] copyZone: additional missing source-zone logs suppressed for this instance creation');
                }
            }
            this.missingSourceZoneLogCount++;
            return;
        }

        targetZone.copyFromZone(sourceZone, rotation);
        if (InstanceController.DEBUG_INSTANCE_COPY_VERBOSE) {
            printDebug(`[Instance] Zone copy complete: src=(${source.x},${source.z},L${source.level}) -> dst=(${target.x},${target.z},L${target.level}) rot=${rotation} locs=${targetZone.totalLocs}`);
            for (const loc of targetZone.getAllLocsSafe()) {
                printDebug(`  [Loc] type=${loc.type} at (${loc.x},${loc.z},L${loc.level}) shape=${loc.shape} angle=${loc.angle} active=${loc.isActive}`);
            }
        }
    }

    /**
     * Check whether an instance has any players in currently materialized zones.
     * This exists to support reclaiming empty instances and avoid accumulating
     * stale zones/collision state.
     */
    isInstanceEmpty(instance: InstanceRecord): boolean {
        // Any player in any zone covered by this instance means the instance is still in use.
        for (let level: number = 0; level < instance.floors; level++) {
            const actualLevel: number = instance.sw.level + level;
            for (let east: number = 0; east < instance.zonesEast; east++) {
                for (let north: number = 0; north < instance.zonesNorth; north++) {
                    const x: number = instance.sw.x + (east << 3);
                    const z: number = instance.sw.z + (north << 3);
                    const zone = World.gameMap.getZoneIfExists(x, z, actualLevel);
                    if (zone && zone.hasPlayers()) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * Resolve an instance by absolute coordinate.
     * This exists for callers that start from packed/world coordinates and need
     * to recover instance context.
     */
    findInstanceByCoord(coord: CoordGrid): InstanceRecord | null {
        return this.findInstanceByTile(coord.level, coord.x, coord.z);
    }

    /**
     * Resolve an instance by raw level/x/z tile values.
     * This is the core containment test used by teleport/login/instance checks.
     */
    findInstanceByTile(level: number, x: number, z: number): InstanceRecord | null {
        for (const instance of this.instances) {
            // Check if tile falls within this instance's footprint
            if (level >= instance.sw.level && level < instance.sw.level + instance.floors && x >= instance.sw.x && x < instance.sw.x + (instance.zonesEast << 3) && z >= instance.sw.z && z < instance.sw.z + (instance.zonesNorth << 3)) {
                return instance;
            }
        }
        return null;
    }

    /**
     * Resolve an instance by its stable uid.
     * This exists because script/runtime flows store uid handles and need
     * deterministic lookup.
     */
    findInstanceByUid(uid: number): InstanceRecord | null {
        for (const instance of this.instances) {
            if (instance.uid === uid) {
                return instance;
            }
        }
        return null;
    }

    // ---
    // Private methods
    // ---

    /**
     * Reclaim all stale instance records that no longer contain players.
     * This is purposed to keep slot reuse and cleanup opportunistic during
     * instance creation.
     */
    private clearStaleInstances(): void {
        // Walk backward so removals do not disturb the remaining indices.
        for (let index: number = this.instances.length - 1; index >= 0; index--) {
            const instance: InstanceRecord = this.instances[index];
            if (!this.isInstanceEmpty(instance)) {
                continue;
            }

            this.deleteInstance(instance);
            this.instances.splice(index, 1);
        }
    }

    /**
     * Select the next free slot pointer in the instance grid.
     * This exists to prevent slot collisions and keep instance placement
     * deterministic.
     */
    private findNextSlot(): void {
        // Track occupied slots from active instance records to skip them during probing.
        const occupiedSlots: Set<number> = new Set();
        for (const instance of this.instances) {
            occupiedSlots.add(instance.uid);
        }

        if (InstanceController.DEBUG_INSTANCE_COPY_VERBOSE) {
            printDebug(`[Instance] findNextSlot start: nextPointer=${this.nextInstancePointer}, activeInstances=${this.instances.length}, occupiedSlots=${occupiedSlots.size}`);
        }

        for (let attempts: number = 0; attempts < InstanceController.TOTAL_INSTANCES; attempts++) {
            const pointer: number = (this.nextInstancePointer + attempts) % InstanceController.TOTAL_INSTANCES;
            if (occupiedSlots.has(pointer)) {
                continue;
            }

            const slotX: number = pointer % InstanceController.INSTANCES_PER_ROW;
            const slotZ: number = Math.trunc(pointer / InstanceController.INSTANCES_PER_ROW);
            const firstMapsquareX: number = InstanceController.FIRST_INSTANCE_SW_MAPSQUARE >> 8;
            const firstMapsquareZ: number = InstanceController.FIRST_INSTANCE_SW_MAPSQUARE & 0xff;
            const swX: number = (firstMapsquareX << 6) + slotX * InstanceController.INSTANCE_SW_STRIDE_TILES;
            const swZ: number = (firstMapsquareZ << 6) + slotZ * InstanceController.INSTANCE_SW_STRIDE_TILES;
            const allocated: boolean = isZoneAllocated(0, swX, swZ);
            const hasZone: boolean = World.gameMap.hasZone(swX, swZ, 0);

            // If this slot's SW zone is occupied, the slot is considered in use.
            if (allocated || hasZone) {
                if (InstanceController.DEBUG_INSTANCE_COPY_VERBOSE && attempts < 10) {
                    printDebug(`[Instance] slot ${pointer} blocked: sw=(${swX},${swZ},L0) allocated=${allocated} hasZone=${hasZone}`);
                }
                continue;
            }

            if (InstanceController.DEBUG_INSTANCE_COPY_VERBOSE) {
                printDebug(`[Instance] slot ${pointer} available: sw=(${swX},${swZ},L0)`);
            }
            this.nextInstancePointer = pointer;
            return;
        }

        throw new Error('[InstanceController] No available instance slots found.');
    }

    /**
     * Advance the slot pointer with wrap-around.
     * This is purposed to keep scanning fair across the fixed-capacity
     * instance grid.
     */
    private incrementSlotPointer(): void {
        this.nextInstancePointer = (this.nextInstancePointer + 1) % InstanceController.TOTAL_INSTANCES;
    }

    /**
     * Tear down all materialized zones and collision in the instance footprint.
     * This exists so slot reuse cannot leak world-state from prior instances.
     */
    private deleteInstance(instance: InstanceRecord): void {
        printDebug(`[Instance] deleting instance uid=${instance.uid} sw=(${instance.sw.x},${instance.sw.z},L${instance.sw.level}) floors=${instance.floors} size=${instance.zonesEast}x${instance.zonesNorth}`);

        // Remove each zone in the instance footprint from the live zone map and collision data.
        for (let level: number = 0; level < instance.floors; level++) {
            const actualLevel: number = instance.sw.level + level;
            for (let east: number = 0; east < instance.zonesEast; east++) {
                for (let north: number = 0; north < instance.zonesNorth; north++) {
                    const x: number = instance.sw.x + (east << 3);
                    const z: number = instance.sw.z + (north << 3);
                    const zone = World.gameMap.getZoneIfExists(x, z, actualLevel);
                    if (zone) {
                        for (const npc of Array.from(zone.getAllNpcsUnsafe(true))) {
                            World.removeNpc(npc, -1);
                        }

                        for (const loc of Array.from(zone.getAllLocsUnsafe(true))) {
                            World.removeLoc(loc, 0);
                            // removeLoc early-returns for inactive (respawn-pending) locs without clearing
                            // their pending lifecycle event. Clear it explicitly so an orphaned event can't
                            // later fire turn()/addLoc into this removed zone (zone-does-not-exist warning +
                            // negative-lifecycle-tick error).
                            loc.setLifeCycle(-1);
                        }

                        for (const obj of Array.from(zone.getAllObjsUnsafe(true))) {
                            World.removeObj(obj, 0);
                            obj.setLifeCycle(-1);
                        }
                    }

                    World.gameMap.removeZone(ZoneMap.zoneIndex(x, z, actualLevel));
                    // Clean up collision data for this zone
                    routeFinder.deallocateIfPresent(x, z, actualLevel);
                    // Clear any multiway flag so a reused slot starts clean
                    World.gameMap.setMultiZone(ZoneMap.zoneIndex(x, z, actualLevel), false);
                }
            }
        }

        printDebug(`[Instance] deleted instance uid=${instance.uid}`);
    }

    /**
     * Ensure a destination instance zone exists and has collision storage allocated.
     * This exists because chunks are created lazily and copy operations need a
     * safe one-stop materializer.
     */
    private ensureInstanceZone(x: number, z: number, level: number): InstanceZone {
        const zoneIndex: number = ZoneMap.zoneIndex(x, z, level);
        const existingZone = World.gameMap.getZoneIfExists(x, z, level);

        if (!existingZone) {
            const zone = World.gameMap.createInstanceZone(zoneIndex) as InstanceZone;
            routeFinder.allocateIfAbsent(x, z, level);
            return zone;
        }

        if (!(existingZone instanceof InstanceZone)) {
            throw new Error(`Instance zone collision at (${x}, ${z}, L${level})`);
        }

        return existingZone;
    }
}
