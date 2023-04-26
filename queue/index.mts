/**
 * A queue is a data structure that stores elements in a linear format,
 * with operations to add elements to the back (enqueue) and remove elements from the front (dequeue). 
 * It follows the First-In-First-Out (FIFO) principle, meaning that the element that was added first will be the first to be removed.
 */

/**
    Problem: Tag team servers, if a server is running low on memory, to redirect the request in the queue to
             a different container.

    I need to get the memory available in the container when a request comes in, and if there isn't enough to perform the expensive operation it
    adds it to a queue, polls the other containers and then redirects the traffic to an available container, clearing the queue item.

    It should allow inexpensive requests to come pass the queue.
 */

import express from 'express';
import { RedirectionHandler, RequestQueue } from './queue.mjs';

const wait = async (time: number) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, time)
    })
}

(() => {
    const app = express();

    const queue = new RequestQueue(10);
    const redirectionList = [
        'http://localhost:42069',
        'http://localhost:42070',
        'http://localhost:42071',
        'http://localhost:41072'
    ].filter((item) => item !== `http://localhost:${process.env.PORT}`);
    const redirectionHandler = new RedirectionHandler(queue, redirectionList);

    app.get('/queueStatus', (req, res) => {
        res.status(200).json({queueSize: queue.size});
    })

    app.get('/readiness', (req, res) => {
        const sizeInMb = req.query['sizeInMb'];

        if (!sizeInMb) res.status(400).json({badRequest: 'no size provided.'});

        const memoryOnServerInMb = process.memoryUsage().heapTotal / 1024 / 1024;

        if (memoryOnServerInMb > Number(sizeInMb)) {
            res.status(200).json({isReady: true, memoryOnServerInMb});
            return;
        }

        res.status(200).json({isReady: false, memoryOnServerInMb});
    })
    
    app.get('/test', async (req, res) => {
        
        console.log('request received');
        const timeForOperation = req.query['time'];
        const memoryRequired = req.query['mem'];

        if (!timeForOperation) res.status(400).json({badRequest: 'no time provided.'});

        if (memoryRequired && Number(memoryRequired) > 600) {
            res.status(400).json({badRequest: 'too much memory requested'});
            return;
        }

        const sizeInMB = memoryRequired ? Number(memoryRequired) : Math.random() * 30;

        const bufferSize = sizeInMB * 1024 * 1024;

        console.log({bufferSize, sizeInMB, space: process.memoryUsage().heapTotal - 25 * 1024 * 1024});
        // check if there's enough memory to perform the operation, with a 10mb buffer.
        if (bufferSize > process.memoryUsage().heapTotal - 25 * 1024 * 1024) {
            console.log('queue hit!');
            const addedToQueue = queue.addToQueue(req, res, sizeInMB);
            if (addedToQueue === true) {
                // redirection handler
                redirectionHandler.initPollForFIFORedirection(3000);
                return;
            }
            if (addedToQueue === false) {
                res.status(503).json({serverException: 'too many requests coming in, try later'})
            }
        }

        // perform expensive operation
        let buffer = Buffer.alloc(bufferSize);
        await wait(Number(timeForOperation));

        buffer = Buffer.allocUnsafe(0);

        res.status(200).send({
            done: true,
            timeToComplete: timeForOperation,
            freeMemoryMb: process.memoryUsage().heapTotal / 1024 / 1024
        })
    })

    app.listen(process.env.PORT || 42069, () => {
        console.log(`Server started on port ${process.env.PORT || 42069}`);
    });
    
})();

