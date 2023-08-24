'use strict';

const passport = module.parent.require('passport');
const nconf = module.parent.require('nconf');
const winston = module.parent.require('winston');

const db = require.main.require('./src/database');
const user = require.main.require('./src/user');
const plugins = require.main.require('./src/plugins');
const meta = require.main.require('./src/meta');
const groups = require.main.require('./src/groups');
const authenticationController = require.main.require('./src/controllers/authentication');
const routeHelpers = require.main.require('./src/routes/helpers');

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
	names.sort();

	return await getStrategies(names, full);
};

OAuth.getStrategy = async (name) => {
	const strategies = await getStrategies([name], true);
	return strategies.length ? strategies[0] : null;
};

async function getStrategies(names, full) {
	const strategies = await db.getObjects(names.map(name => `oauth2-multiple:strategies:${name}`), full ? undefined : ['enabled']);
	strategies.forEach((strategy, idx) => {
		strategy.name = names[idx];
		strategy.enabled = strategy.enabled === 'true' || strategy.enabled === true;
		strategy.callbackUrl = `${nconf.get('url')}/auth/${names[idx]}/callback`;
	});

	return strategies;
}

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
	}, async (req, token, secret, profile, done) => {
		const { id, displayName, email } = profile;
		if (![id, displayName, email].every(Boolean)) {
			return done(new Error('insufficient-scope'));
		}
		try {
			const user = await OAuth.login({
				name,
				oAuthid: id,
				handle: displayName,
				email,
			});
			winston.verbose(`[plugin/sso-oauth2-multiple] Successful login to uid ${user.uid} via ${name} (remote id ${id})`);
			await authenticationController.onSuccessfulLogin(req, user.uid);
			await OAuth.assignGroups({ provider: name, user, profile });
			done(null, user);

			plugins.hooks.fire('action:oauth2.login', { name, user, profile });
		} catch (err) {
			done(err);
		}
	}));

	configs.forEach((strategy, idx) => {
		strategy.userProfile = OAuth.getUserProfile.bind(strategy, configured[idx].name, configured[idx].userRoute);
		passport.use(configured[idx].name, strategy);
	});

	strategies.push(...configured.map(({ name, scope, loginLabel, registerLabel, faIcon }) => ({
		name,
		url: `/auth/${name}`,
		callbackURL: `/auth/${name}/callback`,
		icon: faIcon || 'fa-right-to-bracket',
		icons: {
			normal: `fa ${faIcon || 'fa-right-to-bracket'}`,
			square: `fa ${faIcon || 'fa-right-to-bracket'}`,
		},
		labels: {
			login: loginLabel || 'Log In',
			register: registerLabel || 'Register',
		},
		color: '#666',
		scope: scope || 'openid email profile',
	})));

	return strategies;
};

OAuth.getUserProfile = function (name, userRoute, accessToken, done) {
	// If your OAuth provider requires the access token to be sent in the query parameters
	// instead of the request headers, comment out the next line:
	this._oauth2._useAuthorizationHeaderForGET = true;

	this._oauth2.get(userRoute, accessToken, async (err, body/* , res */) => {
		if (err) {
			return done(err);
		}

		try {
			const json = JSON.parse(body);
			const profile = await OAuth.parseUserReturn(name, json);
			profile.provider = name;
			done(null, profile);
		} catch (e) {
			done(e);
		}
	});
};

OAuth.parseUserReturn = async (provider, profile) => {
	const {
		id, sub, name, nickname, preferred_username, picture,
		roles, email, /* , email_verified */
	} = profile;
	const { usernameViaEmail, idKey } = await OAuth.getStrategy(provider);
	const normalized = {
		provider,
		id: profile[idKey] || id || sub,
		displayName: nickname || preferred_username || name,
		picture,
		roles,
		email,
	};

	if (!normalized.displayName && email && usernameViaEmail === 'on') {
		normalized.displayName = email.split('@')[0];
	}

	return normalized;
};

OAuth.getAssociations = async () => {
	let { roles, groups } = await meta.settings.get('sso-oauth2-multiple');
	if (!roles || !groups) {
		return [];
	}

	groups = groups.split(',');
	return roles.split(',').map((role, idx) => ({
		role,
		group: groups[idx],
	}));
};

OAuth.login = async (payload) => {
	let uid = await OAuth.getUidByOAuthid(payload.name, payload.oAuthid);
	if (uid !== null) {
		// Existing User
		return ({ uid });
	}

	// Check for user via email fallback
	uid = await user.getUidByEmail(payload.email);
	if (!uid) {
		const { email } = payload;

		// New user
		uid = await user.create({
			username: payload.handle,
		});

		// Automatically confirm user email
		await user.setUserField(uid, 'email', email);
		await user.email.confirmByUid(uid);
	}

	// Save provider-specific information to the user
	await user.setUserField(uid, `${payload.name}Id`, payload.oAuthid);
	await db.setObjectField(`${payload.name}Id:uid`, payload.oAuthid, uid);

	return { uid };
};

OAuth.assignGroups = async ({ user, profile }) => {
	if (!profile.roles || !Array.isArray(profile.roles)) {
		return;
	}

	const { uid } = user;
	const associations = await OAuth.getAssociations();
	const { toJoin, toLeave } = associations.reduce((memo, { role, group }) => {
		if (profile.roles.includes(role)) {
			memo.toJoin.push(group);
		} else {
			memo.toLeave.push(group);
		}

		return memo;
	}, { toJoin: [], toLeave: [] });
	if (toLeave.length) {
		winston.verbose(`[plugins/sso-auth0] uid ${uid} now leaving ${toLeave.length} these user groups: ${toLeave.join(', ')}`);
	}
	await groups.leave(toLeave, uid);
	await groups.join(toJoin, uid);
	winston.verbose(`[plugins/sso-auth0] uid ${uid} now a part of ${toJoin.length} these user groups: ${toJoin.join(', ')}`);
};

OAuth.getUidByOAuthid = async (name, oAuthid) => db.getObjectField(`${name}Id:uid`, oAuthid);

OAuth.deleteUserData = async (data) => {
	const names = await db.getSortedSetMembers('oauth2-multiple:strategies');
	const oAuthIds = await user.getUserFields(data.uid, names.map(name => `${name}Id`));
	delete oAuthIds.uid;

	const promises = [];
	for (const [provider, id] of Object.entries(oAuthIds)) {
		if (id) {
			promises.push(db.deleteObjectField(`${provider}:uid`, id));
		}
	}

	await Promise.all(promises);
};

// If this filter is not there, the deleteUserData function will fail when getting the oauthId for deletion.
OAuth.whitelistFields = async (params) => {
	const names = await db.getSortedSetMembers('oauth2-multiple:strategies');
	params.whitelist.push(...names.map(name => `${name}Id`));

	return params;
};
