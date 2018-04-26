const mongoose = require('mongoose');
const TIMEOUT = require('../config/settings.json').timeout; // Timeout is in minutes

const User = mongoose.model('User');
const Query = mongoose.model('Query');
const Event = mongoose.model('Event');

let getCalendar = require('./google_authentication').getCalendar;

/**
 * Get events from database depending on @code {Query}.
 * First check if query already exists in database. Then if expired, get events from Google Calendar.
 * If not expired, retrieve respective events from database.
 * @param {userId} the id of stored user.
 * @param {startDate} the queried start date.
 * @param {endDate} the queried end date.
 * @param {successCallback} the callback to call if no errors.
 * @param {errorCallback} the callback to call if errors are present.
 */
function getEvents(userId, startDate, endDate, successCallback, errorCallback) {
  // Attempting to retrieve events from cache...
  Query.findOne({
    user: userId,
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  }).then((existingQuery) => {
    if (existingQuery) {
      // Query exists!
      if ((parseInt(new Date() - existingQuery.updated) / (1000 * 60) > TIMEOUT)) {
        // refresh query
        // Query expired... Retrieving calendar events from Google Calendar...
        getEventsFromCalendar(startDate, endDate, (events) => {
          // update field
          existingQuery.update({
            events: events.map((event) => {return event.id;}),
            startDate: startDate,
            endDate: endDate,
            updated: new Date()
          }).then((updateResult) => {
            Query.findOne({
              _id: existingQuery._id
            }).populate('events').exec(function(err, populatedQuery){
              successCallback(populatedQuery.events)
            })
          })
        }, errorCallback)
      } else {
        // Query has not expired! Retrieving calendar events from cache...
        Query.findOne({
          _id: existingQuery._id
        }).populate('events').exec(function(err, populatedQuery){
          successCallback(populatedQuery.events)
        })
      }
    } else {
      // Query doesn't exist... Retrieving calendar events from Google Calendar...
      getEventsFromCalendar(startDate, endDate, (events) => {
        new Query({
          user: userId,
          events: events.map((event) => {return event._id;}),
          startDate: startDate,
          endDate: endDate,
          updated: new Date()          
        }).save();
        successCallback(events);
      }, errorCallback)
    }
  }).catch((error) => {
    errorCallback(error);
  })
}

/**
 * Retrieves events from Google Calendar
 * @param {startDate} the queried start date.
 * @param {endDate} the queried end date.
 * @param {successCallback} the callback to call if no errors.
 * @param {errorCallback} the callback to call if errors are present.
 */
function getEventsFromCalendar(startDate, endDate, successCallback, errorCallback) {
  // Creating Google Calendar API query...
  const calendar = getCalendar();
  let query = {}
  if (startDate == null && endDate == null) {
    query = {
    calendarId: 'primary',
    singleEvents: true,
    orderBy: 'startTime',
    }
  } else if (startDate == null) {
    let query = {
      calendarId: 'primary',
      timeMax: (new Date(endDate)).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    }
  } else if (endDate == null) {
    query = {
      calendarId: 'primary',
      timeMin: (new Date(startDate)).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    }
  } else {
    query = {
      calendarId: 'primary',
      timeMin: (new Date(startDate)).toISOString(),
      timeMax: (new Date(endDate)).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    }
  }

  calendar.events.list(query, (err, result) => {
    if (err) errorCallback(err);
    let data = result.data;
    // find user and modify
    let now =  new Date();
    const googleEvents = data.items;
    let results = [];

    // Updating Database...
    var bulk = Event.collection.initializeOrderedBulkOp();
    googleEvents.forEach((googleEvent) => {
      const eventData = {
        startDate: googleEvent.start.dateTime,
        endDate: googleEvent.end.dateTime,
        lastQueried: now,
        data: googleEvent,
      }
      bulk.find({
        googleEventId: googleEvent.id
      })
      .upsert()
      .updateOne({
        $set: eventData
      });
    });
    bulk.execute((error, result) => {
      Event.find({
        googleEventId: { $in: googleEvents.map((googleEvent) => {return googleEvent.id})}
      }, function(err, documents){
        if (err) errorCallback(err);
        successCallback(documents);
      })
    });
  })
}

module.exports = {
  getEvents: getEvents
}