import { CoordGrid } from '#/engine/CoordGrid.js';
import Zone from '#/engine/zone/Zone.js';

export default class InstanceZone extends Zone {
    readonly source: CoordGrid;
    readonly rotation: 0 | 1 | 2 | 3;

    constructor(index: number, source: CoordGrid, rotation: 0 | 1 | 2 | 3) {
        super(index);
        this.source = { ...source };
        this.rotation = rotation;
    }
}
