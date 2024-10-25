// Import dependencies
const { createQueuesForToday, createOrUpdateQueue } = require('../routes/secretary/queuemanagement');
const sequelizeMock = require('sequelize-mock');

// Mock models within the module factory directly to stay within scope
jest.mock('../models/schedule', () => {
    const SequelizeMock = require('sequelize-mock');
    const DBConnectionMock = new SequelizeMock();
    return DBConnectionMock.define('schedules', {
        SCHEDULE_ID: 2,
        DAY_OF_WEEK: 4,
        START_TIME: '08:00',
        END_TIME: '17:00'
    });
});

jest.mock('../models/queueManagement', () => {
    const SequelizeMock = require('sequelize-mock');
    const DBConnectionMock = new SequelizeMock();
    return DBConnectionMock.define('quemanagements', {
        SCHEDULE_ID: 2,
        DATE: new Date().toISOString().split('T')[0],
        START_TIME: '08:00',
        END_TIME: '17:00'
    });
});

// Import the mocked models
const Schedule = require('../models/schedule');
const QueueManagement = require('../models/queueManagement');

describe('Queue Management Tests', () => {
    beforeEach(() => {
        // Reset mock implementations before each test
        Schedule.$queueResult([]);
        QueueManagement.$queueResult([]);
    });

    test('should create queues for today’s schedules', async () => {
        // Mock data for schedules with today's day of the week
        Schedule.$queueResult([
            Schedule.build({
                SCHEDULE_ID: 2,
                DAY_OF_WEEK: 4,
                START_TIME: '08:00',
                END_TIME: '17:00'
            })
        ]);

        // Call the function
        await createQueuesForToday();

        // Assert that the queue creation function was called
        const queues = await QueueManagement.findAll();
        expect(queues.length).toBe(1); // We expect one queue to be created
        expect(queues[0].SCHEDULE_ID).toBe(2);
        expect(queues[0].DATE).toBe(new Date().toISOString().split('T')[0]);
    });

    test('should not create duplicate queues for existing schedules', async () => {
        // Mock data for schedules and existing queue with today's date
        Schedule.$queueResult([
            Schedule.build({
                SCHEDULE_ID: 2,
                DAY_OF_WEEK: 4,
                START_TIME: '08:00',
                END_TIME: '17:00'
            })
        ]);
        QueueManagement.$queueResult([
            QueueManagement.build({
                SCHEDULE_ID: 2,
                DATE: new Date().toISOString().split('T')[0],
                START_TIME: '08:00',
                END_TIME: '17:00'
            })
        ]);

        // Call the function
        await createQueuesForToday();

        // Assert that no new queue was created
        const queues = await QueueManagement.findAll();
        expect(queues.length).toBe(1); // No new queue should be created
    });
});
