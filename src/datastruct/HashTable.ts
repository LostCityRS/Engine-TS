import Linkable from '#/datastruct/Linkable.js';

export default class HashTable<T extends Linkable> {
    readonly bucketCount: number;
    readonly buckets: T[];

    constructor(size: number) {
        this.buckets = new Array(size);
        this.bucketCount = size;

        for (let i: number = 0; i < size; i++) {
            const sentinel = (this.buckets[i] = new Linkable() as T);
            sentinel.next = sentinel;
            sentinel.prev = sentinel;
        }
    }

    find(key: bigint): T | null {
        const start: T = this.buckets[Number(key & BigInt(this.bucketCount - 1))];

        for (let node: T | null = start.next as T; node !== start; node = node?.next as T ?? null) {
            if (node && node.key === key) {
                return node;
            }
        }

        return null;
    }

    add(key: bigint, value: T): void {
        if (value.prev) {
            value.unlink();
        }

        const sentinel: T = this.buckets[Number(key & BigInt(this.bucketCount - 1))];
        value.prev = sentinel.prev;
        value.next = sentinel;
        if (value.prev) {
            value.prev.next = value;
        }
        value.next.prev = value;
        value.key = key;
    }

    findnext(node: Linkable): T | null {
        return node.next?.key !== 0n ? node.next as T : null;
    }

    *all(): IterableIterator<T> {
        for (let bucket = 0; bucket < this.bucketCount; bucket++) {
            let node = this.findnext(this.buckets[bucket]);

            while (node !== null) {
                yield node;

                node = this.findnext(node);
            }
        }
    }
}
