'use strict';

const fetch = require('node-fetch');

const nconf = require.main.require('nconf');

const db = require.main.require('./src/database');
const groups = require.main.require('./src/groups');
const slugify = require.main.require('./src/slugify');
const helpers = require.main.require('./src/controllers/helpers');
const userController = require.main.require('./src/controllers/user');
const nconf = require.main.require('nconf');
const path = require('path');
const fs = require('fs/promises');

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

Controllers.renderIconsCss = async (req, res) => {
	const strategies = await main.listStrategies(true);
	const iconStrategies = strategies.filter(strategy => strategy.iconUrl);

	const escapeCssUrl = (url) => url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

	const baseStyles = `
.sso-oauth2-icon {
	display: inline-block;
	width: 1em;
	height: 1em;
	background-position: center;
	background-repeat: no-repeat;
	background-size: contain;
	vertical-align: middle;
}
.sso-oauth2-icon::before {
	content: "" !important;
}
`.trim();

	const iconRules = iconStrategies.map(strategy => (
		`.sso-oauth2-icon-${strategy.name} { background-image: url("${escapeCssUrl(strategy.iconUrl)}"); }`
	)).join('\n');

	res.set('Content-Type', 'text/css; charset=utf-8');
	res.send(`${baseStyles}\n${iconRules}\n`);
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

	const baseDir = nconf.get('base_dir') || process.cwd();
	const rawUploadPath = nconf.get('upload_path') || path.join(baseDir, 'public', 'uploads');
	const uploadPath = path.isAbsolute(rawUploadPath) ? rawUploadPath : path.join(baseDir, rawUploadPath);
	const uploadUrl = nconf.get('upload_url') || '/uploads';
	const relativePath = nconf.get('relative_path') || '';
	const iconsDir = path.join(uploadPath, 'plugins', 'sso-oauth2-multiple');

	const normalizeUrlPrefix = (prefix) => {
		if (!prefix.startsWith('/')) {
			prefix = `/${prefix}`;
		}
		return prefix.replace(/\/+$/, '');
	};
	const normalizeRelativePath = (value) => {
		if (!value) {
			return '';
		}
		if (!value.startsWith('/')) {
			value = `/${value}`;
		}
		return value.replace(/\/+$/, '');
	};
	const isAbsoluteUploadUrl = /^https?:\/\//i.test(uploadUrl);
	const baseUploadUrl = isAbsoluteUploadUrl
		? uploadUrl.replace(/\/+$/, '')
		: `${normalizeRelativePath(relativePath)}${normalizeUrlPrefix(uploadUrl)}`;
	const uploadUrlPrefix = `${baseUploadUrl}/plugins/sso-oauth2-multiple/`;
	const getIconFilePath = (url) => {
		if (!url || typeof url !== 'string') {
			return null;
		}
		if (!url.startsWith(uploadUrlPrefix)) {
			return null;
		}
		const filename = url.slice(uploadUrlPrefix.length);
		if (!filename) {
			return null;
		}
		return path.join(iconsDir, filename);
	};

	if (payload.removeIcon === 'on') {
		payload.iconUrl = '';
	}
	delete payload.removeIcon;

	const existing = await main.getStrategy(name);
	const existingIconPath = existing ? getIconFilePath(existing.iconUrl) : null;

	if (payload.iconUrl) {
		const maxBytes = 100 * 1024;
		const isDataUrl = payload.iconUrl.startsWith('data:image/');
		if (isDataUrl) {
			const match = payload.iconUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
			if (!match) {
				throw new Error('[[error:invalid-data]]');
			}
			const mime = match[1];
			const data = match[2];
			const buffer = Buffer.from(data, 'base64');
			if (buffer.length > maxBytes) {
				throw new Error('[[error:invalid-data]]');
			}

			const extMap = {
				'image/png': 'png',
				'image/jpeg': 'jpg',
				'image/jpg': 'jpg',
				'image/gif': 'gif',
				'image/webp': 'webp',
				'image/svg+xml': 'svg',
			};
			const ext = extMap[mime];
			if (!ext) {
				throw new Error('[[error:invalid-data]]');
			}

			await fs.mkdir(iconsDir, { recursive: true });
			const filename = `${name}-${Date.now()}.${ext}`;
			const filePath = path.join(iconsDir, filename);
			await fs.writeFile(filePath, buffer);
			payload.iconUrl = `${uploadUrlPrefix}${filename}`;

			if (existingIconPath) {
				await fs.unlink(existingIconPath).catch(() => null);
			}
		} else if (!payload.iconUrl.startsWith(uploadUrlPrefix)) {
			throw new Error('[[error:invalid-data]]');
		}
	} else if (!payload.iconUrl && existingIconPath) {
		await fs.unlink(existingIconPath).catch(() => null);
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
