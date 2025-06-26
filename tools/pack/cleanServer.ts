import fs from 'fs';

import Environment from '#/util/Environment.js';

function rmIfExists(path: string) {
    if (fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true });
    }
}

// clean up server cache in case statSync.mtimeMs is not letting it update
rmIfExists('data/pack/server/');

// clean up server packfiles, we can regen these safely, sometimes it can have old data inside
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/category.pack`);
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/enum.pack`);
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/param.pack`);
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/script.pack`);
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/struct.pack`);
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/mesanim.pack`);
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/dbrow.pack`);
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/dbtable.pack`);
rmIfExists(`${Environment.BUILD_SRC_DIR}/pack/hunt.pack`);

// these get rebuilt anyways but since we're here...
rmIfExists('data/symbols/');
