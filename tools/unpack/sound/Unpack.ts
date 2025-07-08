import fs from 'fs';
import path from 'path';

import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { SynthPack } from '#/util/PackFile.js';
import { listFilesExt } from '#/util/Parse.js';
import { printWarning } from '#/util/Logger.js';

if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/sounds`)) {
    fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/sounds`, { recursive: true });
}

// let pack = '';

class Wave {
    static tracks: Wave[] = [];
    static order: number[] = [];

    static unpack(buf: Packet, keepNames: boolean = true) {
        if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/scripts/synth`)) {
            fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/scripts/synth`);
        }

        // can't trust synth IDs to remain stable
        const existingFiles = listFilesExt(`${Environment.BUILD_SRC_DIR}/synth`, '.synth');
        const crcs: Map<number, string> = new Map();

        if (!keepNames) {
            for (const file of existingFiles) {
                const data = fs.readFileSync(file);
                const crc = Packet.getcrc(data, 0, data.length);

                if (crcs.get(crc)) {
                    printWarning(`${file} has CRC collision with ${crcs.get(crc)}`);
                }
            
                crcs.set(crc, path.basename(file));
            }
        }

        const processed: string[] = [];
        while (buf.available > 0) {
            const id = buf.g2();
            if (id === 65535) {
                break;
            }

            this.order.push(id);

            const start = buf.pos;
            Wave.tracks[id] = new Wave();
            Wave.tracks[id].unpack(buf);
            const end = buf.pos;

            const data = new Uint8Array(end - start);
            buf.pos = start;
            buf.gdata(data, 0, data.length);

            const crc = Packet.getcrc(data, 0, data.length);

            if (!keepNames) {
                const existing = crcs.get(crc);

                if (existing && processed.indexOf(existing) === -1) {
                    SynthPack.register(id, path.basename(existing, path.extname(existing)));

                    const filePath = existingFiles.find(x => x.endsWith(`/${existing}`));
                    if (!filePath) {
                        printWarning(`${existing} should exist but does not`);

                        fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/synth/${existing}`, data);
                    } else {
                        fs.writeFileSync(filePath, data);
                    }

                    processed.push(existing);
                    continue;
                }
            }

            const name = SynthPack.getById(id) || `sound_${id}`;
            if (!SynthPack.getById(id)) {
                SynthPack.register(id, name);
            }

            const filePath = existingFiles.find(x => x.endsWith(`/${name}.synth`));
            if (!filePath) {
                fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/synth/${name}.synth`, data);
            } else {
                fs.writeFileSync(filePath, data);
            }
        }

        SynthPack.save();
        fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/pack/synth.order`, this.order.join('\n') + '\n');
    }

    tones: Tone[] = [];
    loopBegin = 0;
    loopEnd = 0;

    unpack(buf: Packet) {
        for (let i = 0; i < 10; i++) {
            if (buf.g1() != 0) {
                buf.pos--;

                this.tones[i] = new Tone();
                this.tones[i].unpack(buf);
            }
        }

        this.loopBegin = buf.g2();
        this.loopEnd = buf.g2();
    }
}

class Tone {
    frequencyBase: Envelope | null = null;
    amplitudeBase: Envelope | null = null;
    frequencyModRate: Envelope | null = null;
    frequencyModRange: Envelope | null = null;
    amplitudeModRate: Envelope | null = null;
    amplitudeModRange: Envelope | null = null;
    release: Envelope | null = null;
    attack: Envelope | null = null;
    harmonicVolume: number[] = [];
    harmonicSemitone: number[] = [];
    harmonicDelay: number[] = [];
    reverbDelay = 0;
    reverbVolume = 0;
    length = 0;
    start = 0;

    unpack(buf: Packet) {
        this.frequencyBase = new Envelope();
        this.frequencyBase.unpack(buf);

        this.amplitudeBase = new Envelope();
        this.amplitudeBase.unpack(buf);

        if (buf.g1() != 0) {
            buf.pos--;

            this.frequencyModRate = new Envelope();
            this.frequencyModRate.unpack(buf);

            this.frequencyModRange = new Envelope();
            this.frequencyModRange.unpack(buf);
        }

        if (buf.g1() != 0) {
            buf.pos--;

            this.amplitudeModRate = new Envelope();
            this.amplitudeModRate.unpack(buf);

            this.amplitudeModRange = new Envelope();
            this.amplitudeModRange.unpack(buf);
        }

        if (buf.g1() != 0) {
            buf.pos--;

            this.release = new Envelope();
            this.release.unpack(buf);

            this.attack = new Envelope();
            this.attack.unpack(buf);
        }

        for (let i = 0; i < 10; i++) {
            const volume = buf.gsmarts();
            if (volume === 0) {
                break;
            }

            this.harmonicVolume[i] = volume;
            this.harmonicSemitone[i] = buf.gsmart();
            this.harmonicDelay[i] = buf.gsmarts();
        }

        this.reverbDelay = buf.gsmarts();
        this.reverbVolume = buf.gsmarts();
        this.length = buf.g2();
        this.start = buf.g2();
    }
}

class Envelope {
    form = 0;
    start = 0;
    end = 0;
    length = 0;
    shapeDelta: number[] = [];
    shapePeak: number[] = [];

    unpack(buf: Packet) {
        this.form = buf.g1();
        this.start = buf.g4();
        this.end = buf.g4();

        this.length = buf.g1();
        for (let i = 0; i < this.length; i++) {
            this.shapeDelta[i] = buf.g2();
            this.shapePeak[i] = buf.g2();
        }
    }
}

const cache = new FileStream('data/unpack');
const sounds = new Jagfile(new Packet(cache.read(0, 8)!));
const soundsData = sounds.read('sounds.dat');

if (!soundsData) {
    throw new Error('missing sounds.dat');
}

Wave.unpack(soundsData);

// fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/pack/synth.pack`, pack);
// fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/pack/synth.order`, order);
