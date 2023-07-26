'use strict';

const db = require.main.require('./src/database');
const slugify = require.main.require('./src/slugify');
const helpers = require.main.require('./src/controllers/helpers');

const main = require('../library');

const Controllers = module.exports;

Controllers.renderAdminPage = async (req, res) => {
	const strategies = await main.listStrategies();
	res.render('admin/plugins/sso-oauth2-multiple', {
		title: 'Multiple OAuth2',
		strategies,
	});
};

Controllers.getStrategy = async (req, res) => {
	const name = slugify(req.params.name);

	const strategy = await db.getObject(`oauth2-multiple:strategies:${name}`);
	strategy.name = name;

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
