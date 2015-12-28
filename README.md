## ConsumerWorker
Consumer Worker is a worker which keep polling the job queue, fetch the currency conversion job, fetch the exchange rate from service provider and save the result into database.

## Create ConsumerWorker Example
```
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

//	Create worker with worker ID and basic config
let cw = new ConsumerWorker(1000, config);
//	Start listening the job queue
cw.run();

```

## How to test the ConsumerWorker
1.	Fork/Clone the project code to the testing machine
2.	Go to the project folder and run `node app.js` to create 10 workers.
4.	The workers are now working, and keep polling the job queue until you force
		stop the process.
3.	You can now seed the currency conversion task to job queue (Tube:
		**crazysumsum**). Since producer worker is not included in this project, so please use your own Producer worker.
4.	Install MongoDB client and run  `mongo ds033125.mongolab.com:33125/aftership
		-u sam -p Abcd1234` to login the Database.
5.	Run `db.exchange_rate.find()` or
		`db.exchange_rate.find({task_id:YOUR_TASK_ID})` to check the result.

**beanstalk payload**
```
{
  "task_id": [UNIQUE_TASK_ID],
  "from": "HKD",
  "to": "USD"
}
```
