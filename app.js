'use strict';

const ConsumerWorker = require('./lib/consumer_worker.js');


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

for (let i = 1000; i < 1010; i++) {
	let cw = new ConsumerWorker(i, config);
	cw.run();
}
