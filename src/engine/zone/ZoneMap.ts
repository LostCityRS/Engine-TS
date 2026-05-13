import { CoordGrid } from '#/engine/CoordGrid.js';
import Zone from '#/engine/zone/Zone.js';
import ZoneGrid from '#/engine/zone/ZoneGrid.js';

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

    constructor() {
        this.zones = new Map();
        this.grids = new Map();
    }

    zone(x: number, z: number, level: number): Zone {
        const zoneIndex: number = ZoneMap.zoneIndex(x, z, level);
        const zone: Zone | undefined = this.zones.get(zoneIndex);
        if (typeof zone == 'undefined') {
            throw new Error(`Zone not initialized at x=${x}, z=${z}, level=${level}`);
        }
        return zone;
    }

    zoneByIndex(index: number): Zone {
        const zone: Zone | undefined = this.zones.get(index);
        if (typeof zone == 'undefined') {
            throw new Error(`Zone not initialized at index=${index}`);
        }
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
