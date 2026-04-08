import { loadWorldConfig } from '#/util/WorldConfig.js';

const config = loadWorldConfig();

export default {
    runtime: {
        isBun: typeof process.versions.bun !== 'undefined'
    },
    ...config
};
