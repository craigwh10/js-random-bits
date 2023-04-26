import type { Request, Response } from 'express';
import got from 'got';

interface RequestQueueItem {
    request: Request
    response: Response
    addedAt: number
    memoryNeededMb: number
}

export class RequestQueue {
    private queue: RequestQueueItem[] = [];
    private limit: number = 10;

    constructor (limit: number) {
        this.limit = limit;
    }
    
    get size () {
        return this.queue.length;
    }

    addToQueue (request: Request, response: Response, memoryNeededMb: number) {
        console.log({limit: this.limit, size: this.size});
        if (this.limit > this.size + 1) {
            this.queue.push({request, response, addedAt: Date.now(), memoryNeededMb});
            return true;
        }

        return false;
    }

    get firstInQueue () {
        return this.queue[0];
    }

    processFirstInQueue () {
        return this.queue.pop();
    }
}

export class RedirectionHandler {
    private queue: RequestQueue;
    private isPolling: boolean = false;
    private redirectionList: string[];

    constructor (queue: RequestQueue, redirectionList: string[]) {
        this.queue = queue;
        this.redirectionList = redirectionList;
    }

    /**
     * will poll the servers on their readiness endpoint
     * to see if they're ready for the first request in the poll.
     */
    initPollForFIFORedirection (pollTimeMs: number = 5000) {
        setInterval(async () => {
            if (!this.queue.size) {
                this.isPolling = false;
                return;
            };

            // don't allow overpolling - 1 at a time, but any request can trigger the server poll.
            if (this.isPolling) return;
            
            const firstInQueue = this.queue.firstInQueue;

            this.isPolling = true;


            const firstReadyUrl = await Promise.race(
                // @OPTIMISATION:
                // Cancel rest of requests when first to win
                // comes back.
                this.redirectionList.map(async (url) => {
                    const res = await got.get(`${url}/readiness?sizeInMb=${firstInQueue.memoryNeededMb}`);
                    if (JSON.parse(res.body).isReady) {
                        return url;
                    }
                })
            )
            if (firstReadyUrl) {
                const heavyOperation = await got.get(`${firstReadyUrl}/test?time=3000&mem=${firstInQueue.memoryNeededMb}`)


                // @POSSIBLE-PROBLEM
                // The requests will get round robin chained by other services if they end up
                // not actually being ready - so some careful thought needs putting into this in the future.
                firstInQueue.response.status(heavyOperation.statusCode).json(heavyOperation.body);

                this.queue.processFirstInQueue();

                return;
            }
        }, pollTimeMs);
    }
}