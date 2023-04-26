import assert from 'node:assert';
import { runAssertion } from '../tools/runAssertion';

class TimeLimitedCache {
    private cache = new Map<number, {value: number, expiryMs: number}>();

    private isExpired (key: number): boolean {
        const valueFromCache = this.cache.get(key);
        if (!valueFromCache) return true;
        return valueFromCache.expiryMs < Date.now();
    }

    set(key: number, value: number, duration: number): boolean {
        const valueForKey = this.cache.get(key);

        if (valueForKey) {
            const isExpired = this.isExpired(key);

            if (isExpired) {
                this.cache.delete(key);
                this.cache.set(key, { value, expiryMs: Date.now() + duration });
            }

            return !isExpired;
        }

        this.cache.set(key, { value, expiryMs: Date.now() + duration });
        return false;
    }

    get(key: number): number {
        // undefined if empty from cache.
        const valueFromCache = this.cache.get(key);

        console.log(key, valueFromCache, Date.now());
        if (typeof valueFromCache?.value !== 'number') {
            return -1;
        }

        const valueIsExpired = this.isExpired(key);

        if (valueIsExpired) {
            return -1;
        }

        return valueFromCache.value;
    }

	count(): number {
        return Array.from(this.cache.values()).reduce((count, curr) => {
            if (curr.expiryMs < Date.now()) {
                count++;
                return count;
            }

            return count;
        }, 0)
    }
}

const test = new TimeLimitedCache();
test.set(1, 5, 100);
test.set(2, 50, 10000);

setTimeout(() => {
    runAssertion(() => {
        assert.equal(test.get(1), -1);
        assert.equal(test.get(2), 50);
        test.set(1, 300, 12000);
    })
}, 400)

setTimeout(() => {
    runAssertion(() => {
        assert.equal(test.get(1), 300);
        assert.equal(test.get(2), -1);   
    })
    process.exit(0);
}, 11000);

