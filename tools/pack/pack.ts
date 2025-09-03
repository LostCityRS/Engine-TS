import { packClient, packServer } from '#/cache/PackAll.js';
import Environment from '#/util/Environment.js';
import { updateCompiler } from '#/util/RuneScriptCompiler.js';

if (Environment.BUILD_STARTUP_UPDATE) {
    await updateCompiler();
}

try {
    const modelFlags: number[] = [];
    console.time('pack');
    await packClient(modelFlags);
    await packServer();
    console.timeEnd('pack');
} catch (err) {
    if (err instanceof Error) {
        console.log(err);
    }

    process.exit(1);
}
