# NodeBB OAuth2 Multiple Client SSO

This NodeBB plugin allows you to configure logins to multiple configurable OAuth2 endpoints, via the admin backend.
Use this plugin if you have a separate database of users and you'd like to allow access to the forum to those users via that database.

## Caveat

Different OAuth2 providers adhere to the standard differently.
This plugin is tested primarily against the following providers:

* [Auth0 by Okta](//auth0.com)
* [Okta](//www.okta.com/)

Support for other OAuth2 providers is _explicitly not guaranteed_.
If you'd like to help this plugin play nice with other providers, please
[open an issue](https://github.com/NodeBB/nodebb-plugin-sso-oauth2-multiple/issues).

## Profile Updates

v1.4.0 of this plugin introduces the ability to update a user's full name and picture with data supplied by the remote userinfo endpoint.
The functionality (including which fields to sync/ignore) can be configured on a per-strategy basis, under the "Adjustments" menu when editing a strategy.

## Role-Based Access Control

This plugin is able to sort users into specific user groups based on user roles.
You can maintain a map of roles to user groups, and further limit access via standard category privileges in NodeBB.

_The role-based access control functionality was sponsored by [Outplayed](https://outplayed.com)._

## Screenshots

![OAuth2 Strategy Editing](./screenshots/configure.png)

## For Developers

### Hooks
Other plugins can interact with this plugin, as it fires the following hooks:

1. On successful login — `action:oauth2.login` — passes in `(name, user, profile)`
	* `name` is the strategy name.
	* `user` is the local NodeBB user (probably just the `uid`).
	* `profile` is the remote profile as retrieved by this plugin.

### API
If you need to look up the user from your own system, you can use the GET api route `/api/v3/plugins/oauth2-multiple/provider/:provider/user/:oAuthId`.
* `:provider` must be the name of you OAuth2 strategy
* `:oAuthId` must be the same value that the userinfo endpoint returns for the defined user id