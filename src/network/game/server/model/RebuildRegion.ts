import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export type RegionTemplate = {
    level: number;
    zoneX: number;
    zoneZ: number;
    sourceLevel: number;
    sourceZoneX: number;
    sourceZoneZ: number;
    rotation: 0 | 1 | 2 | 3;
};

export function packRegionTemplate(template: RegionTemplate): number {
    // Matches client sceneMapRegion entry read via gBit(26).
    return ((template.sourceLevel & 0x3) << 24) | ((template.sourceZoneX & 0x3ff) << 14) | ((template.sourceZoneZ & 0x7ff) << 3) | ((template.rotation & 0x3) << 1);
}

export default class RebuildRegion extends ServerGameMessage {
    constructor(
        readonly zoneX: number,
        readonly zoneZ: number,
        readonly templates: RegionTemplate[]
    ) {
        super();
    }
}
