import fs from 'fs';

type Synth = {
    id: number;
    name: string;
}

type SynthDirectory = {
    name: string;
    parentDirectory: string | null;
    synths: Synth[];
    childDirectories: SynthDirectory[];
}

const tree = JSON.parse(fs.readFileSync('data/pack/synths.json', 'utf-8')) as SynthDirectory;

function scanDirectory(dir: SynthDirectory, fullPath: string = '') {
    const current = `${fullPath}/${dir.name}`;

    for (const child of dir.childDirectories) {
        scanDirectory(child, current);
    }

    for (const synth of dir.synths) {
        fs.appendFileSync('data/pack/dir.txt', `${synth.id}=${current.substring(7)}/${synth.name}.synth\n`);
    }
}

fs.writeFileSync('data/pack/dir.txt', '');
scanDirectory(tree);
