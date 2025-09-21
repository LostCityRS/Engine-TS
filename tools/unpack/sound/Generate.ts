import fs from 'fs';
import child_process from 'child_process';

const dir = 'data/pack/377-synth';
const files = fs.readdirSync(dir);

for (const file of files) {
    try {
        if (file.endsWith('.wav.wav')) {
            fs.unlinkSync(`${dir}/${file}`);
            continue;
        }

        if (file.endsWith('.wav')) {
            continue;
        }

        if (!fs.existsSync(`${dir}/${file}.wav`)) {
            child_process.execSync(`java -cp data/pack/rs2client.jar jagex2.client.SoundSynth ${dir}/${file}`, { stdio: 'inherit' });
        }
    } catch (_) {
        console.error(file);
    }
}
