import { CoordGrid } from '#/engine/CoordGrid.js';
import { CollisionFlag } from '#/engine/routefinder/flags.js';
import routeFinder from '#/engine/routefinder/index.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Loc from '#/engine/entity/Loc.js';
import World from '#/engine/World.js';
import Zone from '#/engine/zone/Zone.js';
import ZoneMap from '#/engine/zone/ZoneMap.js';

// Live-entity position collision (set by changeNpc/changePlayer). This is transient
// world state, not part of a zone's static loc/floor/wall template, so it must not be
// copied into an instance — only loc/wall/floor/roof collision should transfer.
const ENTITY_COLLISION_MASK = CollisionFlag.NPC | CollisionFlag.PLAYER;

export default class InstanceZone extends Zone {
    source: CoordGrid;
    rotation: 0 | 1 | 2 | 3;
    private copiedFrom: boolean = false;

    constructor(index: number) {
        super(index);
        this.source = { level: 0, x: 0, z: 0 };
        this.rotation = 0;
    }

    get hasAssignedTemplate(): boolean {
        return this.copiedFrom;
    }

    /**
     * Copy entities (locations, objects, collision) from the source zone into this instance zone,
     * applying the specified rotation transformation.
     *
     * @param sourceZone The overworld zone to copy from.
     * @param rotation The rotation to apply (0, 1, 2, or 3).
     */
    copyFromZone(sourceZone: Zone, rotation: 0 | 1 | 2 | 3): void {
        this.assignSource(sourceZone.level, sourceZone.x, sourceZone.z, rotation);

        // Copy collision data with rotation applied
        this.copyCollisionWithRotation(sourceZone, rotation);

        // Copy locs with rotation applied
        this.copyLocsWithRotation(sourceZone, rotation);
    }

    /**
     * Record template metadata without copying locs or collision.
     * This exists for missing-source copies, which still consume the single
     * allowed assignment for the destination instance zone.
     */
    assignTemplate(source: CoordGrid, rotation: 0 | 1 | 2 | 3): void {
        this.assignSource(source.level, source.x >> 3, source.z >> 3, rotation);
    }

    private assignSource(sourceLevel: number, sourceZoneX: number, sourceZoneZ: number, rotation: 0 | 1 | 2 | 3): void {
        if (this.copiedFrom) {
            throw new Error('InstanceZone has already been copied from a source');
        }

        this.source = { level: sourceLevel, x: sourceZoneX, z: sourceZoneZ };
        this.rotation = rotation;
        this.copiedFrom = true;
    }

    private copyLocsWithRotation(sourceZone: Zone, rotation: 0 | 1 | 2 | 3): void {
        for (const sourceLoc of sourceZone.getAllLocsSafe()) {
            // Extract base properties (before any runtime changes)
            const baseType = sourceLoc.baseType;
            const baseShape = sourceLoc.baseShape;
            const baseAngle = sourceLoc.baseAngle;
            const sourceWidth = sourceLoc.width;
            const sourceLength = sourceLoc.length;
            let width = sourceWidth;
            let length = sourceLength;

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
                rotatedX = 8 - locZ - sourceLength;
                rotatedZ = locX;
                [width, length] = [length, width];
            } else if (rotation === 2) {
                // 180°
                rotatedX = 8 - locX - sourceWidth;
                rotatedZ = 8 - locZ - sourceLength;
            } else if (rotation === 3) {
                // 270° CW
                rotatedX = locZ;
                rotatedZ = 8 - locX - sourceWidth;
                [width, length] = [length, width];
            }

            // Rotate angle
            const rotatedAngle = ((baseAngle + rotation) & 0x3) as 0 | 1 | 2 | 3;

            // Compute absolute coordinates in instance zone.
            // this.x is zone-index (tile >> 3), so shift left to get the tile base.
            const absoluteX = (this.x << 3) + rotatedX;
            const absoluteZ = (this.z << 3) + rotatedZ;

            if (!World.gameMap.hasZone(absoluteX, absoluteZ, this.level)) {
                throw new Error(`Instance loc out of bounds: source=(${sourceLoc.x},${sourceLoc.z},L${sourceLoc.level}) rotated=(${absoluteX},${absoluteZ},L${this.level}) has no destination zone`);
            }

            const destinationZone = World.gameMap.getZone(absoluteX, absoluteZ, this.level);

            // Create new Loc with rotated properties
            const newLoc = new Loc(this.level, absoluteX, absoluteZ, width, length, sourceLoc.lifecycle, baseType, baseShape, rotatedAngle);

            if (sourceLoc.lifecycle === EntityLifeCycle.DESPAWN) {
                // Preserve dynamic loc semantics when the source loc is runtime-spawned.
                World.addLoc(newLoc, 0);
            } else {
                // Static locs stay attached to the zone that owns their rotated base tile.
                destinationZone.addStaticLoc(newLoc);
            }
        }
    }

    private copyCollisionWithRotation(sourceZone: Zone, rotation: 0 | 1 | 2 | 3): void {
        const sourceBaseX = sourceZone.x << 3;
        const sourceBaseZ = sourceZone.z << 3;
        const sourceCollision = routeFinder.collisionFlags.getZone(sourceBaseX, sourceBaseZ, sourceZone.level);
        if (!sourceCollision) {
            return; // No collision to copy
        }

        const destBaseX = this.x << 3;
        const destBaseZ = this.z << 3;
        const destCollision = routeFinder.collisionFlags.getZone(destBaseX, destBaseZ, this.level) ?? new Uint32Array(64);

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
            destCollision[dstIdx] |= rotatedFlags & ~ENTITY_COLLISION_MASK;
        }

        // Write rotated collision data to destination zone
        routeFinder.collisionFlags.setZone(destBaseX, destBaseZ, this.level, destCollision);

        // Copying a single 8x8 can miss the mirrored half of edge walls.
        // Emit outward-facing mirrors onto adjacent tiles so crossing the zone boundary
        // is blocked consistently even when neighboring zones are not copied.
        this.mirrorOutboundEdgeWalls(destCollision, destBaseX, destBaseZ, this.level);
    }

    private mirrorOutboundEdgeWalls(destCollision: Uint32Array, destBaseX: number, destBaseZ: number, level: number): void {
        const mirror = (flags: number, sourceMask: number, dstX: number, dstZ: number, mirrorMask: number): void => {
            if (flags & sourceMask && this.ensureMirrorDestinationZone(dstX, dstZ, level)) {
                routeFinder.collisionFlags.add(dstX, dstZ, level, mirrorMask);
            }
        };

        for (let localZ = 0; localZ < 8; localZ++) {
            const westFlags = destCollision[localZ << 3];
            mirror(westFlags, CollisionFlag.WALL_WEST, destBaseX - 1, destBaseZ + localZ, CollisionFlag.WALL_EAST);
            mirror(westFlags, CollisionFlag.WALL_WEST_PROJ_BLOCKER, destBaseX - 1, destBaseZ + localZ, CollisionFlag.WALL_EAST_PROJ_BLOCKER);
            mirror(westFlags, CollisionFlag.WALL_WEST_ROUTE_BLOCKER, destBaseX - 1, destBaseZ + localZ, CollisionFlag.WALL_EAST_ROUTE_BLOCKER);

            const eastFlags = destCollision[7 | (localZ << 3)];
            mirror(eastFlags, CollisionFlag.WALL_EAST, destBaseX + 8, destBaseZ + localZ, CollisionFlag.WALL_WEST);
            mirror(eastFlags, CollisionFlag.WALL_EAST_PROJ_BLOCKER, destBaseX + 8, destBaseZ + localZ, CollisionFlag.WALL_WEST_PROJ_BLOCKER);
            mirror(eastFlags, CollisionFlag.WALL_EAST_ROUTE_BLOCKER, destBaseX + 8, destBaseZ + localZ, CollisionFlag.WALL_WEST_ROUTE_BLOCKER);
        }

        for (let localX = 0; localX < 8; localX++) {
            const southFlags = destCollision[localX];
            mirror(southFlags, CollisionFlag.WALL_SOUTH, destBaseX + localX, destBaseZ - 1, CollisionFlag.WALL_NORTH);
            mirror(southFlags, CollisionFlag.WALL_SOUTH_PROJ_BLOCKER, destBaseX + localX, destBaseZ - 1, CollisionFlag.WALL_NORTH_PROJ_BLOCKER);
            mirror(southFlags, CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER, destBaseX + localX, destBaseZ - 1, CollisionFlag.WALL_NORTH_ROUTE_BLOCKER);

            const northFlags = destCollision[localX | (7 << 3)];
            mirror(northFlags, CollisionFlag.WALL_NORTH, destBaseX + localX, destBaseZ + 8, CollisionFlag.WALL_SOUTH);
            mirror(northFlags, CollisionFlag.WALL_NORTH_PROJ_BLOCKER, destBaseX + localX, destBaseZ + 8, CollisionFlag.WALL_SOUTH_PROJ_BLOCKER);
            mirror(northFlags, CollisionFlag.WALL_NORTH_ROUTE_BLOCKER, destBaseX + localX, destBaseZ + 8, CollisionFlag.WALL_SOUTH_ROUTE_BLOCKER);
        }

        const southWestFlags = destCollision[0];
        mirror(southWestFlags, CollisionFlag.WALL_SOUTH_WEST, destBaseX - 1, destBaseZ - 1, CollisionFlag.WALL_NORTH_EAST);
        mirror(southWestFlags, CollisionFlag.WALL_SOUTH_WEST_PROJ_BLOCKER, destBaseX - 1, destBaseZ - 1, CollisionFlag.WALL_NORTH_EAST_PROJ_BLOCKER);
        mirror(southWestFlags, CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER, destBaseX - 1, destBaseZ - 1, CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER);

        const southEastFlags = destCollision[7];
        mirror(southEastFlags, CollisionFlag.WALL_SOUTH_EAST, destBaseX + 8, destBaseZ - 1, CollisionFlag.WALL_NORTH_WEST);
        mirror(southEastFlags, CollisionFlag.WALL_SOUTH_EAST_PROJ_BLOCKER, destBaseX + 8, destBaseZ - 1, CollisionFlag.WALL_NORTH_WEST_PROJ_BLOCKER);
        mirror(southEastFlags, CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER, destBaseX + 8, destBaseZ - 1, CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER);

        const northWestFlags = destCollision[7 << 3];
        mirror(northWestFlags, CollisionFlag.WALL_NORTH_WEST, destBaseX - 1, destBaseZ + 8, CollisionFlag.WALL_SOUTH_EAST);
        mirror(northWestFlags, CollisionFlag.WALL_NORTH_WEST_PROJ_BLOCKER, destBaseX - 1, destBaseZ + 8, CollisionFlag.WALL_SOUTH_EAST_PROJ_BLOCKER);
        mirror(northWestFlags, CollisionFlag.WALL_NORTH_WEST_ROUTE_BLOCKER, destBaseX - 1, destBaseZ + 8, CollisionFlag.WALL_SOUTH_EAST_ROUTE_BLOCKER);

        const northEastFlags = destCollision[7 | (7 << 3)];
        mirror(northEastFlags, CollisionFlag.WALL_NORTH_EAST, destBaseX + 8, destBaseZ + 8, CollisionFlag.WALL_SOUTH_WEST);
        mirror(northEastFlags, CollisionFlag.WALL_NORTH_EAST_PROJ_BLOCKER, destBaseX + 8, destBaseZ + 8, CollisionFlag.WALL_SOUTH_WEST_PROJ_BLOCKER);
        mirror(northEastFlags, CollisionFlag.WALL_NORTH_EAST_ROUTE_BLOCKER, destBaseX + 8, destBaseZ + 8, CollisionFlag.WALL_SOUTH_WEST_ROUTE_BLOCKER);
    }

    private ensureMirrorDestinationZone(x: number, z: number, level: number): boolean {
        if (World.gameMap.hasZone(x, z, level)) {
            return true;
        }

        // Only materialize mirror destinations that are within an active instance footprint.
        if (!World.instances.findInstanceByTile(level, x, z)) {
            return false;
        }

        World.gameMap.createInstanceZone(ZoneMap.zoneIndex(x, z, level));
        routeFinder.allocateIfAbsent(x, z, level);
        return true;
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
