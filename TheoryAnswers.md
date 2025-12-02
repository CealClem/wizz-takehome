# Question 1:

We are planning to put this project in production. According to you, what are the missing pieces to make this project production ready? Please elaborate an action plan.

## Answer:

**Infrastructure & Hosting**
- Deploy to a cloud provider (AWS, GCP, or Azure) instead of running on localhost
- Replace SQLite with PostgreSQL or MySQL hosted on Amazon RDS, since SQLite doesn't handle concurrent connections well and isn't built for production workloads. I've used MySql before and it handles concurrent queries well.

**Security**
- Add authentication using API keys so only authorized internal teams can access the service
- Implement rate limiting to prevent abuse and protect against DDoS

**Reliability & Monitoring**
- Add comprehensive error handling throughout the API
- Set up logging (e.g., Winston, CloudWatch) to track errors and usage patterns
- Implement monitoring/alerting (e.g. Datadog) to catch issues before users report them
- Write unit and integration tests to catch bugs before deployment

**Scalability**
- Add load balancing to handle traffic spikes
- Consider caching frequently accessed data (Redis) to reduce database load

**DevOps**
- Set up a CI/CD pipeline to automate testing and deployment
- Create staging environment for testing changes before production

**Documentation**
- Write API documentation so other Voodoo teams know how to use the service

# Question 2:

Let's pretend our data team is now delivering new files every day into the S3 bucket, and our service needs to ingest those files every day through the populate API. Could you describe a suitable solution to automate this? Feel free to propose architectural changes.

## Answer:

**Automation & Error Handling:**

I'd set up a scheduled job (cron or Scheduled Lambda) to trigger 
the populate endpoint daily. 

For error handling:
- Track processed files in the database to prevent duplicates
- Add try-catch blocks and retry logic for network failures
- Log errors so we can debug issues

After researching, I see that you can set up Dead Letter Queues that send alerts to devs when a task fails repeatedly 

Alternatively, we could use S3 event notifications to trigger 
processing when files arrive, rather than polling on a schedule - 
I'd need to compare the tradeoffs of each approach.
