'use strict';

const User = require.main.require('./src/user');
const Groups = require.main.require('./src/groups');
const db = require.main.require('./src/database');
const authenticationController = require.main.require('./src/controllers/authentication');
const routeHelpers = require.main.require('./src/routes/helpers');

const passport = module.parent.require('passport');
const nconf = module.parent.require('nconf');
const winston = module.parent.require('winston');

const OAuth = module.exports;

OAuth.init = async (params) => {
	const { router /* , middleware , controllers */ } = params;
	const controllers = require('./lib/controllers');

	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/sso-oauth2-multiple', controllers.renderAdminPage);
};

OAuth.addRoutes = async ({ router, middleware }) => {
	const controllers = require('./lib/controllers');
	const middlewares = [
		middleware.ensureLoggedIn,
		middleware.admin.checkPrivileges,
	];

	routeHelpers.setupApiRoute(router, 'get', '/oauth2-multiple/discover', middlewares, controllers.getOpenIdMetadata);

	routeHelpers.setupApiRoute(router, 'post', '/oauth2-multiple/strategies', middlewares, controllers.editStrategy);
	routeHelpers.setupApiRoute(router, 'get', '/oauth2-multiple/strategies/:name', middlewares, controllers.getStrategy);
	routeHelpers.setupApiRoute(router, 'delete', '/oauth2-multiple/strategies/:name', middlewares, controllers.deleteStrategy);
};

OAuth.addAdminNavigation = (header) => {
	header.authentication.push({
		route: '/plugins/sso-oauth2-multiple',
		icon: 'fa-tint',
		name: 'Multiple OAuth2',
	});

	return header;
};

OAuth.listStrategies = async (full) => {
	const names = await db.getSortedSetMembers('oauth2-multiple:strategies');
	const strategies = await db.getObjects(names.map(name => `oauth2-multiple:strategies:${name}`), full ? undefined : ['enabled']);
	strategies.forEach((strategy, idx) => {
		strategy.name = names[idx];
		strategy.enabled = strategy.enabled === 'true';
		strategy.callbackUrl = `${nconf.get('url')}/auth/${names[idx]}/callback`;
	});

	return strategies;
};

OAuth.loadStrategies = async (strategies) => {
	const passportOAuth = require('passport-oauth').OAuth2Strategy;

	let configured = await OAuth.listStrategies(true);
	configured = configured.filter(obj => obj.enabled);

	const configs = configured.map(({
		name,
		authUrl: authorizationURL,
		tokenUrl: tokenURL,
		id: clientID,
		secret: clientSecret,
		callbackUrl: callbackURL,
	}) => new passportOAuth({
		authorizationURL,
		tokenURL,
		clientID,
		clientSecret,
		callbackURL,
		passReqToCallback: true,
	}, async (req, token, secret, { id, displayName, email }, done) => {
		if (![id, displayName, email].every(Boolean)) {
			return done(new Error('insufficient-scope'));
		}

		const user = await OAuth.login({
			name,
			oAuthid: id,
			handle: displayName,
			email,
		});

		authenticationController.onSuccessfulLogin(req, user.uid);
		done(null, user);
	}));

	configs.forEach((strategy, idx) => {
		strategy.userProfile = OAuth.getUserProfile.bind(strategy, configured[idx].name, configured[idx].userRoute);
		passport.use(configured[idx].name, strategy);
	});

	strategies.push(...configured.map(({ name, scope }) => ({
		name,
		url: `/auth/${name}`,
		callbackURL: `/auth/${name}/callback`,
		icon: 'fa-check-square',
		scope: scope || 'openid email profile',
	})));

	return strategies;
};

OAuth.getUserProfile = function (name, userRoute, accessToken, done) {
	// If your OAuth provider requires the access token to be sent in the query parameters
	// instead of the request headers, comment out the next line:
	this._oauth2._useAuthorizationHeaderForGET = true;

	this._oauth2.get(userRoute, accessToken, (err, body/* , res */) => {
		if (err) {
			return done(err);
		}

		try {
			const json = JSON.parse(body);
			const profile = OAuth.parseUserReturn(json);
			profile.provider = name;
			done(null, profile);
		} catch (e) {
			done(e);
		}
	});
};

OAuth.parseUserReturn = ({ sub, nickname, picture, email/* , email_verified */ }) => {
	const profile = {};
	profile.id = sub;
	profile.displayName = nickname;
	profile.picture = picture;
	profile.email = email;

	return profile;
};

OAuth.login = async (payload) => {
	let uid = await OAuth.getUidByOAuthid(payload.name, payload.oAuthid);
	if (uid !== null) {
		// Existing User
		return ({ uid });
	}

	// Check for user via email fallback
	uid = await User.getUidByEmail(payload.email);
	if (!uid) {
		const { email } = payload;

		// New user
		uid = await User.create({
			username: payload.handle,
		});

		// Automatically confirm user email
		await User.setUserField(uid, 'email', email);
		await User.email.confirmByUid(uid);
	}

	// Save provider-specific information to the user
	await User.setUserField(uid, `${payload.name}Id`, payload.oAuthid);
	await db.setObjectField(`${payload.name}Id:uid`, payload.oAuthid, uid);

	return { uid };
};

OAuth.getUidByOAuthid = async (name, oAuthid) => db.getObjectField(`${name}Id:uid`, oAuthid);

OAuth.deleteUserData = async (data) => {
	const names = await db.getSortedSetMembers('oauth2-multiple:strategies');
	const oAuthIds = await User.getUserFields(data.uid, names.map(name => `${name}Id`));

	await Promise.all(oAuthIds.map(async (oAuthIdToDelete, idx) => {
		if (!oAuthIdToDelete) {
			return;
		}

		const name = names[idx];
		await db.deleteObjectField(`${name}Id:uid`, oAuthIdToDelete);
	}));
};

// If this filter is not there, the deleteUserData function will fail when getting the oauthId for deletion.
OAuth.whitelistFields = async (params) => {
	const names = await db.getSortedSetMembers('oauth2-multiple:strategies');
	params.whitelist.push(...names.map(name => `${name}Id`));

	return params;
};
