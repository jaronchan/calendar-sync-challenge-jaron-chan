const express = require('express');
const mongoose = require('mongoose');
const cookieSession = require('cookie-session');
const keys = require('./config/keys.json');

require('./models/schema')

mongoose.connect(keys.mongoURI);

const app = express();

app.use(
    cookieSession({
        name: 'session',
        maxAge: 24 * 60 * 60 * 1000,
        keys: [keys.cookieKey]
    })
);

require('./routes')(app);

app.listen(3007, function () {
    console.log('Calendar Sync Server listening on port 3007!');
    console.log('http://localhost:3007/' + '\n');
    console.log('To log out or reset cookies, go to http://localhost:3007/logout');
    console.log('Sample request that syncs all events on Google Calendar account to database: http://localhost:3007/calendar-events' + '\n');
});


