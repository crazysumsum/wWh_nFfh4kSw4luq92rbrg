'use strict';

const ConsumerWorker = require('./lib/consumer_worker.js');
const JobQ = require('./lib/job_queue.js');

let config = {
	mode: 'debug',
	job_queue: {
		host: 'challenge.aftership.net',
		port: 11300,
		tube: 'crazysumsum'
	},
	persistence: {
		uri: 'ds033125.mongolab.com:33125/aftership',
		username: 'sam',
		password: 'Abcd1234'
	},
	converter: {
		host: 'www.xe.com',
		path: '/currencyconverter/convert/'
	}
};

let job_queue = new JobQ('challenge.aftership.net', 11300, 'crazysumsum');
let cw = new ConsumerWorker(1001, config);

job_queue.init().then(function fulfilled(result) {
	/*	seed testing job to queue
   *  Job payload : {task_id:1000, from:"HKD", to: "TO"}
   */
	return job_queue.putBsJob(1000, 'HKD', 'USD');
}).then(function fulfilled(result) {
	//	Start the consumer worker
	cw.run();
});
