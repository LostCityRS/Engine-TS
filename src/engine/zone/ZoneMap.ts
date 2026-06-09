import { CoordGrid } from '#/engine/CoordGrid.js';
import Zone from '#/engine/zone/Zone.js';
import ZoneGrid from '#/engine/zone/ZoneGrid.js';
import InstanceZone from '#/engine/zone/InstanceZone.js';

export default class ZoneMap {
    static zoneIndex(x: number, z: number, level: number): number {
        return ((x >> 3) & 0x7ff) | (((z >> 3) & 0x7ff) << 11) | ((level & 0x3) << 22);
    }

    static unpackIndex(index: number): CoordGrid {
        const x: number = (index & 0x7ff) << 3;
        const z: number = ((index >> 11) & 0x7ff) << 3;
        const level: number = index >> 22;
        return { x, z, level };
    }

    private readonly zones: Map<number, Zone>;
    private readonly grids: Map<number, ZoneGrid>;
    private isInitializing: boolean = false;

    constructor() {
        this.zones = new Map();
        this.grids = new Map();
    }

    /**
     * Call before loading map data to allow zone auto-creation.
     */
    beginInitialization(): void {
        this.isInitializing = true;
    }

    /**
     * Call after loading map data to lock down zone creation.
     */
    endInitialization(): void {
        this.isInitializing = false;
    }

    /**
     * Check if zone map is currently initializing (during map load).
     */
    isInitializingMap(): boolean {
        return this.isInitializing;
    }

    /**
     * Get an existing zone, or auto-create it during initialization.
     * After initialization completes, zones must be pre-created or use getZoneIfExists().
     * @throws Error if zone doesn't exist and initialization is complete.
     */
    getZone(x: number, z: number, level: number): Zone {
        const zoneIndex: number = ZoneMap.zoneIndex(x, z, level);
        let zone: Zone | undefined = this.zones.get(zoneIndex);

        if (typeof zone === 'undefined') {
            if (this.isInitializing) {
                // Auto-create zone only during initialization
                zone = new Zone(zoneIndex);
                this.zones.set(zoneIndex, zone);
            } else {
                // Enforce zone pre-creation after initialization
                throw new Error(`Zone does not exist at (${x}, ${z}, L${level}). Zones must be pre-created during world startup.`);
            }
        }
        return zone;
    }

    /**
     * Get an existing zone by index, or auto-create it during initialization.
     * After initialization completes, zones must be pre-created or use getZoneIfExists().
     * @throws Error if zone doesn't exist and initialization is complete.
     */
    getZoneByIndex(index: number): Zone {
        let zone: Zone | undefined = this.zones.get(index);

        if (typeof zone === 'undefined') {
            if (this.isInitializing) {
                // Auto-create zone only during initialization
                zone = new Zone(index);
                this.zones.set(index, zone);
            } else {
                // Enforce zone pre-creation after initialization
                const unpacked = ZoneMap.unpackIndex(index);
                throw new Error(`Zone does not exist at (${unpacked.x}, ${unpacked.z}, L${unpacked.level}). Zones must be pre-created during world startup.`);
            }
        }
        return zone;
    }

    /**
     * Get an existing zone by index, or null if it doesn't exist.
     * Use this only for optional zone lookups where missing zones are expected.
     */
    getZoneByIndexIfExists(index: number): Zone | null {
        return this.zones.get(index) ?? null;
    }

    /**
     * Get an existing zone, or null if it doesn't exist.
     * Use this only for optional zone lookups where missing zones are expected.
     */
    getZoneIfExists(x: number, z: number, level: number): Zone | null {
        const zoneIndex: number = ZoneMap.zoneIndex(x, z, level);
        return this.zones.get(zoneIndex) ?? null;
    }

    /**
     * Create a new Zone and register it. Only called during world startup or instance creation.
     */
    createZone(x: number, z: number, level: number): Zone {
        const zoneIndex: number = ZoneMap.zoneIndex(x, z, level);
        if (this.zones.has(zoneIndex)) {
            throw new Error(`Zone already exists at (${x}, ${z}, L${level})`);
        }
        const zone = new Zone(zoneIndex);
        this.zones.set(zoneIndex, zone);
        return zone;
    }

    /**
     * Create a new InstanceZone and register it. Only called during instance creation.
     */
    createInstanceZone(zoneIndex: number): Zone {
        if (this.zones.has(zoneIndex)) {
            throw new Error(`Zone already exists at index ${zoneIndex}`);
        }
        const zone = new InstanceZone(zoneIndex);
        this.zones.set(zoneIndex, zone);
        return zone;
    }

    hasZone(x: number, z: number, level: number): boolean {
        return this.zones.has(ZoneMap.zoneIndex(x, z, level));
    }

    addZone(zone: Zone): Zone {
        this.zones.set(zone.index, zone);
        return zone;
    }

    removeZone(index: number): boolean {
        return this.zones.delete(index);
    }

    grid(level: number): ZoneGrid {
        let grid: ZoneGrid | undefined = this.grids.get(level);
        if (typeof grid == 'undefined') {
            grid = new ZoneGrid();
            this.grids.set(level, grid);
        }
        return grid;
    }

    zoneCount(): number {
        return this.zones.size;
    }

    locCount(): number {
        let total: number = 0;
        for (const zone of this.zones.values()) {
            total += zone.totalLocs;
        }
        return total;
    }

    objCount(): number {
        let total: number = 0;
        for (const zone of this.zones.values()) {
            total += zone.totalObjs;
        }
        return total;
    }
}
