<form role="form" class="sso-oauth2-multiple-settings">
	<div class="row mb-4">
		<h5 class="fw-bold settings-header">Connections</h5>

		<p class="lead">
			The following OAuth2 endpoints have been configured.
		</p>

		<table class="table small" id="strategies">
			<thead>
				<th>Name</th>
				<th>Enabled</th>
				<th>Callback URL <a href="#" data-action="callback-help"><i class="fa fa-question-circle"></i></a></th>
				<th><span class="visually-hidden">Actions</span></th>
			</thead>
			<tbody>
				{{{ if !strategies.length }}}
				<tr>
					<td colspan="4">
						<div class="alert alert-info text-center mb-0"><em>No OAuth2 endpoints configured.</em></div>
					</td>
				</tr>
				{{{ end }}}
				{{{ each strategies }}}
				<tr data-name="{./name}">
					<td>{./name}</td>
					<td>
						{{{ if ./enabled }}}&check;{{{ else }}}&cross;{{{ end }}}
					</td>
					<td>{./callbackUrl}</td>
					<td class="text-end">
						<a href="#" data-action="edit">Edit</a>
						&nbsp;&nbsp;&nbsp;
						<a href="#" data-action="delete" class="text-danger">Delete</a>
					</td>
				</tr>
				{{{ end }}}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="4">
						<button type="button" class="btn btn-success btn-sm pull-right" data-action="new"><i class="fa fa-plus"></i> New Endpoint</button>
					</td>
				</tr>
			</tfoot>
		</table>
	</div>

	<div class="row mb-4">
		<h5 class="fw-bold settings-header">Role to Group Associations</h5>
		<p>
			If the OAuth2 provider sends back a <code>roles</code> property in the User Info endpoint,
			the user can be assigned to a specific user group based on a configured association below.
		</p>

		<fieldset id="associations">
			{{{ each associations }}}
			<!-- IMPORT partials/group-association-field-v2.tpl -->
			{{{ end }}}
		</fieldset>

		<button type="button" class="btn btn-primary" data-action="add">Add association</button>
	</div>


	<div class="row">
		<hr />
		<button class="btn btn-primary" id="save" type="button">Save</button>
	</div>
</form>