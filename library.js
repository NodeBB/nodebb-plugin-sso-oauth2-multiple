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
const providers = require('./lib/providers');
const { httpsGetJson } = require('./lib/oauth/http');
const { extractIdTokenClaims } = require('./lib/oauth/id-token');
const OAuth = module.exports;
// ---------------------------------------------------------------------------
// Admin / routes
// ---------------------------------------------------------------------------
OAuth.init = async (params) => {
	const { router } = params;
	const controllers = require('./lib/controllers');
	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/sso-oauth2-multiple', controllers.renderAdminPage);
};
OAuth.addRoutes = async ({ router, middleware }) => {
	const controllers = require('./lib/controllers');
	const middlewares = [middleware.ensureLoggedIn, middleware.admin.checkPrivileges];
	routeHelpers.setupApiRoute(router, 'get', '/oauth2-multiple/discover', middlewares, controllers.getOpenIdMetadata);
	routeHelpers.setupApiRoute(router, 'post', '/oauth2-multiple/strategies', middlewares, controllers.editStrategy);
	routeHelpers.setupApiRoute(router, 'get', '/oauth2-multiple/strategies/:name', middlewares, controllers.getStrategy);
	routeHelpers.setupApiRoute(router, 'delete', '/oauth2-multiple/strategies/:name', middlewares, controllers.deleteStrategy);
	routeHelpers.setupApiRoute(router, 'get', '/oauth2-multiple/provider/:provider/user/:oAuthId', middlewares, controllers.userByOAuthId);
};
OAuth.addAdminNavigation = (header) => {
	header.authentication.push({
		route: '/plugins/sso-oauth2-multiple',
		icon: 'fa-tint',
		name: 'Multiple OAuth2',
	});
	return header;
};
// ---------------------------------------------------------------------------
// Strategy storage
// ---------------------------------------------------------------------------
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
	const strategies = await db.getObjects(
		names.map(name => `oauth2-multiple:strategies:${name}`),
		full ? undefined : ['enabled']
	);
	strategies.forEach((strategy, idx) => {
		strategy.name = names[idx];
		strategy.enabled = strategy.enabled === 'true' || strategy.enabled === true;
		strategy.callbackUrl = `${nconf.get('url')}/auth/${names[idx]}/callback`;
	});
	return strategies;
}
// ---------------------------------------------------------------------------
// Passport wiring
// ---------------------------------------------------------------------------
// We use `passport-oauth2` (not `passport-oauth`) because it supports PKCE/state,
// which are required for Twitter/X and recommended for Apple/Google/Microsoft.
const OAuth2Strategy = require('passport-oauth2');
OAuth.loadStrategies = async (strategies) => {
	let configured = await OAuth.listStrategies(true);
	configured = configured.filter(obj => obj.enabled);
	configured.forEach((cfg) => {
		const provider = providers.detect(cfg);
		// PKCE / state are opt-in (off by default) to preserve backward compatibility
		// with v1.5.x (which used `passport-oauth` and did neither). Some providers
		// (twitter/apple) recommend PKCE; users can enable it explicitly in ACP.
		// Note: passport-oauth2 requires `state: true` whenever `pkce: true`.
		const pkce = cfg.pkce === 'on' || cfg.pkce === true;
		const stateEnabled = pkce || cfg.state === 'on' || cfg.state === true;
		if (!pkce && provider.pkceDefault) {
			winston.verbose(`[sso-oauth2-multiple] ${cfg.name}: provider ${provider.type} recommends PKCE; enable it in ACP if your IdP requires it.`);
		}
		const strategyOptions = {
			authorizationURL: cfg.authUrl,
			tokenURL: cfg.tokenUrl,
			clientID: cfg.id,
			clientSecret: cfg.secret,
			callbackURL: cfg.callbackUrl,
			passReqToCallback: true,
			state: stateEnabled,
			pkce,
			scope: cfg.scope ? cfg.scope.split(/\s+/) : ['openid', 'email', 'profile'],
		};
		const strategy = new OAuth2Strategy(strategyOptions,
			async (req, accessToken, refreshToken, params, profile, done) => {
				try {
					// `profile` from passport-oauth2 is {} by default; we build our own.
					const idTokenClaims = extractIdTokenClaims(params && params.id_token);
					const built = await OAuth.buildProfile({
						strategyConfig: cfg,
						accessToken,
						idTokenClaims,
					});
					const id = built && built.id;
					const displayName = built && (built.displayName || built.fullname || built.username);
					winston.info(`[sso-oauth2-multiple] verify ${cfg.name}: id=${id} displayName=${displayName} email=${built.email || 'none'} verified=${built.email_verified}`);
					if (!id || !displayName) {
						return done(new Error('insufficient-scope'));
					}
					const loggedInUser = await OAuth.login({
						name: cfg.name,
						oAuthid: id,
						handle: displayName,
						email: built.email,
						email_verified: built.email_verified,
					});
					await authenticationController.onSuccessfulLogin(req, loggedInUser.uid);
					await OAuth.assignGroups({ provider: cfg.name, user: loggedInUser, profile: built });
					await OAuth.updateProfile(loggedInUser.uid, built);
					done(null, loggedInUser);
					plugins.hooks.fire('action:oauth2.login', { name: cfg.name, user: loggedInUser, profile: built });
				} catch (err) {
					done(err);
				}
			});
		// Override passport-oauth2 userProfile to no-op; we do it ourselves in verify
		strategy.userProfile = (_accessToken, done) => done(null, {});
		passport.use(cfg.name, strategy);
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
// ---------------------------------------------------------------------------
// Build a normalized profile from: userinfo endpoint + id_token + per-provider
// email fallback
// ---------------------------------------------------------------------------
OAuth.buildProfile = async ({ strategyConfig, accessToken, idTokenClaims }) => {
	// First detection pass (pre-userinfo) uses only the strategy config.
	let provider = providers.detect(strategyConfig, idTokenClaims || {});
	let raw = {};
	const hasUserRoute = strategyConfig.userRoute && !provider.skipUserRoute;
	if (hasUserRoute) {
		try {
			const extraHeaders = provider.userRouteHeaders ? provider.userRouteHeaders() : null;
			raw = await httpsGetJson({
				url: strategyConfig.userRoute,
				accessToken,
				headers: extraHeaders || { 'Accept': 'application/json' },
			}) || {};
		} catch (e) {
			winston.warn(`[sso-oauth2-multiple] ${strategyConfig.name}: userRoute error: ${e.message}`);
		}
	}
	// Re-detect now that we have the raw profile; this lets heuristics that
	// inspect profile shape (e.g. gitlab / github fallback) kick in.
	if (!(strategyConfig.providerType || '').trim()) {
		provider = providers.detect(strategyConfig, raw);
	}
	winston.info(`[sso-oauth2-multiple] ${strategyConfig.name}: providerType=${provider.type} userinfoKeys=${Object.keys(raw).join(',') || '-'} idTokenKeys=${idTokenClaims ? Object.keys(idTokenClaims).join(',') : '-'}`);
	const profile = await OAuth.parseUserReturn(strategyConfig.name, raw, provider.type);
	// Merge id_token claims (OIDC) as higher priority for email/name if userinfo lacks them
	if (idTokenClaims) {
		if (!profile.email && idTokenClaims.email) profile.email = idTokenClaims.email;
		if (typeof profile.email_verified === 'undefined' && typeof idTokenClaims.email_verified !== 'undefined') {
			profile.email_verified = !!idTokenClaims.email_verified;
		}
		if (!profile.id && (idTokenClaims.sub || idTokenClaims.user_id)) {
			profile.id = idTokenClaims.sub || idTokenClaims.user_id;
		}
		if (!profile.fullname && idTokenClaims.name) profile.fullname = idTokenClaims.name;
		if (!profile.picture && idTokenClaims.picture) profile.picture = idTokenClaims.picture;
		if (!profile.displayName) {
			profile.displayName = idTokenClaims.preferred_username || idTokenClaims.nickname || idTokenClaims.name || (idTokenClaims.email ? idTokenClaims.email.split('@')[0] : undefined);
		}
	}
	// Provider-specific REST fallback for email
	if (!profile.email && provider.fetchEmail) {
		try {
			const fetched = await provider.fetchEmail({ strategyConfig, accessToken });
			if (fetched && fetched.email) {
				profile.email = fetched.email;
				if (typeof profile.email_verified === 'undefined') profile.email_verified = !!fetched.verified;
				winston.info(`[sso-oauth2-multiple] ${strategyConfig.name}: fetched email via ${provider.type} fallback`);
			}
		} catch (emailErr) {
			winston.warn(`[sso-oauth2-multiple] ${strategyConfig.name}: email fallback failed: ${emailErr.message}`);
		}
	}
	// Apple last resort: synthesize displayName from email
	if (!profile.displayName && profile.email) {
		profile.displayName = profile.email.split('@')[0];
	}
	profile.provider = strategyConfig.name;
	return profile;
};
// ---------------------------------------------------------------------------
// Profile normalization
// ---------------------------------------------------------------------------
OAuth.parseUserReturn = async (strategyName, rawProfile, providerType) => {
	const strategy = await OAuth.getStrategy(strategyName);
	const { usernameViaEmail, forceUsernameViaEmail, idKey } = strategy || {};

	const provider = providers.get(providerType);
	const parsed = provider.parse(rawProfile, { idKey });

	// Common post-processing: create username from email if needed
	if (forceUsernameViaEmail || (!parsed.displayName && parsed.email && usernameViaEmail === 'on')) {
		parsed.displayName = parsed.email.split('@')[0];
	}

	parsed.provider = strategyName;
	parsed.roles = rawProfile.roles;
	return parsed;
};
// ---------------------------------------------------------------------------
// User login / linking
// ---------------------------------------------------------------------------
OAuth.getAssociations = async () => {
	let { roles, groups } = await meta.settings.get('sso-oauth2-multiple');
	if (!roles || !groups) return [];
	if (!Array.isArray(groups)) groups = groups.split(',');
	if (!Array.isArray(roles)) roles = roles.split(',');
	return roles.map((role, idx) => ({ role, group: groups[idx] }));
};
OAuth.login = async (payload) => {
	let uid = await OAuth.getUidByOAuthid(payload.name, payload.oAuthid);
	if (uid !== null) return { uid };
	const { trustEmailVerified } = await OAuth.getStrategy(payload.name);
	const { email } = payload;
	const email_verified = parseInt(trustEmailVerified, 10) &&
		(payload.email_verified || payload.email_verified === true);
	if (email && email_verified) uid = await user.getUidByEmail(payload.email);
	if (!uid) {
		uid = await user.create({ username: payload.handle });
		if (email) {
			await user.setUserField(uid, 'email', email);
			if (email_verified) await user.email.confirmByUid(uid);
		}
	}
	await user.setUserField(uid, `${payload.name}Id`, payload.oAuthid);
	await db.setObjectField(`${payload.name}Id:uid`, payload.oAuthid, uid);
	return { uid };
};
OAuth.assignGroups = async ({ user, profile }) => {
	if (!profile.roles || !Array.isArray(profile.roles)) return;
	const { uid } = user;
	const associations = await OAuth.getAssociations();
	const { toJoin, toLeave } = associations.reduce((memo, { role, group }) => {
		if (profile.roles.includes(role)) memo.toJoin.push(group);
		else memo.toLeave.push(group);
		return memo;
	}, { toJoin: [], toLeave: [] });
	await groups.leave(toLeave, uid);
	await groups.join(toJoin, uid);
};
OAuth.updateProfile = async (uid, profile) => {
	const fields = ['fullname', 'picture'];
	const strategy = await OAuth.getStrategy(profile.provider);
	const allowList = [];
	const payload = fields.reduce((memo, field) => {
		const setting = `sync${field[0].toUpperCase()}${field.slice(1)}`;
		if (strategy[setting] && parseInt(strategy[setting], 10)) {
			memo[field] = profile[field];
			if (field === 'picture') allowList.push('picture');
		}
		return memo;
	}, {});
	payload.uid = uid;
	await user.updateProfile(uid, payload, allowList);
};
OAuth.getUidByOAuthid = async (name, oAuthid) => db.getObjectField(`${name}Id:uid`, oAuthid);
OAuth.deleteUserData = async (data) => {
	const names = await db.getSortedSetMembers('oauth2-multiple:strategies');
	const oAuthIds = await user.getUserFields(data.uid, names.map(name => `${name}Id`));
	Object.keys(oAuthIds).forEach((prop) => {
		if (!names.includes(prop.replace(/Id$/, ''))) delete oAuthIds[prop];
	});
	const promises = [];
	for (const [providerField, id] of Object.entries(oAuthIds)) {
		if (id) promises.push(db.deleteObjectField(`${providerField}:uid`, id));
	}
	await Promise.all(promises);
};
OAuth.whitelistFields = async (params) => {
	const names = await db.getSortedSetMembers('oauth2-multiple:strategies');
	params.whitelist.push(...names.map(name => `${name}Id`));
	return params;
};
