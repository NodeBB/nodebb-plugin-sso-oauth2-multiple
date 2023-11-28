'use strict';

const fetch = require('node-fetch');

const nconf = require.main.require('nconf');

const db = require.main.require('./src/database');
const groups = require.main.require('./src/groups');
const slugify = require.main.require('./src/slugify');
const helpers = require.main.require('./src/controllers/helpers');

const main = require('../library');

const Controllers = module.exports;

Controllers.renderAdminPage = async (req, res) => {
	const main = require('../library');
	const strategies = await main.listStrategies();
	let groupNames = await db.getSortedSetRange('groups:createtime', 0, -1);
	groupNames = groupNames.filter(name => (
		name !== 'registered-users' &&
		name !== 'verified-users' &&
		name !== 'unverified-users' &&
		name !== groups.BANNED_USERS &&
		!groups.isPrivilegeGroup(name)
	));
	const associations = await main.getAssociations();
	const isV2 = nconf.get('version').startsWith('2');

	res.render(`admin/plugins/sso-oauth2-multiple${isV2 ? '-v2' : ''}`, {
		title: 'Multiple OAuth2',
		strategies,
		associations,
		groupNames,
		isV2,
	});
};

Controllers.getOpenIdMetadata = async (req, res) => {
	const { domain } = req.query;
	if (!domain) {
		return helpers.formatApiResponse(400, res);
	}

	try {
		const url = new URL(`https://${domain}/.well-known/openid-configuration`);
		const response = await fetch(url);
		const { authorization_endpoint, token_endpoint, userinfo_endpoint } = await response.json();

		helpers.formatApiResponse(200, res, { authorization_endpoint, token_endpoint, userinfo_endpoint });
	} catch (e) {
		helpers.formatApiResponse(400, res, new Error('Invalid domain supplied'));
	}
};

Controllers.getStrategy = async (req, res) => {
	const name = slugify(req.params.name);

	const strategy = await main.getStrategy(name);

	helpers.formatApiResponse(200, res, { strategy });
};

Controllers.editStrategy = async (req, res) => {
	const name = slugify(req.params.name || req.body.name);
	const payload = { ...req.body };
	delete payload.name;

	const valuesOk = ['authUrl', 'tokenUrl', 'id', 'secret'].every(prop => payload.hasOwnProperty(prop) && payload[prop]);
	if (!name || !valuesOk) {
		throw new Error('[[error:invalid-data]]');
	}

	payload.enabled = !!req.body.enabled;

	const checkboxes = ['usernameViaEmail', 'trustEmailVerified', 'syncFullname', 'syncPicture'];
	checkboxes.forEach((prop) => {
		payload[prop] = payload.hasOwnProperty(prop) && payload[prop] === 'on' ? 1 : 0;
	});

	await Promise.all([
		db.sortedSetAdd('oauth2-multiple:strategies', Date.now(), name),
		db.setObject(`oauth2-multiple:strategies:${name}`, payload),
	]);

	const strategies = await main.listStrategies();
	helpers.formatApiResponse(200, res, { strategies });
};

Controllers.deleteStrategy = async (req, res) => {
	const name = slugify(req.params.name);

	await Promise.all([
		db.sortedSetRemove('oauth2-multiple:strategies', name),
		db.delete(`oauth2-multiple:strategies:${name}`),
	]);

	const strategies = await main.listStrategies();
	helpers.formatApiResponse(200, res, { strategies });
};
