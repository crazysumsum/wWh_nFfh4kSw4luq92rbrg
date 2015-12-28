'use strict';

const ConsumerWorker = require('./lib/consumer_worker.js');


let config = {
	mode: 'debug',	//	Debug mode, write the log to console
	job_queue: {
		host: 'challenge.aftership.net',	//	Job Queue Server
		port: 11300,	//	Job Queue Server Port
		tube: 'crazysumsum'	//	Job Queue Tube Name
	},
	persistence: {
		uri: 'ds033125.mongolab.com:33125/aftership',	//	Database Server
		username: 'sam',	//	Database username
		password: 'Abcd1234'	//	Database password
	},
	converter: {
		host: 'www.xe.com',	//	Currency Conversion Service Provider
		path: '/currencyconverter/convert/'	//	Currency Conversion Service Path
	}
};

//	Create 10 workers
for (let i = 1000; i < 1010; i++) {
	//	Create worker with worker ID and basic config
	let cw = new ConsumerWorker(i, config);
	//	Start listening the job queue
	cw.run();
}
