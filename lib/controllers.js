'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs').promises;

const fetch = require('node-fetch');
const nconf = require.main.require('nconf');

const db = require.main.require('./src/database');
const file = require.main.require('./src/file');
const groups = require.main.require('./src/groups');
const slugify = require.main.require('./src/slugify');
const helpers = require.main.require('./src/controllers/helpers');
const userController = require.main.require('./src/controllers/user');

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

Controllers.uploadIcon = async (req, res) => {
	const dataUrl = req.body && (req.body.dataUrl || req.body.iconFile);
	if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
		return helpers.formatApiResponse(400, res, new Error('[[error:invalid-file]]'));
	}
	const maxBytes = 100 * 1024;
	const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
	if (!match) {
		return helpers.formatApiResponse(400, res, new Error('[[error:invalid-file]]'));
	}
	const mime = match[1];
	const base64Data = match[2];
	const buffer = Buffer.from(base64Data, 'base64');
	if (buffer.length > maxBytes) {
		return helpers.formatApiResponse(400, res, new Error('[[error:file-too-big, 100]]'));
	}
	const allowedTypes = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i;
	if (!allowedTypes.test(mime)) {
		return helpers.formatApiResponse(400, res, new Error('[[error:invalid-file]]'));
	}
	const ext = file.typeToExtension(mime) || '.png';
	const iconsFolder = 'plugins/sso-oauth2-multiple';
	const filename = `${Date.now()}${ext}`;
	const tempPath = path.join(os.tmpdir(), `oauth2-icon-${Date.now()}${ext}`);
	try {
		await fs.writeFile(tempPath, buffer);
		const relativePath = nconf.get('relative_path') || '';
		const uploadResult = await file.saveFileToLocal(filename, iconsFolder, tempPath);
		const url = relativePath + uploadResult.url;
		helpers.formatApiResponse(200, res, { url });
	} finally {
		await file.delete(tempPath);
	}
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

	const checkboxes = ['forceUsernameViaEmail', 'usernameViaEmail', 'trustEmailVerified', 'syncFullname', 'syncPicture'];
	checkboxes.forEach((prop) => {
		payload[prop] = payload.hasOwnProperty(prop) && payload[prop] === 'on' ? 1 : 0;
	});

	if (payload.removeIcon === 'on') {
		payload.iconUrl = '';
	}
	delete payload.removeIcon;

	const relativePath = nconf.get('relative_path') || '';
	const uploadPath = nconf.get('upload_path');
	const iconsFolder = 'plugins/sso-oauth2-multiple';
	const uploadUrlPrefix = `${relativePath}/assets/uploads/${iconsFolder}/`;

	const getIconFilePathFromUrl = (url) => {
		if (!url || typeof url !== 'string') {
			return null;
		}
		const prefix = `${relativePath}/assets/uploads/${iconsFolder}/`;
		if (!url.startsWith(prefix)) {
			return null;
		}
		const filename = url.slice(prefix.length);
		if (!filename || filename.includes('/')) {
			return null;
		}
		return path.join(uploadPath, iconsFolder, filename);
	};

	const existing = await main.getStrategy(name);
	const existingIconPath = existing ? getIconFilePathFromUrl(existing.iconUrl) : null;

	if (payload.iconUrl) {
		const currentPrefix = `${relativePath}/assets/uploads/${iconsFolder}/`;
		if (!payload.iconUrl.startsWith(currentPrefix)) {
			throw new Error('[[error:invalid-data]]');
		}
	} else if (existingIconPath) {
		await file.delete(existingIconPath);
	}

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

Controllers.userByOAuthId = async (req, res) => {
	const userId = await main.getUidByOAuthid(req.params.provider, req.params.oAuthId);
	if (!userId) {
		return helpers.formatApiResponse(404, res);
	}

	const userData = await userController.getUserDataByUID(req.uid, userId);
	helpers.formatApiResponse(200, res, { userData });
};
