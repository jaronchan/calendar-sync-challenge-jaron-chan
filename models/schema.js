const mongoose = require('mongoose');
const { Schema } = mongoose; 

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

mongoose.model('User', userSchema);
mongoose.model('Query', querySchema);
mongoose.model('Event', eventSchema)
