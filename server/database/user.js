const config = require("../config"),
	database = require("../utils/database"),
	color = require("../colors"),
	log = require("../utils/log"),
	f_header = "[database/user.js]";

module.exports = {
	/**
	 * Checks the presence of a given user in the database
	 * @param {string} username - The username of the required user
	 * @param {string} email - The email of the required user
	 */
	check_presence: (username, email) => {
		return new Promise((resolve, reject) => {
			let db = database.get_db();
			try {
				db.db("HumansAgainstCards")
					.collection("user")
					.findOne({ $or: [{ username: username }, { email: email }] }, (err, doc) => {
						if (doc !== null) resolve(true);
						if (err) throw err;
						resolve(false);
					});
			} catch (e) {
				console.log(log.date_now() + f_header, color.red, `Error while searching user ${username} !\n`, color.white, e);
				reject(true);
			}
		});
	},
	/**
	 * Checks if the given session key is indeed unique
	 * @param {string} session - The cookie session you wich to search
	 */
	session_is_unique: (session) => {
		return new Promise((resolve, reject) => {
			let db = database.get_db();
			try {
				db.db("HumansAgainstCards")
					.collection("user")
					.findOne({ "session.value": session }, (err, doc) => {
						if (doc !== null) resolve(false);
						if (err) throw err;
						resolve(true);
					});
			} catch (e) {
				console.log(log.date_now() + f_header, color.red, `Error while searching session ${session} !\n`, color.white, e);
				reject(false);
			}
		});
	},
	/**
	 * Adds an user to the database
	 * @param {object} user - The user object you wish to add
	 */
	register: (user) => {
		return new Promise((resolve, reject) => {
			let db = database.get_db();
			try {
				db.db("HumansAgainstCards")
					.collection("user")
					.insertOne(user, (err) => {
						if (err) throw err;
						resolve(true);
					});
			} catch (e) {
				console.log(log.date_now() + f_header, color.red, `Error while insering user ${JSON.stringify(user)} !\n`, color.white, e);
				reject(false);
			}
		});
	},
};
