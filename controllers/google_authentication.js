const mongoose = require('mongoose');
const TIMEOUT = require('../config/settings.json').timeout; // Timeout is in minutes

const axios = require('axios');
const querystring = require('querystring');

const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis'); 

const OAuth2Client = google.auth.OAuth2;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/plus.me',
];

const keys = require('../config/keys.json');
const User = mongoose.model('User');
const Query = mongoose.model('Query');
const Event = mongoose.model('Event');

const {client_secret, client_id, redirect_uris} = keys.web;
const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

/**
 * Authorizes the user with the stored @code {refreshToken} acquired from @param {userId}, 
 * and then execute the given callback function.
 * @param {userId} the id of stored user.
 * @param {callback} the callback to call with the authorized client (either success or error).
 */
function authorize(userId, callback) {

  // Check if we have previously stored a token.
  User.findOne({
    _id: userId,
  }).then((existingUser) => {
    // Retrieves refresh token from existing user in database
    refreshToken = existingUser.refreshToken

    // Exchanging refresh token for new access token from Google
    return axios.post(
      'https://www.googleapis.com/oauth2/v4/token',
      querystring.stringify({
        refresh_token: refreshToken,
        client_id: client_id,
        client_secret: client_secret,
        grant_type: 'refresh_token'
      })
    )
  }).then((accessTokenObj) => {
    // Token refreshed
    oAuth2Client.setCredentials(accessTokenObj.data);
    callback(accessTokenObj.data.access_token)
  }) 
}

/**
 * Sets up and returns the Google authentication URL 
 * @param {state} a Base64 encoded JSON containing query data.
 * @return {authUrl} the required Google authentication URL with params
 */
function getAuthUrl(state) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state,
  });
  return authUrl
}

/**
 * Fetch and set token as credential for oauth2 client
 * @param {code} the code data returned by Google to allow API use.
 * @param {callback} callback The callback to call with the authorized client.
 */
function setToken(code, successCallback, errorCallback) {
   oAuth2Client.getToken(code, (err, token) => {
    if (err) return errorCallback(err);
    oAuth2Client.setCredentials(token);
    successCallback(true);
  });
}

/**
 * Get Google Plus API interface.
 */
function getGooglePlus() {
  const plus = google.plus({
    version: 'v1',
    auth: oAuth2Client
  });
  return plus;
}

/**
 * Get Google Calendar API interface.
 */
function getCalendar() {
    const calendar = google.calendar({
    version: 'v3',
    auth: oAuth2Client
  });
  return calendar;
}

module.exports = {
  authorize: authorize,
  setToken: setToken,
  getAuthUrl: getAuthUrl,
  getCalendar: getCalendar,
  getGooglePlus: getGooglePlus
}
