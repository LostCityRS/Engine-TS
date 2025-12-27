import Packet from '#/io/Packet.js';

class Metadata {
    data: Uint8Array | null = null;
    vertexCount: number = 0;
    faceCount: number = 0;
    texturedFaceCount: number = 0;
    vertexFlagsOffset: number = -1;
    vertexXOffset: number = -1;
    vertexYOffset: number = -1;
    vertexZOffset: number = -1;
    vertexLabelsOffset: number = -1;
    faceVerticesOffset: number = -1;
    faceOrientationsOffset: number = -1;
    faceColoursOffset: number = -1;
    faceInfosOffset: number = -1;
    facePrioritiesOffset: number = 0;
    faceAlphasOffset: number = -1;
    faceLabelsOffset: number = -1;
    faceTextureAxisOffset: number = -1;
}

export default class Model {
    static loaded: number = 0;
    vertexLabel: Int32Array | null = null;
    faceLabel: Int32Array | null = null;
    static meta: (Metadata | null)[] = [];
    vertexCount: number = 0;
    faceCount: number = 0;
    texturedFaceCount: number = 0;
    vertexX: Int32Array | null = null;
    vertexY: Int32Array | null = null;
    vertexZ: Int32Array | null = null;
    faceVertexA: Int32Array | null = null;
    faceVertexB: Int32Array | null = null;
    faceVertexC: Int32Array | null = null;
    texturedVertexA: Int32Array | null = null;
    texturedVertexB: Int32Array | null = null;
    texturedVertexC: Int32Array | null = null;
    faceInfo: Int32Array | null = null;
    facePriority: Int32Array | null = null;
    priority: number = 0;
    faceAlpha: Int32Array | null = null;
    faceColour: Int32Array | null = null;
    faceColourA: Int32Array | null = null;
    faceColourB: Int32Array | null = null;
    faceColourC: Int32Array | null = null;

    static unpack(id: number, data: Uint8Array | null) {
        if (!data) {
            const info = (Model.meta[id] = new Metadata());
            info.vertexCount = 0;
            info.faceCount = 0;
            info.texturedFaceCount = 0;
            return;
        }

        if (Model.meta[id]) {
            return;
        }

        const buf = new Packet(data);
        buf.pos = data.length - 18;

        const info = (Model.meta[id] = new Metadata());
        info.data = data;
        info.vertexCount = buf.g2();
        info.faceCount = buf.g2();
        info.texturedFaceCount = buf.g1();

        const hasInfo = buf.g1();
        const priority = buf.g1();
        const hasAlpha = buf.g1();
        const hasFaceLabels = buf.g1();
        const hasVertexLabels = buf.g1();
        const dataLengthX = buf.g2();
        const dataLengthY = buf.g2();
        const dataLengthZ = buf.g2();
        const dataLengthFaceOrientations = buf.g2();

        let pos = 0;
        info.vertexFlagsOffset = pos;

        pos += info.vertexCount;
        info.faceOrientationsOffset = pos;

        pos += info.faceCount;

        info.facePrioritiesOffset = pos;
        if (priority == 255) {
            pos += info.faceCount;
        } else {
            info.facePrioritiesOffset = -priority - 1;
        }

        info.faceLabelsOffset = pos;
        if (hasFaceLabels == 1) {
            pos += info.faceCount;
        } else {
            info.faceLabelsOffset = -1;
        }

        info.faceInfosOffset = pos;
        if (hasInfo == 1) {
            pos += info.faceCount;
        } else {
            info.faceInfosOffset = -1;
        }

        info.vertexLabelsOffset = pos;
        if (hasVertexLabels == 1) {
            pos += info.vertexCount;
        } else {
            info.vertexLabelsOffset = -1;
        }

        info.faceAlphasOffset = pos;
        if (hasAlpha == 1) {
            pos += info.faceCount;
        } else {
            info.faceAlphasOffset = -1;
        }

        info.faceVerticesOffset = pos;
        pos += dataLengthFaceOrientations;

        info.faceColoursOffset = pos;
        pos += info.faceCount * 2;

        info.faceTextureAxisOffset = pos;
        pos += info.texturedFaceCount * 6;

        info.vertexXOffset = pos;
        pos += dataLengthX;

        info.vertexYOffset = pos;
        pos += dataLengthY;

        info.vertexZOffset = pos;
        pos += dataLengthZ;
    }

    static fromId(id: number): Model {
        if (!Model.meta || !Model.meta[id]) {
            return new Model();
        }

        Model.loaded++;

        const info = Model.meta[id];
        if (!info.data) {
            return new Model();
        }

        const model = new Model();
        model.vertexCount = info.vertexCount;
        model.faceCount = info.faceCount;
        model.texturedFaceCount = info.texturedFaceCount;
        model.vertexX = new Int32Array(model.vertexCount);
        model.vertexY = new Int32Array(model.vertexCount);
        model.vertexZ = new Int32Array(model.vertexCount);
        model.faceVertexA = new Int32Array(model.faceCount);
        model.faceVertexB = new Int32Array(model.faceCount);
        model.faceVertexC = new Int32Array(model.faceCount);
        model.texturedVertexA = new Int32Array(model.texturedFaceCount);
        model.texturedVertexB = new Int32Array(model.texturedFaceCount);
        model.texturedVertexC = new Int32Array(model.texturedFaceCount);

        if (info.vertexLabelsOffset >= 0) {
            model.vertexLabel = new Int32Array(model.vertexCount);
        }

        if (info.faceInfosOffset >= 0) {
            model.faceInfo = new Int32Array(model.faceCount);
        }

        if (info.facePrioritiesOffset >= 0) {
            model.facePriority = new Int32Array(model.faceCount);
        } else {
            model.priority = -info.facePrioritiesOffset - 1;
        }

        if (info.faceAlphasOffset >= 0) {
            model.faceAlpha = new Int32Array(model.faceCount);
        }

        if (info.faceLabelsOffset >= 0) {
            model.faceLabel = new Int32Array(model.faceCount);
        }

        model.faceColour = new Int32Array(model.faceCount);

        const point1 = new Packet(info.data);
        point1.pos = info.vertexFlagsOffset;

        const point2 = new Packet(info.data);
        point2.pos = info.vertexXOffset;

        const point3 = new Packet(info.data);
        point3.pos = info.vertexYOffset;

        const point4 = new Packet(info.data);
        point4.pos = info.vertexZOffset;

        const point5 = new Packet(info.data);
        point5.pos = info.vertexLabelsOffset;

        let dx = 0;
        let dy = 0;
        let dz = 0;
        for (let v = 0; v < model.vertexCount; v++) {
            const flags = point1.g1();

            let a = 0;
            if ((flags & 0x1) != 0) {
                a = point2.gsmart();
            }

            let b = 0;
            if ((flags & 0x2) != 0) {
                b = point3.gsmart();
            }

            let c = 0;
            if ((flags & 0x4) != 0) {
                c = point4.gsmart();
            }

            model.vertexX[v] = dx + a;
            model.vertexY[v] = dy + b;
            model.vertexZ[v] = dz + c;
            dx = model.vertexX[v];
            dy = model.vertexY[v];
            dz = model.vertexZ[v];

            if (model.vertexLabel != null) {
                model.vertexLabel[v] = point5.g1();
            }
        }

        const face1 = new Packet(info.data);
        face1.pos = info.faceColoursOffset;

        const face2 = new Packet(info.data);
        face2.pos = info.faceInfosOffset;

        const face3 = new Packet(info.data);
        face3.pos = info.facePrioritiesOffset;

        const face4 = new Packet(info.data);
        face4.pos = info.faceAlphasOffset;

        const face5 = new Packet(info.data);
        face5.pos = info.faceLabelsOffset;

        for (let f = 0; f < model.faceCount; f++) {
            model.faceColour[f] = face1.g2();

            if (model.faceInfo != null) {
                model.faceInfo[f] = face2.g1();
            }

            if (model.facePriority != null) {
                model.facePriority[f] = face3.g1();
            }

            if (model.faceAlpha != null) {
                model.faceAlpha[f] = face4.g1();
            }

            if (model.faceLabel != null) {
                model.faceLabel[f] = face5.g1();
            }
        }

        const vertex1 = new Packet(info.data);
        vertex1.pos = info.faceVerticesOffset;

        const vertex2 = new Packet(info.data);
        vertex2.pos = info.faceOrientationsOffset;

        let a = 0;
        let b = 0;
        let c = 0;
        let last = 0;

        for (let f = 0; f < model.faceCount; f++) {
            const orientation = vertex2.g1();
            if (orientation == 1) {
                a = vertex1.gsmart() + last;
                b = vertex1.gsmart() + a;
                c = vertex1.gsmart() + b;
                last = c;
            } else if (orientation == 2) {
                // a = a;
                b = c;
                c = vertex1.gsmart() + last;
                last = c;
            } else if (orientation == 3) {
                a = c;
                // b = b;
                c = vertex1.gsmart() + last;
                last = c;
            } else if (orientation == 4) {
                const tmp = a;
                a = b;
                b = tmp;
                c = vertex1.gsmart() + last;
                last = c;
            }

            model.faceVertexA[f] = a;
            model.faceVertexB[f] = b;
            model.faceVertexC[f] = c;
        }

        const axis = new Packet(info.data);
        axis.pos = info.faceTextureAxisOffset;

        for (let f = 0; f < model.texturedFaceCount; f++) {
            model.texturedVertexA[f] = axis.g2();
            model.texturedVertexB[f] = axis.g2();
            model.texturedVertexC[f] = axis.g2();
        }

        return model;
    }
}

export function modelHasTexture(modelId: number, textureId: number): boolean {
    const model = Model.fromId(modelId);
    if (!model || !model.faceColour || !model.texturedFaceCount) {
        return false;
    }

    // todo: ignore transparent faces?
    for (let i = 0; i < model.faceCount; i++) {
        if (model.faceInfo && (model.faceInfo[i] & 0x3) > 1 && model.faceColour[i] === textureId) {
            return true;
        }
    }

    return false;
}

export function modelsHaveTexture(modelIds: number[], textureId: number): boolean {
    for (let i = 0; i < modelIds.length; i++) {
        if (modelHasTexture(modelIds[i], textureId)) {
            return true;
        }
    }

    return false;
}
