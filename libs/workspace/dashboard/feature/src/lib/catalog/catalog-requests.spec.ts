import { CatalogRequests } from './catalog-requests';

describe('CatalogRequests', () => {
    it('runs one task at a time, the waiting page work before the background', async () => {
        const requests = new CatalogRequests();
        const order: string[] = [];
        let running = 0;
        let most = 0;
        const task = (name: string) => async () => {
            most = Math.max(most, ++running);
            await Promise.resolve();
            order.push(name);
            running--;
            return name;
        };

        const done = Promise.all([
            requests.run(task('refresh 1'), 'background'),
            requests.run(task('refresh 2'), 'background'),
            requests.run(task('page 1')),
            requests.run(task('page 2')),
        ]);
        expect(requests.waiting()).toBe(4);

        await expect(done).resolves.toEqual([
            'refresh 1',
            'refresh 2',
            'page 1',
            'page 2',
        ]);
        expect(most).toBe(1);
        expect(order).toEqual(['page 1', 'page 2', 'refresh 1', 'refresh 2']);
    });

    it('goes on after a task that failed', async () => {
        const requests = new CatalogRequests();

        const failed = requests.run(() => Promise.reject(new Error('refused')));
        const next = requests.run(async () => 'next');

        await expect(failed).rejects.toThrow('refused');
        await expect(next).resolves.toBe('next');
    });
});
