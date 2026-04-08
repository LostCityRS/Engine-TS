import { loadWorldConfig } from '#/util/WorldConfig.js';

const config = loadWorldConfig();

export default {
    runtime: {
        isBun: typeof process.versions.bun !== 'undefined',
        maxNpcs: 16383
    },
    ...config
};
