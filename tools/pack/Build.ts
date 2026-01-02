import { packAll } from '#tools/pack/PackAll.js';
import Environment from '#/util/Environment.js';
import { updateCompiler } from '#/util/RuneScriptCompiler.js';
import { printError } from '#/util/Logger.js';

if (Environment.BUILD_STARTUP_UPDATE) {
    await updateCompiler();
}

try {
    console.time('pack');
    await packAll();
    console.timeEnd('pack');
} catch (err) {
    if (err instanceof Error) {
        printError(err.message);
    }

    process.exit(1);
}
