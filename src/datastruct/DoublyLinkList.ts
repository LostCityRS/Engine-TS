import DoublyLinkable from '#/datastruct/DoublyLinkable.js';

export default class DoublyLinkList<T extends DoublyLinkable> {
    private readonly sentinel: DoublyLinkable = new DoublyLinkable();
    public cursor: DoublyLinkable | null = null;

    constructor() {
        this.sentinel.next2 = this.sentinel;
        this.sentinel.prev2 = this.sentinel;
    }

    addTail(node: T): void {
        if (node.prev2) {
            node.unlink2();
        }
        node.prev2 = this.sentinel.prev2;
        node.next2 = this.sentinel;
        if (node.prev2) {
            node.prev2.next2 = node;
        }
        node.next2.prev2 = node;
    }

    removeHead(): T | null {
        const node: T | null = this.sentinel.next2 as T | null;
        if (node === this.sentinel) {
            return null;
        }
        node?.unlink2();
        return node;
    }

    head(): T | null {
        const node: T | null = this.sentinel.next2 as T | null;
        if (node === this.sentinel) {
            this.cursor = null;
            return null;
        }
        this.cursor = node?.next2 || null;
        return node;
    }

    tail(): T | null {
        const node: T | null = this.sentinel.prev2 as T | null;
        if (node === this.sentinel) {
            this.cursor = null;
            return null;
        }
        this.cursor = node?.prev2 || null;
        return node;
    }

    next(): T | null {
        const node: T | null = this.cursor as T | null;
        if (node === this.sentinel) {
            this.cursor = null;
            return null;
        }
        this.cursor = node?.next2 || null;
        return node;
    }

    prev(): T | null {
        const node: T | null = this.cursor as T | null;
        if (node === this.sentinel) {
            this.cursor = null;
            return null;
        }
        this.cursor = node?.prev2 || null;
        return node;
    }

    *all(reverse = false): IterableIterator<T> {
        if (reverse) {
            for (let link = this.tail(); link !== null; link = this.prev()) {
                const save = this.cursor;
                yield link;
                this.cursor = save;
            }
        } else {
            for (let link = this.head(); link !== null; link = this.next()) {
                const save = this.cursor;
                yield link;
                this.cursor = save;
            }
        }
    }
}
