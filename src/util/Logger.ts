import { EventEmitter } from 'events';
import kleur from 'kleur';

const loggerEmitter = new EventEmitter();

export function onFatalError(listener: (message: string) => void | Promise<void>) {
    loggerEmitter.on('fatal', listener);
}

export function printDebug(message: string) {
    const now = new Date();

    // todo: print based on env variable
    console.log(kleur.magenta(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}\t`), kleur.cyan('DEBUG\t'), message);
}

export function printInfo(message: string) {
    const now = new Date();

    console.log(kleur.magenta(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}\t`), kleur.green('INFO\t'), message);
}

export function printError(message: string) {
    const now = new Date();

    console.error(kleur.magenta(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}\t`), kleur.red('ERROR\t'), message);
}

export function printFatalError(message: string) {
    const now = new Date();

    console.error(kleur.magenta(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}\t`), kleur.red('ERROR\t'), message);

    const listeners = loggerEmitter.listeners('fatal') as Array<(m: string) => void | Promise<void>>;
    Promise.all(listeners.map(l => l(message))).finally(() => process.exit(1));
}

export function printWarning(message: string) {
    const now = new Date();

    console.log(kleur.magenta(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}\t`), kleur.yellow('WARN\t'), message);
}
