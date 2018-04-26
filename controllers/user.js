let setToken = require('./google_authentication').getCalendar;
let getGooglePlus = require('./google_authentication').getCalendar;


/**
 * Updates database with authenticated user if not already existing in database.
 * @param {code} the code data returned by Google to allow API use.
 * @param {callback} callback The callback to call with the authorized client.
 */

function setUser(callback) {
 	let plus = getGooglePlus();
 	plus.people.get({ userId: 'me' }).then((res) => {
		// looks through user collection
		User.findOne({googleId: res.data.id }).then((existingUser) => {
			if (existingUser) {
			  // already have a record
			  // find token here
			  callback(existingUser._id)
			} else { 
				new User({
					googleId: res.data.id,
					refreshToken: token.refresh_token,
				}).save().then((user)=> {
					callback(user._id);  
				});
			}
		})
  })
}

module.exports = {
	setUser: setUser
}