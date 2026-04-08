import child_process from 'child_process';
import fs from 'fs';

import { confirm, input, number, password, select } from '@inquirer/prompts';

import { createDefaultWorldConfig, loadWorldConfig, saveWorldConfig, type WorldConfig } from '#/util/WorldConfig.js';

let config: WorldConfig = loadWorldConfig();

function persistConfig() {
    saveWorldConfig(config);
}

function resetConfig() {
    config = createDefaultWorldConfig();
    persistConfig();
}

function setWebPort(port: number) {
    config.web.port = port;
    persistConfig();
}

function setNodeId(id: number) {
    config.node.id = id + 9;
    persistConfig();
}

function setNodePort(port: number) {
    config.node.port = port;
    persistConfig();
}

function setNodeMembers(state: boolean) {
    config.node.members = state;
    persistConfig();
}

function setNodeXpRate(rate: number) {
    config.node.xpRate = rate;
    persistConfig();
}

function setNodeProduction(state: boolean) {
    config.node.production = state;
    config.node.debug = !state;
    persistConfig();
}

function setLoginServer(state: boolean, host?: string, port?: number) {
    config.login.enabled = state;

    if (typeof host === 'string' && typeof port === 'number') {
        config.login.host = host;
        config.login.port = port;
    }

    persistConfig();
}

function setFriendServer(state: boolean, host?: string, port?: number) {
    config.friend.enabled = state;

    if (typeof host === 'string' && typeof port === 'number') {
        config.friend.host = host;
        config.friend.port = port;
    }

    persistConfig();
}

function setLoggerServer(state: boolean, host?: string, port?: number) {
    config.logger.enabled = state;

    if (typeof host === 'string' && typeof port === 'number') {
        config.logger.host = host;
        config.logger.port = port;
    }

    persistConfig();
}

function setLocalSupportServers() {
    setLoginServer(true, 'localhost', 43500);
    setFriendServer(true, 'localhost', 45099);
    setLoggerServer(true, 'localhost', 43501);
}

function setDbBackend(backend: 'sqlite' | 'mysql') {
    config.db.backend = backend;
    persistConfig();
}

function setDatabase(host: string, port: number, name: string, user: string, pass: string) {
    config.db.host = host;
    config.db.port = port;
    config.db.name = name;
    config.db.user = user;
    config.db.pass = pass;
    persistConfig();
}

function setWebsiteRegistration(state: boolean) {
    config.website.registration = state;
    persistConfig();
}

function setEasyStartup(state: boolean) {
    config.easyStartup = state;
    persistConfig();
}

async function promptWebPort() {
    const port = await number({
        message: 'Set http port',
        default: config.web.port,
        required: true
    });

    setWebPort(port!);
}

async function promptNodeId() {
    const id = await number({
        message: 'Set world ID',
        default: Math.max(1, config.node.id - 9),
        required: true
    });

    setNodeId(id!);
}

async function promptNodePort() {
    const port = await number({
        message: 'Set world port',
        default: config.node.port,
        required: true
    });

    setNodePort(port!);
}

async function promptNodeMembers() {
    const choice = await confirm({
        message: 'Enable members content',
        default: config.node.members
    });

    setNodeMembers(choice);
}

async function promptNodeXpRate() {
    const rate = await number({
        message: 'Set world XP rate',
        default: config.node.xpRate,
        required: true
    });

    setNodeXpRate(rate!);
}

async function promptNodeProduction() {
    const choice = await confirm({
        message: 'Enable production mode',
        default: config.node.production
    });

    setNodeProduction(choice);
}

async function promptLogin() {
    const choice = await confirm({
        message: 'Do you want to use a login server to provide authentication?',
        default: true
    });

    if (choice) {
        const host = await input({
            message: 'Host address',
            default: config.login.host
        });

        const port = await number({
            message: 'Host port',
            default: config.login.port,
            required: true
        });

        setLoginServer(true, host, port!);
    } else {
        setLoginServer(false);
    }
}

async function promptFriend() {
    const choice = await confirm({
        message: 'Do you want to use a friend server to allow PMing?',
        default: true
    });

    if (choice) {
        const host = await input({
            message: 'Host address',
            default: config.friend.host
        });

        const port = await number({
            message: 'Host port',
            default: config.friend.port,
            required: true
        });

        setFriendServer(true, host, port!);
    } else {
        setFriendServer(false);
    }
}

async function promptLogger() {
    const choice = await confirm({
        message: 'Do you want to use a logger server to log player sessions?',
        default: true
    });

    if (choice) {
        const host = await input({
            message: 'Host address',
            default: config.logger.host
        });

        const port = await number({
            message: 'Host port',
            default: config.logger.port,
            required: true
        });

        setLoggerServer(true, host, port!);
    } else {
        setLoggerServer(false);
    }
}

async function promptDatabase() {
    const host = await input({
        message: 'Database host address',
        default: config.db.host
    });

    const port = await number({
        message: 'Database host port',
        default: config.db.port,
        required: true
    });

    const name = await input({
        message: 'Database name',
        default: config.db.name
    });

    const user = await input({
        message: 'Database user account',
        default: config.db.user
    });

    const pass = await password({
        message: 'Database user password'
    });

    setDatabase(host, port!, name, user, pass);
}

async function promptWebsiteRegistration() {
    const autoregister = await confirm({
        message: 'Do you want to automatically register accounts when they attempt to log in?',
        default: true
    });

    setWebsiteRegistration(!autoregister);
}

function runMigration(command: string) {
    child_process.execSync(command, {
        stdio: 'inherit'
    });
}

async function startup() {
    while (true) {
        const choices = [];

        if (fs.existsSync('data/pack')) {
            choices.push({
                name: 'Continue startup',
                value: 'continue'
            });
        }

        choices.push({
            name: 'Set up as a development world',
            description: 'Game server only, using sqlite',
            value: 'configure-dev'
        });

        choices.push({
            name: 'Set up as a full development stack',
            description: 'Includes login, friend, and logger servers',
            value: 'configure-dev-stack'
        });

        choices.push({
            name: 'Set up as a single world',
            value: 'configure-local'
        });

        choices.push({
            name: 'Set up as part of a multi-world infrastructure',
            value: 'configure-prod'
        });

        choices.push({
            name: 'Advanced options',
            value: 'advanced'
        });

        const action = await select({
            message: 'What would you like to do?',
            choices
        });

        switch (action) {
            case 'continue': {
                process.exit(0);
                break;
            }
            case 'configure-dev': {
                await configureDev();
                break;
            }
            case 'configure-dev-stack': {
                await configureDevStack();
                break;
            }
            case 'configure-local': {
                await configureSingle();
                break;
            }
            case 'configure-prod': {
                await configureMulti();
                break;
            }
            case 'advanced': {
                await advancedOptions();
                break;
            }
        }
    }
}

async function configureDev() {
    resetConfig();
    process.exit(0);
}

async function configureDevStack() {
    resetConfig();

    setWebsiteRegistration(false);
    setNodeProduction(false);

    const backend = await select({
        message: 'Choose a database backend',
        choices: [
            {
                name: 'SQLite',
                value: 'sqlite'
            },
            {
                name: 'MySQL',
                value: 'mysql'
            }
        ]
    });

    if (backend === 'sqlite') {
        setDbBackend('sqlite');
    } else if (backend === 'mysql') {
        setDbBackend('mysql');
        await promptDatabase();
    } else {
        console.error('Invalid database backend');
        process.exit(1);
    }

    setLocalSupportServers();
    setEasyStartup(true);

    if (backend === 'sqlite') {
        runMigration('bun run sqlite:migrate');
    } else {
        runMigration('bun run db:migrate');
    }

    process.exit(0);
}

async function configureSingle() {
    resetConfig();

    setNodeProduction(true);

    await promptNodeId();
    await promptNodeXpRate();
    await promptNodeMembers();

    setDbBackend('sqlite');
    await promptWebsiteRegistration();

    setLocalSupportServers();
    setEasyStartup(true);

    runMigration('bun run sqlite:migrate');
    process.exit(0);
}

async function configureMulti() {
    resetConfig();

    setWebsiteRegistration(true);
    setNodeProduction(true);

    await promptNodeId();
    await promptNodeXpRate();
    await promptNodeMembers();

    setDbBackend('mysql');
    await promptDatabase();
    await promptLogin();
    await promptWebsiteRegistration();
    await promptFriend();
    await promptLogger();

    runMigration('bun run db:migrate');

    process.exit(0);
}

async function advancedOptions() {
    const advanced = await select({
        message: 'Advanced options',
        pageSize: 24,
        choices: [
            {
                name: 'Go back',
                value: 'back'
            },
            {
                name: 'Set http port',
                value: 'web_port'
            },
            {
                name: 'Set world ID',
                value: 'node_id'
            },
            {
                name: 'Set world port',
                value: 'node_port'
            },
            {
                name: 'Disable members content',
                value: 'node_members'
            },
            {
                name: 'Set world XP rate',
                value: 'node_xprate'
            },
            {
                name: 'Enable production mode',
                value: 'node_production'
            },
            {
                name: 'Configure login server',
                value: 'login'
            },
            {
                name: 'Configure friend server',
                value: 'friend'
            },
            {
                name: 'Configure logger server',
                value: 'logger'
            },
            {
                name: 'Configure database connection',
                value: 'database'
            }
        ]
    });

    switch (advanced) {
        case 'web_port': {
            await promptWebPort();
            break;
        }
        case 'node_id': {
            await promptNodeId();
            break;
        }
        case 'node_port': {
            await promptNodePort();
            break;
        }
        case 'node_members': {
            await promptNodeMembers();
            break;
        }
        case 'node_xprate': {
            await promptNodeXpRate();
            break;
        }
        case 'node_production': {
            await promptNodeProduction();
            break;
        }
        case 'login': {
            await promptLogin();
            break;
        }
        case 'friend': {
            await promptFriend();
            break;
        }
        case 'logger': {
            await promptLogger();
            break;
        }
        case 'database': {
            await promptDatabase();
            break;
        }
    }
}

try {
    await startup();
} catch (_) {
    // no-op
}
