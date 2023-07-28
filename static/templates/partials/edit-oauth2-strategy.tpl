<form role="form">
	<div class="form-check form-switch">
		<input type="checkbox" class="form-check-input" id="enabled" name="enabled" {{{ if (./enabled == "true") }}}checked{{{ end }}}>
		<label for="enabled" class="form-check-label">Enabled</label>
	</div>

	<hr />

	<div class="mb-3">
		<label class="form-label" for="name">Name</label>
		<input type="text" id="name" name="name" title="Name" class="form-control" placeholder="Name" value="{./name}" {{{ if ./name }}}readonly{{{ end }}}>
		<p class="form-text">
			Enter something unique to your OAuth provider in lowercase, like <code>github</code>, or <code>nodebb</code>.
		</p>
	</div>

	<div class="mb-3">
		<label class="form-label" for="authUrl">Authorization URL</label>
		<input type="text" id="authUrl" name="authUrl" title="Authorization URL" class="form-control" placeholder="https://..." value="{./authUrl}">
	</div>

	<div class="mb-3">
		<label class="form-label" for="tokenUrl">Token URL</label>
		<input type="text" id="tokenUrl" name="tokenUrl" title="Token URL" class="form-control" placeholder="https://..." value="{./tokenUrl}">
	</div>

	<div class="mb-3">
		<label class="form-label" for="id">Client ID</label>
		<input type="text" id="id" name="id" title="Client ID" class="form-control" value="{./id}">
	</div>

	<div class="mb-3">
		<label class="form-label" for="secret">Client Secret</label>
		<input type="text" id="secret" name="secret" title="Client Secret" class="form-control" value="{./secret}">
	</div>

	<div class="mb-3">
		<label class="form-label" for="userRoute">User Info URL</label>
		<input type="text" id="userRoute" name="userRoute" title="User Info URL" class="form-control" placeholder="/userinfo" value="{./userRoute}">
		<p class="form-text">
			If a relative path is specified here, we will assume the hostname from the authorization URL.
		</p>
	</div>
</form>