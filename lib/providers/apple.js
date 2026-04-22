'use strict';

// Apple has no userinfo endpoint; profile data comes exclusively from the
// id_token claims, which are merged in by the caller.
module.exports = {
	type: 'apple',
	pkceDefault: true,
	skipUserRoute: true,

	matches({ host, name }) {
		return /appleid\.apple\.com/.test(host) || /apple/.test(name);
	},

	parse() {
		return {};
	},

	async fetchEmail() {
		return null;
	},
};
