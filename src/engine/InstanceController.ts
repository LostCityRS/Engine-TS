import { CoordGrid } from '#/engine/CoordGrid.js';
import { isZoneAllocated } from '#/engine/GameMap.js';
import routeFinder from '#/engine/routefinder/index.js';
import World from '#/engine/World.js';
import InstanceZone from '#/engine/zone/InstanceZone.js';

type InstanceRecord = {
    sw: CoordGrid;
    floors: number;
    zonesEast: number;
    zonesNorth: number;
};

export default class InstanceController {
    static readonly FIRST_INSTANCE_SW_MAPSQUARE: number = 25857; // m101_1

    static readonly INSTANCES_PER_ROW: number = 32;
    static readonly INSTANCE_ROWS: number = 64;
    static readonly TOTAL_INSTANCES: number = InstanceController.INSTANCES_PER_ROW * InstanceController.INSTANCE_ROWS;

    static readonly INSTANCE_SIZE_TILES: number = 128;
    static readonly INSTANCE_GAP_TILES: number = 64;
    static readonly INSTANCE_SW_STRIDE_TILES: number = InstanceController.INSTANCE_SIZE_TILES + InstanceController.INSTANCE_GAP_TILES;

    nextInstancePointer: number = 0;
    readonly instances: InstanceRecord[] = [];

    // ---
    // Public methods
    // ---

    createInstance(floors: number, zonesEast: number, zonesNorth: number): CoordGrid {
        // Reclaim all stale instance slots, then find the next available slot pointer.
        this.clearStaleInstances();
        this.findNextSlot();

        // Instances are laid out in a fixed grid of 128x128 tiles, with a 64-tile buffer between them.
        const slotX: number = this.nextInstancePointer % InstanceController.INSTANCES_PER_ROW;
        const slotZ: number = Math.trunc(this.nextInstancePointer / InstanceController.INSTANCES_PER_ROW);
        const baseX: number = 101 + slotX * 3;
        const baseZ: number = 1 + slotZ * 3;
        const sw: CoordGrid = { level: 0, x: baseX << 3, z: baseZ << 3 };

        // Keep the instance metadata so we can later detect when it becomes empty again.
        this.instances.push({
            sw,
            floors,
            zonesEast,
            zonesNorth
        });

        // Materialize the instance zones directly into the game's zone map.
        for (let level: number = 0; level < floors; level++) {
            for (let east: number = 0; east < zonesEast; east++) {
                for (let north: number = 0; north < zonesNorth; north++) {
                    const x: number = (baseX + east) << 3;
                    const z: number = (baseZ + north) << 3;
                    const zoneIndex: number = CoordGrid.packCoord(level, x, z);
                    const zone: InstanceZone = new InstanceZone(zoneIndex);
                    World.gameMap.addZone(zone);
                }
            }
        }

        this.incrementSlotPointer();
        return sw;
    }

    copyZone(instanceSw: CoordGrid, instanceOffset: CoordGrid, source: CoordGrid, rotation: 0 | 1 | 2 | 3): void {
        const target: CoordGrid = {
            level: instanceSw.level + instanceOffset.level,
            x: instanceSw.x + (instanceOffset.x << 3),
            z: instanceSw.z + (instanceOffset.z << 3)
        };

        const targetZone = World.gameMap.getZone(target.x, target.z, target.level);
        const sourceZone = World.gameMap.getZone(source.x, source.z, source.level);

        if (targetZone instanceof InstanceZone) {
            targetZone.copyFromZone(sourceZone, rotation);
        }
    }

    isInstanceEmpty(instance: InstanceRecord): boolean {
        // Any player in any zone covered by this instance means the instance is still in use.
        for (let level: number = 0; level < instance.floors; level++) {
            for (let east: number = 0; east < instance.zonesEast; east++) {
                for (let north: number = 0; north < instance.zonesNorth; north++) {
                    const x: number = instance.sw.x + (east << 3);
                    const z: number = instance.sw.z + (north << 3);
                    const zone = World.gameMap.getZone(x, z, level);
                    if (zone.hasPlayers()) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * Find an instance that contains the given coordinate.
     * @param coord The coordinate to search for.
     * @returns The instance record if found, null otherwise.
     */
    findInstanceByCoord(coord: CoordGrid): InstanceRecord | null {
        for (const instance of this.instances) {
            // Check if coord falls within this instance's footprint
            if (
                coord.level >= instance.sw.level &&
                coord.level < instance.sw.level + instance.floors &&
                coord.x >= instance.sw.x &&
                coord.x < instance.sw.x + (instance.zonesEast << 3) &&
                coord.z >= instance.sw.z &&
                coord.z < instance.sw.z + (instance.zonesNorth << 3)
            ) {
                return instance;
            }
        }
        return null;
    }

    // ---
    // Private methods
    // ---

    // Remove all stale instances before selecting the next slot.
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

    // Find the next pointer that is both unoccupied by records and unallocated on the map.
    private findNextSlot(): void {
        // Track occupied slots from active instance records to skip them during probing.
        const occupiedSlots: Set<number> = new Set();
        for (const instance of this.instances) {
            occupiedSlots.add(this.getSlotPointer(instance.sw));
        }

        for (let attempts: number = 0; attempts < InstanceController.TOTAL_INSTANCES; attempts++) {
            const pointer: number = (this.nextInstancePointer + attempts) % InstanceController.TOTAL_INSTANCES;
            if (occupiedSlots.has(pointer)) {
                continue;
            }

            const slotX: number = pointer % InstanceController.INSTANCES_PER_ROW;
            const slotZ: number = Math.trunc(pointer / InstanceController.INSTANCES_PER_ROW);
            const swX: number = (101 + slotX * 3) << 3;
            const swZ: number = (1 + slotZ * 3) << 3;

            if (isZoneAllocated(0, swX, swZ)) {
                continue;
            }

            this.nextInstancePointer = pointer;
            return;
        }

        throw new Error('[InstanceController] No available instance slots found.');
    }

    // Move pointer forward by one slot and wrap around at capacity.
    private incrementSlotPointer(): void {
        this.nextInstancePointer = (this.nextInstancePointer + 1) % InstanceController.TOTAL_INSTANCES;
    }

    // Convert a recorded southwest coordinate back into its slot index.
    private getSlotPointer(sw: CoordGrid): number {
        const zoneX: number = sw.x >> 3;
        const zoneZ: number = sw.z >> 3;
        const slotX: number = Math.trunc((zoneX - 101) / 3);
        const slotZ: number = Math.trunc((zoneZ - 1) / 3);
        return slotZ * InstanceController.INSTANCES_PER_ROW + slotX;
    }

    // Remove every zone belonging to this instance footprint from the world map.
    private deleteInstance(instance: InstanceRecord): void {
        // Remove each zone in the instance footprint from the live zone map and collision data.
        for (let level: number = 0; level < instance.floors; level++) {
            for (let east: number = 0; east < instance.zonesEast; east++) {
                for (let north: number = 0; north < instance.zonesNorth; north++) {
                    const x: number = instance.sw.x + (east << 3);
                    const z: number = instance.sw.z + (north << 3);
                    World.gameMap.removeZone(CoordGrid.packCoord(level, x, z));
                    // Clean up collision data for this zone
                    routeFinder.collisionFlags.deallocateIfPresent(x, z, level);
                }
            }
        }
    }
}
