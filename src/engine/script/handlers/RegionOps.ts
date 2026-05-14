import { CoordGrid } from '#/engine/CoordGrid.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { ActiveRegion, checkedHandler } from '#/engine/script/ScriptPointer.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import { check, CoordValid, NumberPositive } from '#/engine/script/ScriptValidators.js';
import World from '#/engine/World.js';

const RegionOps: CommandHandlers = {
    [ScriptOpcode.REGION_CREATE]: state => {
        const secondary: number = state.intOperand;
        const [levels, zonesEast, zonesNorth] = state.popInts(3);

        check(levels, NumberPositive);
        check(zonesEast, NumberPositive);
        check(zonesNorth, NumberPositive);

        if (levels < 1 || levels > 4) {
            throw new Error(`region_create levels out of range: ${levels}. Expected 1..4.`);
        }

        // Instance slots are 16x16 zones inside a 128x128 footprint.
        if (zonesEast < 1 || zonesEast > 16) {
            throw new Error(`region_create zonesEast out of range: ${zonesEast}. Expected 1..16.`);
        }

        if (zonesNorth < 1 || zonesNorth > 16) {
            throw new Error(`region_create zonesNorth out of range: ${zonesNorth}. Expected 1..16.`);
        }

        const sw = World.instances.createInstance(levels, zonesEast, zonesNorth);
        const instance = World.instances.findInstanceByCoord(sw);
        if (!instance) {
            throw new Error('region_create failed to resolve created instance uid');
        }

        state.activeRegion = sw;
        state.activeRegionUid = instance.uid;
        state.pointerAdd(ActiveRegion[secondary]);
        state.pushInt(CoordGrid.packCoord(sw.level, sw.x, sw.z));
    },

    [ScriptOpcode.REGION_SET]: checkedHandler(ActiveRegion, state => {
        const [destLevel, destEast, destNorth, sourceCoord, rotation] = state.popInts(5);

        check(destLevel, NumberPositive);
        check(destEast, NumberPositive);
        check(destNorth, NumberPositive);
        const source: CoordGrid = check(sourceCoord, CoordValid);
        check(rotation, NumberPositive);

        if (destLevel < 0 || destLevel > 3) {
            throw new Error(`region_set destLevel out of range: ${destLevel}. Expected 0..3.`);
        }

        if (destEast < 0 || destEast > 15) {
            throw new Error(`region_set destEast out of range: ${destEast}. Expected 0..15.`);
        }

        if (destNorth < 0 || destNorth > 15) {
            throw new Error(`region_set destNorth out of range: ${destNorth}. Expected 0..15.`);
        }

        if (rotation < 0 || rotation > 3) {
            throw new Error(`region_set rotation out of range: ${rotation}. Expected 0..3.`);
        }

        World.instances.copyZone(state.activeRegion, { level: destLevel, x: destEast, z: destNorth }, source, rotation as 0 | 1 | 2 | 3);
    }),

    [ScriptOpcode.REGION_GETCOORD]: checkedHandler(ActiveRegion, state => {
        const [levelOffset, xOffset, zOffset] = state.popInts(3);

        check(levelOffset, NumberPositive);
        check(xOffset, NumberPositive);
        check(zOffset, NumberPositive);

        if (levelOffset < 0 || levelOffset > 3) {
            throw new Error(`region_getcoord levelOffset out of range: ${levelOffset}. Expected 0..3.`);
        }

        if (xOffset < 0 || xOffset > 127) {
            throw new Error(`region_getcoord xOffset out of range: ${xOffset}. Expected 0..127.`);
        }

        if (zOffset < 0 || zOffset > 127) {
            throw new Error(`region_getcoord zOffset out of range: ${zOffset}. Expected 0..127.`);
        }

        const coord = CoordGrid.packCoord(state.activeRegion.level + levelOffset, state.activeRegion.x + xOffset, state.activeRegion.z + zOffset);
        state.pushInt(coord);
    }),

    [ScriptOpcode.REGION_FINDBYCOORD]: state => {
        const coord: CoordGrid = check(state.popInt(), CoordValid);
        const secondary: number = state.intOperand;
        const instance = World.instances.findInstanceByCoord(coord);

        if (instance) {
            state.activeRegion = instance.sw;
            state.activeRegionUid = instance.uid;
            state.pointerAdd(ActiveRegion[secondary]);
            state.pushInt(1);
        } else {
            state.pushInt(0);
        }
    },

    [ScriptOpcode.REGION_UID]: checkedHandler(ActiveRegion, state => {
        state.pushInt(state.activeRegionUid);
    }),

    [ScriptOpcode.REGION_FINDBYUID]: state => {
        const uid: number = state.popInt();
        const secondary: number = state.intOperand;
        const instance = World.instances.findInstanceByUid(uid);

        if (instance) {
            state.activeRegion = instance.sw;
            state.activeRegionUid = instance.uid;
            state.pointerAdd(ActiveRegion[secondary]);
            state.pushInt(1);
        } else {
            state.pushInt(0);
        }
    },

    [ScriptOpcode.REGION_SETEXITCOORD]: checkedHandler(ActiveRegion, state => {
        const exitCoord: CoordGrid = check(state.popInt(), CoordValid);
        const instance = World.instances.findInstanceByCoord(state.activeRegion);
        if (!instance) {
            throw new Error('region_setexitcoord requires active_region to reference a valid instance');
        }

        instance.exitCoord = { level: exitCoord.level, x: exitCoord.x, z: exitCoord.z };
    })
};

export default RegionOps;
