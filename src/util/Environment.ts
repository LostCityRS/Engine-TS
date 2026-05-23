import { loadWorldConfig } from '#/util/WorldConfig.js';

const config = loadWorldConfig();

export default {
    runtime: {
        maxNpcs: 16383
    },
    ...config
};
