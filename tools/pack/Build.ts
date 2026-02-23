import { packAll } from '#tools/pack/PackAll.js';
import { printError } from '#/util/Logger.js';

try {
    console.time('pack');
    await packAll();
    console.timeEnd('pack');
} catch (err) {
    if (err instanceof Error) {
        printError(err);
    }

    process.exit(1);
}
