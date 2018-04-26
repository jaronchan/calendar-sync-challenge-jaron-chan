# gt-local-calendar-sync -- By Jaron Chan
A simple calendar syncing system that keeps a local cache of calendar events that sync to Google Calendar API. Built on `MongoDB`, `Express` and `Node.js`, the system takes in a calendar event query and returns the necessary data.

Current implementation utilises `MongoDB` to store Google calendar events retrieved to retain data even when server is closed. To reduce the number of API calls to Google, queries have a expiration where should a repeated 
query be made and the query is yet to be 'stale', the events are returned directly by the database. While a different query will continue to call from Google, if the events are already existing in the database, the events retrieved will duplicated, rather, only last queried time will be updated. Future implementation will build upon existing database to retrieve events directly from the database if the event has already been retrieved before.

Project has been tested to work for multiple users at the same time.

## Quickstart
1. Install node.js and npm
2. CD into directory and run 'npm install'
3. Run 'npm run start'
4. Go to browser and navigate to http://localhost:3007/calendar-events?startDate=2018-04-22T00:00:00.000Z&endDate=2018-04-29T00:00:00.000Z
5. Authorize `Calendar Sync Challenge` with permissions to Google Calendar
6. Query returned with JSON containing all events between April 22 to April 29

## Design Considerations

### Queries and Google Calendar API Call Limits
Limiting the number of API hits to Google Calendar API has both merits and disadvantages. Firstly, as Google Calendar API has a courtesy limit of 1,000,000 queries per day, having more API calls more than the stipulated limit will incur increased costs to GoodTime.io. Thus, by caching the calendar data from Google, it reduces the number of calls required per user, freeing up resources.

However, by caching the data, it is difficult to determine when should the data be refreshed as the data stored could become out of sync with Google Calendar. Users could have made changes to the events on Google Calendar and hence making the cached data out-dated. This will require even more Google Calendar API calls to remain updated.

Thus, to come to a compromise, the current implementation determines when to call from Google depending on the query made. Each `GET /calendar-events` request is logged in the database, taking note of the `User` who made the call, and the `startDate` and `endDate` if any. Repeated queries within a specified time frame, i.e. `TIMEOUT, (see `Settings` below) can be assumed to unlikely be amended. For example, switching back and forth from daily view to weekly view, or viewing next week and back to this week. Instances like these will retrieve data from database without calling on Google Calendar API.

In future implementations, queries that fall within existing, non-expired queries should be able to retrieve directly from the database. Overlapping events may not require such functionality apart from time complexity improvements as each Google Calendar API call can retrieve a full list of events. Currently, each `Event` contains a `lastQueried` field that can be useful in developing more robust calls.

### Log In Status
A repeat user, who has already authorised the project to access their Google details will have their refresh tokens stored in the database. By accessing their refresh token, the project exchanges the refresh token for a new access token with Google to gain access. In the browser session, the unique `userId` of the user will be stored as a cookie until logging out (see `GET /logout`) which will reset the cookie. This will allow other accounts to be authenticated.

## Database Architecture
```javascript
/**
 * Implements MongoDB Schema for 'User' collection
 */
const userSchema = new Schema ({
  googleId: String,
  refreshToken: String,
  queries: [{
    type: Schema.Types.ObjectId, 
    ref: 'Query'
  }],
  events: [{
    type: Schema.Types.ObjectId, 
    ref: 'Event'
  }],
});

/**
 * Implements MongoDB Schema for 'Query' collection
 */

const querySchema = new Schema ({
  user:  {
    type: Schema.Types.ObjectId, 
    ref: 'User'
  },
  events:[{
    type: Schema.Types.ObjectId, 
    ref: 'Event'
  }],
  startDate: Date,
  endDate: Date,
  updated: Date
});

/**
 * Implements MongoDB Schema for 'Event' collection
 */

const eventSchema = new Schema ({
  googleEventId: String,
  startDate: Date,
  endDate: Date,
  lastQueried: Date,
  data: Schema.Types.Mixed
})
```


### GET /logout
* Resets the user log-in status. Next attempt for `GET /calendar-events` will require reauthentication.

### GET /calendar-events
* If the user is not logged in, redirect to login page for Google Calendar to authorize user. After auth, redirect to /calendar-events endpoint
* Show a list of upcoming calendar events with event data:
  * Event Title
  * Event Description
  * List of Attendees (with attendance reponse)
* `startDate` and `endDate` must in ISO date format else error returns.

#### GET Params
| Params  | Required | Description |
| ------- | -------- | ----------- |
| startDate | false  | ISO date format string. If present, bounds all events returned by the query to have a starting event datetime >= to value. (i.e. '2017-01-17T03:36:22.321Z') |
| endDate   | false  | ISO date format string. If present, bounds all events returned by the query to have a starting event datetime <= to value. (i.e. '2017-01-17T03:36:22.321Z') |

#### Sample Output
```javascript
{
 "status": 200,
 "query": {
   "startDate": "2017-01-17T18:02:07.122Z",
   "endDate": null,
 },
 "results": {
   "events": [
     {
      "id": "aGNpNmswYjF0aHZnZXNicGNnbWlndWduNGsgamFzcGVyQGdvb2R0aW1lLmlv",
      "status": "confirmed",
      "created": "2017-01-11T18:02:07.122Z",
      "updated": "2017-01-12T02:19:23.690Z",
      "summary": "Debrief Session",
      "description": "Secret meeting in the training docks.",
      "location": string,
      "creator": {
        "id": "F0aHZnZXNicGNnbWlndWduNGsgamFzcGVyQGd",
        "email": "bernard.lowe@delos.com",
        "displayName": "Bernard Lowe",
        "self": true
      },
      "organizer": {
        "id": "F0aHZnZXNicGNnbWlndWduNGsgamFzcGVyQGd",
        "email": "bernard.lowe@delos.com",
        "displayName": "Bernard Lowe",
        "self": true
      },
      "startDate": "2017-01-18T18:02:07.122Z"
      "endDate": "2017-01-18T19:02:07.122Z"
      "attendees": [
        {
          "id": "NnbWlndWduNGsgamFzcGVyQGdvb2R",
          "email": "dolores@sweetwater.gov",
          "displayName": "Dolores Abernathy",
          "organizer": boolean,
          "self": boolean,
          "resource": boolean,
          "optional": boolean,
          "responseStatus": string,
          "comment": string,
          "additionalGuests": integer
        }
      ]
    },
    {
     // ... additional events
    }
   ]
 }
}
```

## Settings
* `TIMEOUT`: Refers to how many minutes before a 'Query' in Database becomes stale. By default, it has been set to `2`, i.e. for repeated query calls within 2 minutes, events will be fetched from database rather than getting from Google Calendar API. The `TIMEOUT` value in `./config/settings.json` is arbitrary and can be adjusted by GoodTime.io depending on user traffic.

## Acknowledgements
* Libraries Used: [Axios](https://github.com/axios/axios), [Cookie Session](https://github.com/expressjs/cookie-session), [ExpressJS](https://github.com/expressjs/express), [Google Auth Library](https://github.com/google/google-auth-library-nodejs), [Google APIs](https://github.com/google/google-api-nodejs-client), [Mongoose](https://github.com/Automattic/mongoose)
* Hosting Platforms: [mLab](https://mlab.com/)

## Reflection
The challenge has been a rather challenging but immensely eye-opening opportunity. In the matter of three days, I began learning from scratch to prepare myself for this challenge. As someone with Front-End experience, mainly handling Client-side projects in ReactJS, I had to learn quite a lot in a short span of time to fulfill this back-end challenge. To be very honest, I have almost zero knowledge in databases and hence it took me quite sometime to familiarise with MongoDB, my database of choice.

I hope that this project proves to showcase my abilities and provides a glimpse into my future growth. Despite juggling learning new skills for this project and my revision for upcoming examinations, I am proud to have spent the time on this project and look forward to expanding my knowledge. I do hope to be highly considered for the GoodTime.io internship and in the months to come, I am bound to develop my skills even further.
