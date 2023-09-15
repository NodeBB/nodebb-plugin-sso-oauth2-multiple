<div class="mb-3 association">
	<div class="input-group">
		<input type="text" name="roles" class="form-control" placeholder="Role" value="{./role}" autocomplete="off" {{{ if ./role }}}disabled{{{ end }}}>
		<span class="input-group-text">&rarr;</span>
		<select class="form-control" name="groups" data-value="{./group}">
			{{{ each groupNames }}}
			<option value="{@value}">{@value}</option>
			{{{ end }}}
		</select>
		<button class="btn" type="button" data-action="remove"><i class="fa fa-trash text-danger"></i></button>
	</div>
</div>