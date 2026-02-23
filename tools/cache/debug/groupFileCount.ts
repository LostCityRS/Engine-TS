import { getGroup } from '#/util/OpenRS2.js';
import { parseJs5ArchiveIndex } from '#/io/Js5ArchiveIndex.js';
import { unpackJs5Group } from '#/io/Js5Group.js';

type Args = {
    archive: number;
    group: number;
};

function parseArgs(argv: string[]): Args | null {
    let archive: number | undefined;
    let group: number | undefined;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--archive') {
            archive = Number(argv[++i]);
        } else if (arg === '--group') {
            group = Number(argv[++i]);
        } else if (arg === '--help' || arg === '-h') {
            return null;
        }
    }

    if (archive === undefined || group === undefined) {
        return null;
    }

    return { archive, group };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args) {
        process.exit(1);
    }

    const indexData = await getGroup(255, args.archive);
    const indexUnpacked = unpackJs5Group(indexData);
    const { fileIdsByGroup } = parseJs5ArchiveIndex(indexUnpacked);

    const fileIds = fileIdsByGroup.get(args.group);

    if (!fileIds) {
        console.log(`Archive ${args.archive}, Group ${args.group}: No files found (group does not exist)`);
        process.exit(0);
    }

    console.log(`Archive ${args.archive}, Group ${args.group}: ${fileIds.length} files`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
