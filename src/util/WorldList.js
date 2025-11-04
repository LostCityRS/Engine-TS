import Packet from '#/io/Packet.js';
import { toTitleCase } from '#/util/JString.js';

const COUNTRY_FLAG = {
    UNITED_STATES: 0, // fallback flag actually
    AUSTRIA: 15,
    AUSTRALIA: 16,
    GERMANY: 22,
    BRAZIL: 31,
    CANADA: 38,
    SWITZERLAND: 43,
    CHINA: 48,
    DENMARK: 58,
    FINLAND: 69,
    FRANCE: 74,
    UNITED_KINGDOM: 77,
    IRELAND: 101,
    INDIA: 103,
    MEXICO: 152,
    NETHERLANDS: 161,
    NORWAY: 162,
    NEW_ZEALAND: 166,
    PORTUGAL: 179,
    SWEDEN: 191
};

let countries = [];
for (let i = 0; i < Object.keys(COUNTRY_FLAG).length; i++) {
    let name = Object.keys(COUNTRY_FLAG)[i];
    let displayName = toTitleCase(name.replace('_', ' ').toLowerCase());
    let flag = COUNTRY_FLAG[name];

    countries.push({
        flag,
        name: displayName
    });
}

const WorldList = [{
    id: 1,
    hostname: 'localhost',
    port: 40001,
    country: 0,
    activity: '',
    members: true,
    quickChat: false,
    pvp: false,
    lootShare: false,
    highlight: false,
    players: 0
}];

const buf = Packet.alloc(2);

buf.psmart(countries.length);
for (let i = 0; i < countries.length; i++) {
    let country = countries[i];
    buf.psmart(country.flag);
    buf.pjstr2(country.name);
}

let minId = WorldList.reduce((min, world) => Math.min(min, world.id), Infinity);
let maxId = WorldList.reduce((max, world) => Math.max(max, world.id), -Infinity);
let size = WorldList.length;

buf.psmart(minId);
buf.psmart(maxId);
buf.psmart(size);

for (let i = 0; i < WorldList.length; i++) {
    let world = WorldList[i];
    buf.psmart(world.id - minId);
    buf.p1(world.country);

    let flags = 0;

    if (world.members) {
        flags |= 0x1;
    }

    if (world.quickChat) {
        flags |= 0x2;
    }

    if (world.pvp) {
        flags |= 0x4;
    }

    if (world.lootShare) {
        flags |= 0x8;
    }

    if (world.activity && world.highlight) {
        flags |= 0x10;
    }

    buf.p4(flags);
    buf.pjstr2(world.activity); // if there is no activity name, client will fallback to country flag + name
    buf.pjstr2(world.hostname);
}

const WorldListBuf = buf.data.subarray(0, buf.pos);

export {
    WorldList,
    WorldListBuf
};
