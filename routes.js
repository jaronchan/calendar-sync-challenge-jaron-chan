let authorize = require('./controllers/google_authentication').authorize;
let getAuthUrl = require('./controllers/google_authentication').getAuthUrl;
let setUser = require('./controllers/user').setUser;
let setToken = require('./controllers/google_authentication').setToken;
let getEvents = require('./controllers/event').getEvents;

let handleError = function(req, res, error) {
    if (error.name === "CastError") {
        res.status(500).send("Invalid startDate or endDate. Must be in ISOString format");    
    } else {
        res.status(500).send(error);
    }
}

module.exports = (app) => {

    app.get('/', function (req, res) {
        res.send(
            'Send requests in the form of GET /calendar-events?startDate=dateTime1&endDate=dateTime2 [Note: startDate and endDate are optional params]'
        );
    });

    /**
     * Handles GET /calendar-events and optional params, startDate and endDate
     * Redirects to request endpoint if authorised, else will attempt to authorise user
     */
    app.get('/calendar-events', function (req, res) {
        
        if (!req.query.startDate) {
            // No Start Date!
            var startDate = null;
        } else {
            var startDate = req.query.startDate;
        }

        if (!req.query.endDate) {
            // No End Date!
            var endDate = null;
        } else {
            var endDate = req.query.endDate;
        }
        // Carries state over to be handled by Google OAuth callback
        var stateJSON = {
            query: {
                startDate: startDate,
                endDate: endDate    
            }
        }

        var stateString = JSON.stringify(stateJSON);

        var state = new Buffer(stateString).toString('base64');

        var authUrl = getAuthUrl(state);
        if (!req.session.userId) {
            // Not logged in... Redirecting to Google authentication page...
            res.redirect(authUrl)
        } else {
            // Logged in! Checking token...
            let userId = req.session.userId;
            authorize(userId, (results) => {    
                getEvents(userId, startDate, endDate, (results) => {
                    res.send({
                        status: 200,
                        query: {
                            startDate,
                            endDate
                        },
                        result: {
                            events: results,
                        }
                    });
                }, (error) => {handleError(req, res, error)});
            });
        }
    });

    /**
     * Handles Google OAuth redirection and sets cookies to maintain user information
     * Redirects back to GET /calendar-events request after extracting @code {userId} from database.
     */

    app.get('/oauth2_callback', (req, res) => {
        var code = req.query.code;
        var stateString = Buffer.from(req.query.state, 'base64').toString('ascii');

        var stateJSON = JSON.parse(stateString);
        var query = stateJSON.query;
        setToken(code, function() {
            setUser(function(userId) {
                req.session.userId = userId;
                let path = `/calendar-events`;
                if (query.startDate) {
                    path += `?startDate=${query.startDate}`;
                    if (query.endDate) {
                        path += `&endDate=${query.endDate}`;
                    }
                } else {
                    if (query.endDate) {
                        path += `?endDate=${query.endDate}`;
                    }
                }
                res.redirect(path);
            })
        },  (error) => {handleError(req, res, error)})
    });

    /**
     * Resets saved cookies
     * Next attempt to GET /calendar-events will require reauthentication
     */

    app.get('/logout', (req, res) => {
        // Successfully logged out!
        req.session = null;
        res.send('Logged Out!')
    })
}

