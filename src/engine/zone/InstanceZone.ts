import { CoordGrid } from '#/engine/CoordGrid.js';
import { CollisionFlag } from '#/engine/routefinder/flags.js';
import routeFinder from '#/engine/routefinder/index.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Loc from '#/engine/entity/Loc.js';
import World from '#/engine/World.js';
import Zone from '#/engine/zone/Zone.js';

export default class InstanceZone extends Zone {
    source: CoordGrid;
    rotation: 0 | 1 | 2 | 3;
    private copiedFrom: boolean = false;

    constructor(index: number) {
        super(index);
        this.source = { level: 0, x: 0, z: 0 };
        this.rotation = 0;
    }

    /**
     * Copy entities (locations, objects, collision) from the source zone into this instance zone,
     * applying the specified rotation transformation.
     *
     * @param sourceZone The overworld zone to copy from.
     * @param rotation The rotation to apply (0, 1, 2, or 3).
     */
    copyFromZone(sourceZone: Zone, rotation: 0 | 1 | 2 | 3): void {
        if (this.copiedFrom) {
            throw new Error('InstanceZone has already been copied from a source');
        }

        // Update source and rotation metadata
        this.source = { level: sourceZone.level, x: sourceZone.x, z: sourceZone.z };
        this.rotation = rotation;
        this.copiedFrom = true;

        // Copy collision data with rotation applied
        this.copyCollisionWithRotation(sourceZone, rotation);

        // Copy locs with rotation applied
        this.copyLocsWithRotation(sourceZone, rotation);
    }

    private copyLocsWithRotation(sourceZone: Zone, rotation: 0 | 1 | 2 | 3): void {
        for (const sourceLoc of sourceZone.getAllLocsSafe()) {
            // Extract base properties (before any runtime changes)
            const baseType = sourceLoc.baseType;
            const baseShape = sourceLoc.baseShape;
            const baseAngle = sourceLoc.baseAngle;
            let width = sourceLoc.width;
            let length = sourceLoc.length;

            // Get zone-relative tile coordinates (0-7 range).
            // sourceZone.x is already in zone-index units (tile >> 3), so shift left to
            // get the absolute tile base of the zone's SW corner.
            const locX = sourceLoc.x - (sourceZone.x << 3);
            const locZ = sourceLoc.z - (sourceZone.z << 3);

            // Rotate position and dimensions
            let rotatedX = locX;
            let rotatedZ = locZ;
            if (rotation === 1) {
                // 90° CW
                rotatedX = 7 - locZ;
                rotatedZ = locX;
                [width, length] = [length, width];
            } else if (rotation === 2) {
                // 180°
                rotatedX = 7 - locX;
                rotatedZ = 7 - locZ;
            } else if (rotation === 3) {
                // 270° CW
                rotatedX = locZ;
                rotatedZ = 7 - locX;
                [width, length] = [length, width];
            }

            // Skip any loc whose rotated base tile falls outside the 8×8 zone footprint.
            // Without this, World.addLoc would reach ZoneMap.zone() which auto-creates a
            // plain Zone outside the instance boundary.
            if (rotatedX < 0 || rotatedX > 7 || rotatedZ < 0 || rotatedZ > 7) {
                continue;
            }

            // Rotate angle
            const rotatedAngle = ((baseAngle + rotation) & 0x3) as 0 | 1 | 2 | 3;

            // Compute absolute coordinates in instance zone.
            // this.x is zone-index (tile >> 3), so shift left to get the tile base.
            const absoluteX = (this.x << 3) + rotatedX;
            const absoluteZ = (this.z << 3) + rotatedZ;

            // Create new Loc with rotated properties
            const newLoc = new Loc(this.level, absoluteX, absoluteZ, width, length, sourceLoc.lifecycle, baseType, baseShape, rotatedAngle);

            if (sourceLoc.lifecycle === EntityLifeCycle.DESPAWN) {
                // Preserve dynamic loc semantics when the source loc is runtime-spawned.
                World.addLoc(newLoc, 0);
            } else {
                // Instance rebuilds already make the client infer unchanged static locs from cache.
                // Copy them directly into the instance zone so server-side interaction lookup works.
                this.addStaticLoc(newLoc);
            }
        }
    }

    private copyCollisionWithRotation(sourceZone: Zone, rotation: 0 | 1 | 2 | 3): void {
        const sourceCollision = routeFinder.collisionFlags.getZone(sourceZone.index & 0x7ff, (sourceZone.index >> 11) & 0x7ff, (sourceZone.index >> 22) & 0x3);
        if (!sourceCollision) {
            return; // No collision to copy
        }

        const destCollision = new Uint32Array(64);

        // Iterate through the 8x8 zone and apply rotation transformations
        for (let srcIdx = 0; srcIdx < 64; srcIdx++) {
            const srcFlags = sourceCollision[srcIdx];
            if (srcFlags === CollisionFlag.OPEN) {
                continue; // Skip empty tiles
            }

            // Unpack source tile coordinates from linear index
            const srcX = srcIdx & 0x7;
            const srcZ = (srcIdx >> 3) & 0x7;

            // Rotate coordinates
            let dstX = srcX;
            let dstZ = srcZ;
            if (rotation === 1) {
                // 90° CW
                dstX = 7 - srcZ;
                dstZ = srcX;
            } else if (rotation === 2) {
                // 180°
                dstX = 7 - srcX;
                dstZ = 7 - srcZ;
            } else if (rotation === 3) {
                // 270° CW
                dstX = srcZ;
                dstZ = 7 - srcX;
            }

            const dstIdx = dstX | (dstZ << 3);
            const rotatedFlags = this.rotateCollisionFlags(srcFlags, rotation);
            destCollision[dstIdx] = rotatedFlags;
        }

        // Write rotated collision data to destination zone
        routeFinder.collisionFlags.setZone(this.index & 0x7ff, (this.index >> 11) & 0x7ff, (this.index >> 22) & 0x3, destCollision);
    }

    private rotateCollisionFlags(flags: number, rotation: 0 | 1 | 2 | 3): number {
        if (rotation === 0) {
            return flags;
        }

        let result = flags;

        // Extract directional wall flags
        const hasWallNorth = !!(flags & CollisionFlag.WALL_NORTH);
        const hasWallEast = !!(flags & CollisionFlag.WALL_EAST);
        const hasWallSouth = !!(flags & CollisionFlag.WALL_SOUTH);
        const hasWallWest = !!(flags & CollisionFlag.WALL_WEST);
        const hasWallNW = !!(flags & CollisionFlag.WALL_NORTH_WEST);
        const hasWallNE = !!(flags & CollisionFlag.WALL_NORTH_EAST);
        const hasWallSE = !!(flags & CollisionFlag.WALL_SOUTH_EAST);
        const hasWallSW = !!(flags & CollisionFlag.WALL_SOUTH_WEST);

        const hasWallNorthProj = !!(flags & CollisionFlag.WALL_NORTH_PROJ_BLOCKER);
        const hasWallEastProj = !!(flags & CollisionFlag.WALL_EAST_PROJ_BLOCKER);
        const hasWallSouthProj = !!(flags & CollisionFlag.WALL_SOUTH_PROJ_BLOCKER);
        const hasWallWestProj = !!(flags & CollisionFlag.WALL_WEST_PROJ_BLOCKER);
        const hasWallNWProj = !!(flags & CollisionFlag.WALL_NORTH_WEST_PROJ_BLOCKER);
        const hasWallNEProj = !!(flags & CollisionFlag.WALL_NORTH_EAST_PROJ_BLOCKER);
        const hasWallSEProj = !!(flags & CollisionFlag.WALL_SOUTH_EAST_PROJ_BLOCKER);
        const hasWallSWProj = !!(flags & CollisionFlag.WALL_SOUTH_WEST_PROJ_BLOCKER);

        const hasWallNorthRoute = !!(flags & CollisionFlag.WALL_NORTH_ROUTE_BLOCKER);
        const hasWallEastRoute = !!(flags & CollisionFlag.WALL_EAST_ROUTE_BLOCKER);
        const hasWallSouthRoute = !!(flags & CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER);
        const hasWallWestRoute = !!(flags & CollisionFlag.WALL_WEST_ROUTE_BLOCKER);
        const hasWallNWRoute = !!(flags & CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER);
        const hasWallNERoute = !!(flags & CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER);
        const hasWallSERoute = !!(flags & CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER);
        const hasWallSWRoute = !!(flags & CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER);

        // Clear all directional flags
        result &= ~(CollisionFlag.WALL_NORTH | CollisionFlag.WALL_EAST | CollisionFlag.WALL_SOUTH | CollisionFlag.WALL_WEST);
        result &= ~(CollisionFlag.WALL_NORTH_WEST | CollisionFlag.WALL_NORTH_EAST | CollisionFlag.WALL_SOUTH_EAST | CollisionFlag.WALL_SOUTH_WEST);
        result &= ~(CollisionFlag.WALL_NORTH_PROJ_BLOCKER | CollisionFlag.WALL_EAST_PROJ_BLOCKER | CollisionFlag.WALL_SOUTH_PROJ_BLOCKER | CollisionFlag.WALL_WEST_PROJ_BLOCKER);
        result &= ~(CollisionFlag.WALL_NORTH_WEST_PROJ_BLOCKER | CollisionFlag.WALL_NORTH_EAST_PROJ_BLOCKER | CollisionFlag.WALL_SOUTH_EAST_PROJ_BLOCKER | CollisionFlag.WALL_SOUTH_WEST_PROJ_BLOCKER);
        result &= ~(CollisionFlag.WALL_NORTH_ROUTE_BLOCKER | CollisionFlag.WALL_EAST_ROUTE_BLOCKER | CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER | CollisionFlag.WALL_WEST_ROUTE_BLOCKER);
        result &= ~(CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER | CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER | CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER | CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER);

        if (rotation === 1) {
            // 90° CW: N→E, E→S, S→W, W→N
            if (hasWallNorth) result |= CollisionFlag.WALL_EAST;
            if (hasWallEast) result |= CollisionFlag.WALL_SOUTH;
            if (hasWallSouth) result |= CollisionFlag.WALL_WEST;
            if (hasWallWest) result |= CollisionFlag.WALL_NORTH;
            if (hasWallNW) result |= CollisionFlag.WALL_NORTH_EAST;
            if (hasWallNE) result |= CollisionFlag.WALL_SOUTH_EAST;
            if (hasWallSE) result |= CollisionFlag.WALL_SOUTH_WEST;
            if (hasWallSW) result |= CollisionFlag.WALL_NORTH_WEST;
            if (hasWallNorthProj) result |= CollisionFlag.WALL_EAST_PROJ_BLOCKER;
            if (hasWallEastProj) result |= CollisionFlag.WALL_SOUTH_PROJ_BLOCKER;
            if (hasWallSouthProj) result |= CollisionFlag.WALL_WEST_PROJ_BLOCKER;
            if (hasWallWestProj) result |= CollisionFlag.WALL_NORTH_PROJ_BLOCKER;
            if (hasWallNWProj) result |= CollisionFlag.WALL_NORTH_EAST_PROJ_BLOCKER;
            if (hasWallNEProj) result |= CollisionFlag.WALL_SOUTH_EAST_PROJ_BLOCKER;
            if (hasWallSEProj) result |= CollisionFlag.WALL_SOUTH_WEST_PROJ_BLOCKER;
            if (hasWallSWProj) result |= CollisionFlag.WALL_NORTH_WEST_PROJ_BLOCKER;
            if (hasWallNorthRoute) result |= CollisionFlag.WALL_EAST_ROUTE_BLOCKER;
            if (hasWallEastRoute) result |= CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER;
            if (hasWallSouthRoute) result |= CollisionFlag.WALL_WEST_ROUTE_BLOCKER;
            if (hasWallWestRoute) result |= CollisionFlag.WALL_NORTH_ROUTE_BLOCKER;
            if (hasWallNWRoute) result |= CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER;
            if (hasWallNERoute) result |= CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER;
            if (hasWallSERoute) result |= CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER;
            if (hasWallSWRoute) result |= CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER;
        } else if (rotation === 2) {
            // 180°: N↔S, E↔W, NW↔SE, NE↔SW
            if (hasWallNorth) result |= CollisionFlag.WALL_SOUTH;
            if (hasWallEast) result |= CollisionFlag.WALL_WEST;
            if (hasWallSouth) result |= CollisionFlag.WALL_NORTH;
            if (hasWallWest) result |= CollisionFlag.WALL_EAST;
            if (hasWallNW) result |= CollisionFlag.WALL_SOUTH_EAST;
            if (hasWallNE) result |= CollisionFlag.WALL_SOUTH_WEST;
            if (hasWallSE) result |= CollisionFlag.WALL_NORTH_WEST;
            if (hasWallSW) result |= CollisionFlag.WALL_NORTH_EAST;
            if (hasWallNorthProj) result |= CollisionFlag.WALL_SOUTH_PROJ_BLOCKER;
            if (hasWallEastProj) result |= CollisionFlag.WALL_WEST_PROJ_BLOCKER;
            if (hasWallSouthProj) result |= CollisionFlag.WALL_NORTH_PROJ_BLOCKER;
            if (hasWallWestProj) result |= CollisionFlag.WALL_EAST_PROJ_BLOCKER;
            if (hasWallNWProj) result |= CollisionFlag.WALL_SOUTH_EAST_PROJ_BLOCKER;
            if (hasWallNEProj) result |= CollisionFlag.WALL_SOUTH_WEST_PROJ_BLOCKER;
            if (hasWallSEProj) result |= CollisionFlag.WALL_NORTH_WEST_PROJ_BLOCKER;
            if (hasWallSWProj) result |= CollisionFlag.WALL_NORTH_EAST_PROJ_BLOCKER;
            if (hasWallNorthRoute) result |= CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER;
            if (hasWallEastRoute) result |= CollisionFlag.WALL_WEST_ROUTE_BLOCKER;
            if (hasWallSouthRoute) result |= CollisionFlag.WALL_NORTH_ROUTE_BLOCKER;
            if (hasWallWestRoute) result |= CollisionFlag.WALL_EAST_ROUTE_BLOCKER;
            if (hasWallNWRoute) result |= CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER;
            if (hasWallNERoute) result |= CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER;
            if (hasWallSERoute) result |= CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER;
            if (hasWallSWRoute) result |= CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER;
        } else if (rotation === 3) {
            // 270° CW: N→W, W→S, S→E, E→N
            if (hasWallNorth) result |= CollisionFlag.WALL_WEST;
            if (hasWallEast) result |= CollisionFlag.WALL_NORTH;
            if (hasWallSouth) result |= CollisionFlag.WALL_EAST;
            if (hasWallWest) result |= CollisionFlag.WALL_SOUTH;
            if (hasWallNW) result |= CollisionFlag.WALL_SOUTH_WEST;
            if (hasWallNE) result |= CollisionFlag.WALL_NORTH_WEST;
            if (hasWallSE) result |= CollisionFlag.WALL_NORTH_EAST;
            if (hasWallSW) result |= CollisionFlag.WALL_SOUTH_EAST;
            if (hasWallNorthProj) result |= CollisionFlag.WALL_WEST_PROJ_BLOCKER;
            if (hasWallEastProj) result |= CollisionFlag.WALL_NORTH_PROJ_BLOCKER;
            if (hasWallSouthProj) result |= CollisionFlag.WALL_EAST_PROJ_BLOCKER;
            if (hasWallWestProj) result |= CollisionFlag.WALL_SOUTH_PROJ_BLOCKER;
            if (hasWallNWProj) result |= CollisionFlag.WALL_SOUTH_WEST_PROJ_BLOCKER;
            if (hasWallNEProj) result |= CollisionFlag.WALL_NORTH_WEST_PROJ_BLOCKER;
            if (hasWallSEProj) result |= CollisionFlag.WALL_NORTH_EAST_PROJ_BLOCKER;
            if (hasWallSWProj) result |= CollisionFlag.WALL_SOUTH_EAST_PROJ_BLOCKER;
            if (hasWallNorthRoute) result |= CollisionFlag.WALL_WEST_ROUTE_BLOCKER;
            if (hasWallEastRoute) result |= CollisionFlag.WALL_NORTH_ROUTE_BLOCKER;
            if (hasWallSouthRoute) result |= CollisionFlag.WALL_EAST_ROUTE_BLOCKER;
            if (hasWallWestRoute) result |= CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER;
            if (hasWallNWRoute) result |= CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER;
            if (hasWallNERoute) result |= CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER;
            if (hasWallSERoute) result |= CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER;
            if (hasWallSWRoute) result |= CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER;
        }

        return result;
    }
}
