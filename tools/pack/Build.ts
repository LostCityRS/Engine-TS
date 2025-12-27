import { packAll } from '#tools/pack/PackAll.js';
import Environment from '#/util/Environment.js';
import { updateCompiler } from '#/util/RuneScriptCompiler.js';

if (Environment.BUILD_STARTUP_UPDATE) {
    await updateCompiler();
}

try {
    const modelFlags: number[] = [];
    console.time('pack');
    await packAll(modelFlags);
    console.timeEnd('pack');
} catch (err) {
    if (err instanceof Error) {
        console.log(err.message);
    }

    process.exit(1);
}
