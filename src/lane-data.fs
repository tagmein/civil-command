-- file lane-data.fs
; to confirm-modal-mod ; load /src/confirm-modal.fs
; to row-picker-mod ; load /src/lane-row-picker-modal.fs
; to scope ; object

; to scope.mount (
 -- Mounts the Data tab UI for defining typed tables, schemas (single and [] multiple), and editable rows
 ; to { lane container lane-control } $argv

 ; to root-el !document.createElement div
 ; set lane-data root-el.className

 ; to modal [ match
  { $lane-control.confirm-modal : $lane-control.confirm-modal }
  { true : !confirm-modal-mod.create $root-el }
 ]
 ; to row-picker [ match
  { $lane-control.row-picker-modal : $lane-control.row-picker-modal }
  { true : !row-picker-mod.create $root-el }
 ]
 ; to page-size [ match
  { $defaultRowPickerPageSize : $defaultRowPickerPageSize }
  { true : 25 }
 ]

 ; to view [ object
  { lane $lane }
  { container $container }
  { lane-control $lane-control }
  { confirm-modal $modal }
  { row-picker $row-picker }
  { row-page-size $page-size }
  { tables {} }
  { is-loading true }
  { active-table-id '' }
  { schema-open true }
  { table-menu-open false }
  { view-menu-open false }
  { editing-view-name false }
  { table-views ; object }
  { pinned-row-ids ; object }
  { view-option-els {} }
  { id-seq 0 }
  { used-ids ; object }
  { table-tabs {} }
  { schema-rows {} }
  { grid-head-cells {} }
  { grid-filter-cells {} }
  { grid-rows {} }
  { display-options-btns {} }
  { subtable-group-collapsed ; object }
  { table-updates ; object }
  { update-rows {} }
  { filter-editor ; object { open false } { mode add } { table-id '' } { column-id '' } { filter-id '' } { anchor-el null } }
  { filter-op-els {} }
  { filter-input-els {} }
  { filter-val-el null }
  { filter-val-to-el null }
  { on-record-change null }
 ]

 ; to bar-el !document.createElement div
 ; set lane-data-bar bar-el.className
 ; to tabs-el !document.createElement div
 ; set lane-data-table-tabs tabs-el.className
 ; to bar-actions-el !document.createElement div
 ; set lane-data-bar-actions bar-actions-el.className
 ; to add-table-btn !document.createElement button
 ; assign $add-table-btn { type button } { className lane-data-add-table } { textContent '+ Table' } { title 'Create a new table' } { disabled true }
 ; to import-table-btn !document.createElement button
 ; assign $import-table-btn { type button } { className lane-data-import-table } { textContent Import } { title 'Import a remote table from another lane' } { disabled true }
 !bar-actions-el.appendChild $add-table-btn
 !bar-actions-el.appendChild $import-table-btn
 !bar-el.appendChild $tabs-el
 !bar-el.appendChild $bar-actions-el

 ; to loading-el !document.createElement div
 ; assign $loading-el { className cc-loading } { textContent 'Loading tables…' } { hidden false }

 ; to empty-el !document.createElement div
 ; assign $empty-el { className lane-data-empty } { textContent 'No tables yet. Create a table to define columns and add rows.' } { hidden true }

 ; to active-el !document.createElement div
 ; set lane-data-active active-el.className
 ; set true active-el.hidden

 ; to remote-bar-el !document.createElement div
 ; assign $remote-bar-el { className lane-data-remote-bar } { hidden true }
 ; to remote-mode-badge !document.createElement span
 ; assign $remote-mode-badge { className 'cc-badge lane-data-remote-mode' } { textContent 'REMOTE · READ-ONLY' }
 ; to remote-jump-btn !document.createElement button
 ; assign $remote-jump-btn { type button } { className 'lane-line-set-by-btn lane-data-remote-jump-btn' } { textContent '' }
 ; to remote-status-el !document.createElement span
 ; assign $remote-status-el { className lane-data-remote-status } { textContent '' } { hidden true }
 ; to remote-edit-btn !document.createElement button
 ; assign $remote-edit-btn { type button } { className 'lane-data-btn lane-data-remote-edit-btn' } { textContent 'Import settings' } { title 'Change read-only / read-write mode or local table name' }
 !remote-bar-el.appendChild $remote-mode-badge
 !remote-bar-el.appendChild $remote-jump-btn
 !remote-bar-el.appendChild $remote-status-el
 !remote-bar-el.appendChild $remote-edit-btn

 ; to table-header-el !document.createElement div
 ; set lane-data-table-header table-header-el.className
 ; to view-wrap !document.createElement div
 ; set lane-data-view-wrap view-wrap.className
 ; to view-btn !document.createElement button
 ; assign $view-btn { type button } { className lane-data-view-btn } { title 'Switch, save, or manage table views' }
 !view-btn.setAttribute aria-haspopup dialog
 !view-btn.setAttribute aria-expanded 'false'
 ; to view-btn-main !document.createElement span
 ; set lane-data-view-btn-main view-btn-main.className
 ; to view-name-el !document.createElement span
 ; assign $view-name-el { className lane-data-view-btn-name } { textContent '' }
 ; to view-count-badge !document.createElement span
 ; assign $view-count-badge { className lane-data-view-btn-count } { textContent '' } { hidden true }
 ; to view-dirty-badge !document.createElement span
 ; assign $view-dirty-badge { className lane-data-view-dirty-badge } { textContent 'Unsaved filters' } { hidden true }
 !view-btn-main.appendChild $view-name-el
 !view-btn-main.appendChild $view-count-badge
 !view-btn-main.appendChild $view-dirty-badge
 ; to view-caret-el !document.createElement span
 ; assign $view-caret-el { className lane-data-view-btn-caret } { textContent '▾' }
 !view-btn.appendChild $view-btn-main
 !view-btn.appendChild $view-caret-el

 ; to view-menu !document.createElement div
 ; assign $view-menu { className lane-data-view-menu } { hidden true }
 !view-menu.setAttribute role dialog
 !view-menu.setAttribute aria-label 'Table views'
 ; to view-default-status !document.createElement div
 ; assign $view-default-status { className lane-data-view-menu-status } { textContent '' }
 ; to view-title-btn !document.createElement button
 ; assign $view-title-btn { type button } { className lane-data-view-title-btn } { hidden true } { title 'Click to rename view' }
 ; to view-title-text !document.createElement span
 ; assign $view-title-text { className lane-data-view-title-text } { textContent '' }
 ; to view-title-hint !document.createElement span
 ; assign $view-title-hint { className lane-data-view-title-hint } { textContent Rename }
 !view-title-btn.appendChild $view-title-text
 !view-title-btn.appendChild $view-title-hint
 ; to view-rename-row !document.createElement div
 ; assign $view-rename-row { className lane-data-view-rename-row } { hidden true }
 ; to view-rename-input !document.createElement input
 ; assign $view-rename-input { type text } { className lane-data-view-rename-input } { placeholder 'View name...' } { spellcheck false } { autocomplete off }
 ; to view-rename-btn !document.createElement button
 ; assign $view-rename-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent Save }
 ; to view-rename-cancel-btn !document.createElement button
 ; assign $view-rename-cancel-btn { type button } { className workspace-mini-btn } { textContent Cancel }
 !view-rename-row.appendChild $view-rename-input
 !view-rename-row.appendChild $view-rename-btn
 !view-rename-row.appendChild $view-rename-cancel-btn
 ; to view-draft-row !document.createElement div
 ; assign $view-draft-row { className 'workspace-session-draft lane-data-view-draft' } { hidden true }
 ; to view-draft-label !document.createElement div
 ; assign $view-draft-label { className workspace-session-draft-label } { textContent 'Unsaved filters' }
 ; to view-draft-actions !document.createElement div
 ; set workspace-session-draft-actions view-draft-actions.className
 ; to view-save-btn !document.createElement button
 ; assign $view-save-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent 'Save view' }
 ; to view-fork-btn !document.createElement button
 ; assign $view-fork-btn { type button } { className workspace-mini-btn } { textContent 'Fork view' }
 ; to view-abandon-btn !document.createElement button
 ; assign $view-abandon-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--danger' } { textContent 'Abandon changes' }
 !view-draft-actions.appendChild $view-save-btn
 !view-draft-actions.appendChild $view-fork-btn
 !view-draft-actions.appendChild $view-abandon-btn
 !view-draft-row.appendChild $view-draft-label
 !view-draft-row.appendChild $view-draft-actions
 ; to view-list-title !document.createElement div
 ; assign $view-list-title { className top-rail-menu-section-title } { textContent Views }
 ; to view-list-el !document.createElement div
 ; set lane-data-view-list view-list-el.className
 !view-list-el.setAttribute role listbox
 !view-list-el.setAttribute aria-label 'Table views list'
 ; to view-menu-div !document.createElement div
 ; set top-rail-menu-divider view-menu-div.className
 ; to view-actions-el !document.createElement div
 ; set lane-data-view-actions view-actions-el.className
 ; to view-new-btn !document.createElement button
 ; assign $view-new-btn { type button } { className 'lane-data-view-action-item lane-data-view-action-item--primary' } { textContent 'New view' } { title 'Create a new view for this table' }
 !view-new-btn.setAttribute role menuitem
 ; to view-duplicate-btn !document.createElement button
 ; assign $view-duplicate-btn { type button } { className lane-data-view-action-item } { textContent 'Duplicate view' } { title 'Duplicate the current view' }
 !view-duplicate-btn.setAttribute role menuitem
 ; to view-reset-btn !document.createElement button
 ; assign $view-reset-btn { type button } { className lane-data-view-action-item } { textContent 'Reset view' } { title 'Clear all filters in this view' }
 !view-reset-btn.setAttribute role menuitem
 ; to view-delete-btn !document.createElement button
 ; assign $view-delete-btn { type button } { className 'lane-data-view-action-item lane-data-view-action-item--danger' } { textContent 'Delete view' } { title 'Delete this saved view' }
 !view-delete-btn.setAttribute role menuitem
 !view-actions-el.appendChild $view-new-btn
 !view-actions-el.appendChild $view-duplicate-btn
 !view-actions-el.appendChild $view-reset-btn
 !view-actions-el.appendChild $view-delete-btn
 !view-menu.appendChild $view-default-status
 !view-menu.appendChild $view-title-btn
 !view-menu.appendChild $view-rename-row
 !view-menu.appendChild $view-draft-row
 !view-menu.appendChild $view-list-title
 !view-menu.appendChild $view-list-el
 !view-menu.appendChild $view-menu-div
 !view-menu.appendChild $view-actions-el
 !view-wrap.appendChild $view-btn
 !view-wrap.appendChild $view-menu

 ; to header-actions-el !document.createElement div
 ; set lane-data-table-actions header-actions-el.className
 ; to schema-toggle-btn !document.createElement button
 ; assign $schema-toggle-btn { type button } { className lane-data-schema-toggle } { textContent 'Schema (0) ▾' } { title 'Show or hide table columns schema' }
 ; to table-menu-wrap !document.createElement div
 ; set lane-data-table-menu-wrap table-menu-wrap.className
 ; to table-menu-btn !document.createElement button
 ; assign $table-menu-btn { type button } { className 'lane-data-btn lane-data-table-menu-btn' } { textContent '⋯' } { title 'Table actions' }
 !table-menu-btn.setAttribute aria-haspopup menu
 !table-menu-btn.setAttribute aria-expanded 'false'
 !table-menu-btn.setAttribute aria-label 'Table actions'
 ; to table-menu !document.createElement div
 ; assign $table-menu { className lane-data-table-menu } { hidden true }
 !table-menu.setAttribute role menu
 !table-menu.setAttribute aria-label 'Table actions'
 ; to edit-table-btn !document.createElement button
 ; assign $edit-table-btn { type button } { className 'lane-data-table-menu-item lane-data-table-menu-item--neutral lane-data-edit-table' } { textContent 'Edit table' } { title 'Rename this table' }
 !edit-table-btn.setAttribute role menuitem
 ; to clear-rows-btn !document.createElement button
 ; assign $clear-rows-btn { type button } { className 'lane-data-table-menu-item lane-data-clear-rows' } { textContent 'Clear rows' } { title 'Delete all rows in this table' }
 !clear-rows-btn.setAttribute role menuitem
 ; to delete-table-btn !document.createElement button
 ; assign $delete-table-btn { type button } { className 'lane-data-table-menu-item lane-data-delete-table' } { textContent 'Delete table' } { title 'Delete this table' }
 !delete-table-btn.setAttribute role menuitem
 ; to jump-owner-btn !document.createElement button
 ; assign $jump-owner-btn { type button } { className 'lane-data-table-menu-item lane-data-table-menu-item--neutral lane-data-jump-owner' } { textContent 'Go to owner table ↗' } { title 'Open original owner lane and table' }
 !jump-owner-btn.setAttribute role menuitem
 ; to edit-import-btn !document.createElement button
 ; assign $edit-import-btn { type button } { className 'lane-data-table-menu-item lane-data-table-menu-item--neutral lane-data-edit-import' } { textContent 'Import settings…' } { title 'Edit remote table import mode or local name' }
 !edit-import-btn.setAttribute role menuitem
 !table-menu.appendChild $edit-table-btn
 !table-menu.appendChild $clear-rows-btn
 !table-menu.appendChild $delete-table-btn
 !table-menu-wrap.appendChild $table-menu-btn
 !table-menu-wrap.appendChild $table-menu
 !header-actions-el.appendChild $schema-toggle-btn
 !header-actions-el.appendChild $table-menu-wrap
 !table-header-el.appendChild $view-wrap
 !table-header-el.appendChild $header-actions-el

 ; to edit-table-backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-config-backdrop lane-edit-table-backdrop' edit-table-backdrop.className
 !edit-table-backdrop.setAttribute role dialog
 !edit-table-backdrop.setAttribute aria-modal 'true'
 !edit-table-backdrop.setAttribute aria-label 'Edit table'
 ; to edit-table-panel !document.createElement div
 ; set 'lane-modal lane-config-modal lane-edit-table-modal' edit-table-panel.className
 ; to edit-table-modal-header !document.createElement div
 ; set lane-modal-header edit-table-modal-header.className
 ; to edit-table-title-wrap !document.createElement div
 ; set lane-config-title-wrap edit-table-title-wrap.className
 ; to edit-table-heading !document.createElement div
 ; assign $edit-table-heading { className lane-modal-title } { textContent 'Edit Table' }
 ; to edit-table-id-el !document.createElement div
 ; assign $edit-table-id-el { className lane-config-id } { textContent '' }
 ; to edit-table-close-btn !document.createElement button
 ; assign $edit-table-close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Cancel (Esc)' }
 !edit-table-title-wrap.appendChild $edit-table-heading
 !edit-table-title-wrap.appendChild $edit-table-id-el
 !edit-table-modal-header.appendChild $edit-table-title-wrap
 !edit-table-modal-header.appendChild $edit-table-close-btn
 ; to edit-table-form !document.createElement form
 ; set lane-config-form edit-table-form.className
 ; to edit-table-field !document.createElement div
 ; set lane-config-field edit-table-field.className
 ; to edit-table-name-label !document.createElement label
 ; assign $edit-table-name-label { className lane-config-label } { textContent 'Table Name' }
 ; to edit-table-name-input !document.createElement input
 ; assign $edit-table-name-input { type text } { className 'lane-config-input lane-data-table-name' } { placeholder 'table_name' } { spellcheck false } { autocomplete off }
 ; to edit-table-error-el !document.createElement div
 ; assign $edit-table-error-el { className lane-data-filter-error } { textContent '' } { hidden true }
 ; to edit-table-footer !document.createElement div
 ; set lane-config-footer edit-table-footer.className
 ; to edit-table-cancel-btn !document.createElement button
 ; assign $edit-table-cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to edit-table-save-btn !document.createElement button
 ; assign $edit-table-save-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent 'Save changes' }
 !edit-table-field.appendChild $edit-table-name-label
 !edit-table-field.appendChild $edit-table-name-input
 !edit-table-footer.appendChild $edit-table-cancel-btn
 !edit-table-footer.appendChild $edit-table-save-btn
 !edit-table-form.appendChild $edit-table-field
 !edit-table-form.appendChild $edit-table-error-el
 !edit-table-form.appendChild $edit-table-footer
 !edit-table-panel.appendChild $edit-table-modal-header
 !edit-table-panel.appendChild $edit-table-form
 !edit-table-backdrop.appendChild $edit-table-panel
 ; to edit-table-modal [ object
  { backdrop $edit-table-backdrop }
  { panel $edit-table-panel }
  { heading $edit-table-heading }
  { id-el $edit-table-id-el }
  { close-btn $edit-table-close-btn }
  { form $edit-table-form }
  { name-input $edit-table-name-input }
  { error-el $edit-table-error-el }
  { cancel-btn $edit-table-cancel-btn }
  { save-btn $edit-table-save-btn }
  { is-open false }
  { is-saving false }
  { table null }
  { lane null }
 ]

 ; to schema-section !document.createElement div
 ; set lane-data-schema schema-section.className
 ; to schema-table !document.createElement table
 ; set lane-data-schema-table schema-table.className
 ; to schema-thead !document.createElement thead
 ; to schema-hrow !document.createElement tr
 ; to col-name-th !document.createElement th
 ; assign $col-name-th { className lane-inputs-th } { textContent Name }
 ; to col-type-th !document.createElement th
 ; assign $col-type-th { className lane-inputs-th } { textContent Type }
 ; to col-multi-th !document.createElement th
 ; assign $col-multi-th { className 'lane-inputs-th lane-data-th--multi' } { textContent 'Multiple' }
 ; to col-req-th !document.createElement th
 ; assign $col-req-th { className 'lane-inputs-th lane-data-th--req' } { textContent 'Required' }
 ; to col-act-th !document.createElement th
 ; assign $col-act-th { className 'lane-inputs-th lane-inputs-th--actions' } { textContent '' }
 !schema-hrow.appendChild $col-name-th
 !schema-hrow.appendChild $col-type-th
 !schema-hrow.appendChild $col-multi-th
 !schema-hrow.appendChild $col-req-th
 !schema-hrow.appendChild $col-act-th
 !schema-thead.appendChild $schema-hrow
 ; to schema-tbody !document.createElement tbody
 ; set lane-data-schema-body schema-tbody.className
 !schema-table.appendChild $schema-thead
 !schema-table.appendChild $schema-tbody
 ; to schema-empty-el !document.createElement div
 ; assign $schema-empty-el { className lane-data-subempty } { textContent 'No columns defined.' }
 ; to add-col-btn !document.createElement button
 ; assign $add-col-btn { type button } { className lane-data-add-col } { textContent '+ Column' } { title 'Add a column to this table' }
 !schema-section.appendChild $schema-table
 !schema-section.appendChild $schema-empty-el
 !schema-section.appendChild $add-col-btn

 ; to rows-section !document.createElement div
 ; set lane-data-rows-section rows-section.className
 ; to rows-header !document.createElement div
 ; set lane-data-rows-header rows-header.className
 ; to rows-title !document.createElement div
 ; assign $rows-title { className lane-data-rows-title } { textContent 'Rows (0)' }
 ; to add-row-btn !document.createElement button
 ; assign $add-row-btn { type button } { className lane-data-add-row } { textContent '+ Row' } { title 'Add a new row to this table' }
 !rows-header.appendChild $rows-title
 !rows-header.appendChild $add-row-btn

 ; to grid-wrap !document.createElement div
 ; set lane-data-grid-wrap grid-wrap.className
 ; to display-options-el !document.createElement div
 ; assign $display-options-el { className lane-data-display-options } { hidden true }
 ; to display-options-label !document.createElement span
 ; assign $display-options-label { className lane-data-display-options-label } { textContent 'Subtables:' }
 ; to display-options-list !document.createElement div
 ; set lane-data-display-options-list display-options-list.className
 !display-options-el.appendChild $display-options-label
 !display-options-el.appendChild $display-options-list
 ; to grid-table !document.createElement table
 ; set lane-data-grid grid-table.className
 ; to grid-thead !document.createElement thead
 ; to grid-hrow !document.createElement tr
 ; to grid-frow !document.createElement tr
 ; set lane-data-filter-row grid-frow.className
 !grid-thead.appendChild $grid-hrow
 !grid-thead.appendChild $grid-frow
 ; to grid-tbody !document.createElement tbody
 ; set lane-data-grid-body grid-tbody.className
 !grid-table.appendChild $grid-thead
 !grid-table.appendChild $grid-tbody
 !grid-wrap.appendChild $display-options-el
 !grid-wrap.appendChild $grid-table

 ; to rows-empty-el !document.createElement div
 ; assign $rows-empty-el { className lane-data-subempty } { textContent 'Add at least one column to start entering rows.' }

 ; to filter-menu !document.createElement div
 ; assign $filter-menu { className lane-data-filter-menu } { hidden true }
 !filter-menu.setAttribute role dialog
 !filter-menu.setAttribute aria-label 'Column filter'
 ; to filter-menu-header !document.createElement div
 ; set lane-data-filter-menu-header filter-menu-header.className
 ; to filter-menu-col-name !document.createElement span
 ; assign $filter-menu-col-name { className lane-data-filter-menu-col } { textContent '' }
 ; to filter-menu-col-type !document.createElement span
 ; assign $filter-menu-col-type { className lane-data-th-type } { textContent '' }
 !filter-menu-header.appendChild $filter-menu-col-name
 !filter-menu-header.appendChild $filter-menu-col-type
 ; to filter-op-select !document.createElement select
 ; assign $filter-op-select { className 'lane-input-type lane-data-filter-op-select' }
 !filter-op-select.setAttribute aria-label 'Filter operator'
 ; to filter-value-wrap !document.createElement div
 ; assign $filter-value-wrap { className lane-data-filter-value-wrap } { hidden false }
 ; to filter-value-fields !document.createElement div
 ; set lane-data-filter-value-fields filter-value-fields.className
 !filter-value-wrap.appendChild $filter-value-fields
 ; to filter-error-el !document.createElement div
 ; assign $filter-error-el { className lane-data-filter-error } { textContent '' } { hidden true }
 ; to filter-menu-actions !document.createElement div
 ; set lane-data-filter-menu-actions filter-menu-actions.className
 ; to filter-apply-btn !document.createElement button
 ; assign $filter-apply-btn { type button } { className 'lane-modal-action lane-config-btn--save lane-data-filter-apply' } { textContent 'Add filter' }
 ; to filter-cancel-btn !document.createElement button
 ; assign $filter-cancel-btn { type button } { className 'lane-data-btn lane-data-filter-cancel' } { textContent Cancel }
 ; to filter-delete-btn !document.createElement button
 ; assign $filter-delete-btn { type button } { className 'lane-data-btn lane-data-filter-delete' } { textContent 'Delete filter' } { hidden true }
 !filter-menu-actions.appendChild $filter-apply-btn
 !filter-menu-actions.appendChild $filter-cancel-btn
 !filter-menu-actions.appendChild $filter-delete-btn
 !filter-menu.appendChild $filter-menu-header
 !filter-menu.appendChild $filter-op-select
 !filter-menu.appendChild $filter-value-wrap
 !filter-menu.appendChild $filter-error-el
 !filter-menu.appendChild $filter-menu-actions

 !rows-section.appendChild $rows-header
 !rows-section.appendChild $grid-wrap
 !rows-section.appendChild $rows-empty-el
 !rows-section.appendChild $filter-menu

 ; to updates-section !document.createElement div
 ; assign $updates-section { className lane-data-updates-section } { hidden true }
 ; to updates-header !document.createElement div
 ; set lane-data-updates-header updates-header.className
 ; to updates-title-wrap !document.createElement div
 ; set lane-data-updates-title-wrap updates-title-wrap.className
 ; to updates-title !document.createElement div
 ; assign $updates-title { className lane-data-updates-title } { textContent 'Updates' }
 ; to updates-count-badge !document.createElement span
 ; assign $updates-count-badge { className 'cc-badge lane-data-updates-count' } { textContent '0' }
 ; to updates-status-badge !document.createElement span
 ; assign $updates-status-badge { className 'cc-badge lane-data-updates-status' } { textContent '' } { hidden true }
 ; to updates-caption !document.createElement span
 ; assign $updates-caption { className lane-data-updates-caption } { textContent 'Deployments triggered by a record change in this table' }
 !updates-title-wrap.appendChild $updates-title
 !updates-title-wrap.appendChild $updates-count-badge
 !updates-title-wrap.appendChild $updates-status-badge
 !updates-title-wrap.appendChild $updates-caption
 ; to updates-list !document.createElement div
 ; set lane-data-updates-list updates-list.className
 !updates-header.appendChild $updates-title-wrap
 !updates-section.appendChild $updates-header
 !updates-section.appendChild $updates-list

 !active-el.appendChild $remote-bar-el
 !active-el.appendChild $table-header-el
 !active-el.appendChild $schema-section
 !active-el.appendChild $updates-section
 !active-el.appendChild $rows-section

 !root-el.appendChild $bar-el
 !root-el.appendChild $loading-el
 !root-el.appendChild $empty-el
 !root-el.appendChild $active-el
 !container.appendChild $root-el

 ; assign $view { element $root-el } { bar-el $bar-el } { tabs-el $tabs-el } { bar-actions-el $bar-actions-el } { add-table-btn $add-table-btn } { import-table-btn $import-table-btn } { loading-el $loading-el } { empty-el $empty-el } { active-el $active-el } { remote-bar-el $remote-bar-el } { remote-mode-badge $remote-mode-badge } { remote-jump-btn $remote-jump-btn } { remote-status-el $remote-status-el } { remote-edit-btn $remote-edit-btn } { table-header-el $table-header-el } { view-wrap $view-wrap } { view-btn $view-btn } { view-name-el $view-name-el } { view-count-badge $view-count-badge } { view-dirty-badge $view-dirty-badge } { view-menu $view-menu } { view-default-status $view-default-status } { view-title-btn $view-title-btn } { view-title-text $view-title-text } { view-rename-row $view-rename-row } { view-rename-input $view-rename-input } { view-rename-btn $view-rename-btn } { view-rename-cancel-btn $view-rename-cancel-btn } { view-draft-row $view-draft-row } { view-save-btn $view-save-btn } { view-fork-btn $view-fork-btn } { view-abandon-btn $view-abandon-btn } { view-list-el $view-list-el } { view-new-btn $view-new-btn } { view-duplicate-btn $view-duplicate-btn } { view-reset-btn $view-reset-btn } { view-delete-btn $view-delete-btn } { header-actions-el $header-actions-el } { schema-toggle-btn $schema-toggle-btn } { table-menu-wrap $table-menu-wrap } { table-menu-btn $table-menu-btn } { table-menu $table-menu } { edit-table-btn $edit-table-btn } { edit-table-modal $edit-table-modal } { jump-owner-btn $jump-owner-btn } { edit-import-btn $edit-import-btn } { clear-rows-btn $clear-rows-btn } { delete-table-btn $delete-table-btn } { schema-section $schema-section } { schema-tbody $schema-tbody } { schema-empty-el $schema-empty-el } { add-col-btn $add-col-btn } { updates-section $updates-section } { updates-header $updates-header } { updates-title-wrap $updates-title-wrap } { updates-title $updates-title } { updates-count-badge $updates-count-badge } { updates-status-badge $updates-status-badge } { updates-caption $updates-caption } { updates-list $updates-list } { rows-section $rows-section } { rows-title $rows-title } { add-row-btn $add-row-btn } { grid-wrap $grid-wrap } { display-options-el $display-options-el } { display-options-label $display-options-label } { display-options-list $display-options-list } { grid-hrow $grid-hrow } { grid-frow $grid-frow } { grid-tbody $grid-tbody } { rows-empty-el $rows-empty-el } { filter-menu $filter-menu } { filter-menu-col-name $filter-menu-col-name } { filter-menu-col-type $filter-menu-col-type } { filter-op-select $filter-op-select } { filter-value-wrap $filter-value-wrap } { filter-value-fields $filter-value-fields } { filter-error-el $filter-error-el } { filter-apply-btn $filter-apply-btn } { filter-cancel-btn $filter-cancel-btn } { filter-delete-btn $filter-delete-btn }

 ; to clear-children (
  -- Safely removes all child nodes from an element in both browser and mock DOMs
  ; to { parent } $argv
  [ match
   { $parent.children (
    ; while { propertyIsGreaterThan 0 parent.children.length } (
     ; to prev-len $parent.children.length
     ; to cidx ; subtract $prev-len 1
     ; to child [ get parent.children $cidx ]
     [ match
      { $child.remove : !child.remove }
     ]
     ; condition { propertyIs $prev-len parent.children.length } : !parent.children.pop
    )
   ) }
  ]
 )

 ; to view.close-table-menu (
  -- Closes the "..." table actions dropdown menu
  ; set false view.table-menu-open
  ; set true table-menu.hidden
  ; set 'lane-data-btn lane-data-table-menu-btn' table-menu-btn.className
  !table-menu-btn.setAttribute aria-expanded 'false'
 )

 ; to view.close-view-menu (
  -- Closes the table views selector popover
  ; set false view.view-menu-open
  ; set false view.editing-view-name
  ; set true view-menu.hidden
  !view-btn.setAttribute aria-expanded 'false'
  !view.sync-view-btn-class
 )

 ; to view.close-filter-menu (
  -- Closes the column filter popover menu and clears transient inputs
  ; set false view.filter-editor.open
  ; set true filter-menu.hidden
  ; set '' filter-error-el.textContent
  ; set true filter-error-el.hidden
  ; while { propertyIsGreaterThan 0 view.filter-input-els.length } (
   ; to old-in !view.filter-input-els.pop
   [ match { $old-in.remove : !old-in.remove } ]
  )
  !clear-children $filter-value-fields
  ; set null view.filter-val-el
  ; set null view.filter-val-to-el
 )

 ; to view.open-table-menu (
  -- Opens the "..." table actions dropdown menu
  !view.close-view-menu
  !view.close-filter-menu
  ; set true view.table-menu-open
  ; set false table-menu.hidden
  ; set 'lane-data-btn lane-data-table-menu-btn lane-data-table-menu-btn--open' table-menu-btn.className
  !table-menu-btn.setAttribute aria-expanded 'true'
 )

 ; to view.toggle-table-menu (
  -- Toggles the "..." table actions dropdown menu open or closed
  [ match
   { $view.table-menu-open : !view.close-table-menu }
   { true : !view.open-table-menu }
  ]
 )

 ; to edit-table-modal.close (
  -- Closes the Edit Table modal without saving and detaches it from the DOM
  ; condition { propertyIs true edit-table-modal.is-open } (
   ; to prev-lane $edit-table-modal.lane
   ; set false edit-table-modal.is-open
   ; set null edit-table-modal.table
   ; set null edit-table-modal.lane
   ; set '' edit-table-error-el.textContent
   ; set true edit-table-error-el.hidden
   !edit-table-backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $edit-table-modal }
   ]
  )
 )

 ; to view.rename-table (
  -- Applies a table rename, updates tabs/view selector/notebook scope/URL path, and persists schema
  ; to { target-tbl next-name } $argv
  ; to is-ro [ match { $target-tbl : !view.is-readonly-table $target-tbl } { true : true } ]
  ; to raw-name [ match
   { [ propertyIs undefined next-name ] : '' }
   { [ propertyIs null next-name ] : '' }
   { true : ; add '' $next-name }
  ]
  ; to trimmed !raw-name.trim
  ; to empty-name [ propertyIs '' trimmed ]
  [ match
   { [ and { $target-tbl } { [ propertyIs false is-ro ] } { [ propertyIs false empty-name ] } ] (
    ; to prev-name $target-tbl.name
    ; set $trimmed target-tbl.name
    ; condition { propertyIs $target-tbl.id view.active-table-id } : ; set $trimmed lane.subroute
    !view.sync-notebook-table-scope $prev-name
    !view.update-table-tabs-text
    !view.sync-view-ui
    ; to is-rem !view.is-remote-table $target-tbl
    ; to is-custom [ match
     { [ and { $is-rem } { [ propertyIs true target-tbl.remote.customName ] } ] : true }
     { true : false }
    ]
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
     [ match
      { $is-custom [ match
       { $saveImportedTableLink : !saveImportedTableLink $data $view.lane.data $view.lane.id $target-tbl }
       { true : !view.save-schema $target-tbl }
      ] }
      { true (
       [ match
        { $is-rem (
         ; set $target-tbl.remote.tableName target-tbl.name
         ; condition { propertyIs $target-tbl.id view.active-table-id } : ; set $target-tbl.name lane.subroute
         !view.render-remote-bar
         !view.sync-view-ui
        ) }
       ]
       !view.save-schema $target-tbl
      ) }
     ]
     !view.sync-data-path
     [ match
      { $lane-control.update-url : !lane-control.update-url }
     ]
    ) : null
    [ match
     { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
    ]
    true
   ) }
   { true : false }
  ]
 )

 ; to edit-table-modal.save (
  -- Validates and saves the renamed table name from the Edit Table modal
  ; to tbl $edit-table-modal.table
  ; to is-ro [ match { $tbl : !view.is-readonly-table $tbl } { true : true } ]
  [ match
   { [ and { [ propertyIs true edit-table-modal.is-open ] } { [ propertyIs false edit-table-modal.is-saving ] } { $tbl } { [ propertyIs false is-ro ] } ] (
    ; to raw $edit-table-name-input.value
    ; to trimmed !raw.trim
    [ match
     { [ propertyIs '' trimmed ] (
      ; set 'Enter a table name' edit-table-error-el.textContent
      ; set false edit-table-error-el.hidden
      [ match { $edit-table-name-input.focus : !edit-table-name-input.focus } ]
      false
     ) }
     { true (
      ; set true edit-table-modal.is-saving
      ; set true edit-table-save-btn.disabled
      ; set 'lane-modal-action lane-config-btn--save cc-btn-busy' edit-table-save-btn.className
      ; set 'Saving…' edit-table-save-btn.textContent
      ; try (
       !view.rename-table $tbl $trimmed
      ) : null
      ; set false edit-table-modal.is-saving
      ; set false edit-table-save-btn.disabled
      ; set 'lane-modal-action lane-config-btn--save' edit-table-save-btn.className
      ; set 'Save changes' edit-table-save-btn.textContent
      !edit-table-modal.close
      true
     ) }
    ]
   ) }
   { true : false }
  ]
 )

 ; to view.open-edit-table-modal (
  -- Opens the lane-scoped Edit Table modal from the "..." menu without modifying the View selector header
  !view.close-table-menu
  !view.close-view-menu
  !view.close-filter-menu
  ; to tbl !view.get-active-table
  ; to is-ro [ match { $tbl : !view.is-readonly-table $tbl } { true : true } ]
  [ match
   { [ and { $tbl } { [ propertyIs false is-ro ] } ] (
    !edit-table-modal.close
    ; set $view.lane edit-table-modal.lane
    ; set $tbl edit-table-modal.table
    ; set $tbl.id edit-table-id-el.textContent
    ; set $tbl.name edit-table-name-input.value
    ; set '' edit-table-error-el.textContent
    ; set true edit-table-error-el.hidden
    ; set false edit-table-save-btn.disabled
    ; set 'lane-modal-action lane-config-btn--save' edit-table-save-btn.className
    ; set 'Save changes' edit-table-save-btn.textContent
    ; set 'lane-modal-backdrop lane-config-backdrop lane-edit-table-backdrop' edit-table-backdrop.className
    ; set true edit-table-modal.is-open
    [ match
     { $lane-control.mount-lane-modal : !lane-control.mount-lane-modal $view.lane $edit-table-modal }
     { $view.container.appendChild (
      !edit-table-backdrop.setAttribute data-lane-modal 'true'
      ; set 'lane-modal-backdrop lane-config-backdrop lane-edit-table-backdrop lane-modal-backdrop--lane' edit-table-backdrop.className
      !view.container.appendChild $edit-table-backdrop
     ) }
     { $view.lane.body.appendChild (
      !edit-table-backdrop.setAttribute data-lane-modal 'true'
      ; set 'lane-modal-backdrop lane-config-backdrop lane-edit-table-backdrop lane-modal-backdrop--lane' edit-table-backdrop.className
      !view.lane.body.appendChild $edit-table-backdrop
     ) }
     { $document.body.appendChild : !document.body.appendChild $edit-table-backdrop }
    ]
    [ match { $edit-table-name-input.focus : !edit-table-name-input.focus } ]
    [ match { $edit-table-name-input.select : !edit-table-name-input.select } ]
    $edit-table-modal
   ) }
   { true : null }
  ]
 )

 ; to funnel-svg '<svg class="lane-data-filter-funnel-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 2H10.5L7 6.1V9.8L5 10.8V6.1L1.5 2Z"></path></svg>'

 ; to view.lookup-lane-title (
  -- Returns display title for a linked lane ID if known, otherwise falls back to the ID
  ; to { lane-id } $argv
  ; to info !view.lookup-lane-info $lane-id
  [ match
   { $info.found : $info.title }
   { true : $lane-id }
  ]
 )

 ; to view.get-table-index (
  -- Returns 0-based index of a table within view.tables (or 0 if missing)
  ; to { tbl } $argv
  [ match
   { $tbl (
    ; to idx !view.tables.indexOf $tbl
    [ ternary [ propertyIsLessThan 0 idx ] 0 $idx ]
   ) }
   { true : 0 }
  ]
 )

 ; to view.clear-pinned-rows (
  -- Clears temporarily pinned new rows for a table when view, filters, or table selection changes
  ; to { tbl-id } $argv
  [ match
   { $tbl-id : ; to view.pinned-row-ids $tbl-id {} }
  ]
 )

 ; to view.pin-row-id (
  -- Pins a newly added row ID so it stays visible even when active filters would hide its default values
  ; to { tbl-id row-id } $argv
  [ match
   { [ and { $tbl-id } { $row-id } ] (
    ; to cur [ get view.pinned-row-ids $tbl-id ]
    ; to list [ match
     { [ !window.Array.isArray $cur ] : $cur }
     { true : {} }
    ]
    ; to has-id !list.includes $row-id
    ; condition { propertyIs false has-id } : !list.push $row-id
    ; to view.pinned-row-ids $tbl-id $list
   ) }
  ]
 )

 ; to view.unpin-row-id (
  -- Removes a deleted row ID from the pinned rows list of a table
  ; to { tbl-id row-id } $argv
  [ match
   { [ and { $tbl-id } { $row-id } ] (
    ; to cur [ get view.pinned-row-ids $tbl-id ]
    [ match
     { [ !window.Array.isArray $cur ] (
      ; to next {}
      ; each $cur (
       ; to { pid } $argv
       ; to is-same [ propertyIs $row-id pid ]
       ; condition { propertyIs false is-same } : !next.push $pid
      )
      ; to view.pinned-row-ids $tbl-id $next
     ) }
    ]
   ) }
  ]
 )

 ; to view.register-views-used-ids (
  -- Registers loaded view and filter IDs in view.used-ids so generated IDs never collide
  ; to { st } $argv
  [ match
   { [ and { $st } { [ !window.Array.isArray $st.views ] } ] (
    ; each $st.views (
     ; to { v } $argv
     [ match { $v.id : ; to view.used-ids $v.id true } ]
     [ match
      { [ !window.Array.isArray $v.filters ] (
       ; each $v.filters (
        ; to { f } $argv
        [ match { $f.id : ; to view.used-ids $f.id true } ]
       )
      ) }
     ]
    )
   ) }
  ]
 )

 ; to view.ensure-table-views-state (
  -- Returns existing view state for a table or initializes the default view state
  ; to { tbl } $argv
  [ match
   { [ and { $tbl } { $tbl.id } ] (
    ; to existing [ get view.table-views $tbl.id ]
    [ match
     { $existing : $existing }
     { true (
      ; to def-id [ match { $DEFAULT_TABLE_VIEW_ID : $DEFAULT_TABLE_VIEW_ID } { true : default } ]
      ; to fallback-views {}
      !fallback-views.push [ object { id $def-id } { name '' } { isDefault true } { filters {} } ]
      ; to norm [ match
       { $normalizeTableViewsRecord : !normalizeTableViewsRecord null $tbl.columns $view.tables }
       { true : ; object { activeViewId $def-id } { views $fallback-views } }
      ]
      ; to active-box ; object { v null }
      ; each $norm.views (
       ; to { v } $argv
       ; condition { propertyIs $norm.activeViewId v.id } : ; set $v active-box.v
      )
      [ match
       { [ propertyIs null active-box.v ] : ; set [ get norm.views 0 ] active-box.v }
      ]
      ; to active-v $active-box.v
      ; to wf !clone-plain-data [ match { $active-v.filters : $active-v.filters } { true : {} } ] {}
      ; to st [ object
       { activeViewId $norm.activeViewId }
       { views $norm.views }
       { workingFilters $wf }
      ]
      !view.register-views-used-ids $st
      ; to view.table-views $tbl.id $st
      $st
     ) }
    ]
   ) }
   { true : null }
  ]
 )

 ; to view.get-active-view-record (
  -- Returns the currently active saved view record for a table (falling back to the first view)
  ; to { tbl st } $argv
  ; to eff-tbl [ match { $tbl : $tbl } { true : !view.get-active-table } ]
  ; to eff-st [ match
   { $st : $st }
   { $eff-tbl : !view.ensure-table-views-state $eff-tbl }
   { true : null }
  ]
  [ match
   { [ and { $eff-st } { [ !window.Array.isArray $eff-st.views ] } { [ propertyIsGreaterThan 0 eff-st.views.length ] } ] (
    ; to found ; object { rec null }
    ; each $eff-st.views (
     ; to { v } $argv
     ; condition { propertyIs $eff-st.activeViewId v.id } : ; set $v found.rec
    )
    [ match
     { $found.rec : $found.rec }
     { true : [ get eff-st.views 0 ] }
    ]
   ) }
   { true : null }
  ]
 )

 ; to view.is-view-dirty (
  -- Returns true when workingFilters differ from the active view's saved filters
  ; to { tbl st } $argv
  ; to eff-tbl [ match { $tbl : $tbl } { true : !view.get-active-table } ]
  ; to eff-st [ match
   { $st : $st }
   { $eff-tbl : !view.ensure-table-views-state $eff-tbl }
   { true : null }
  ]
  ; to active-v [ match { $eff-st : !view.get-active-view-record $eff-tbl $eff-st } { true : null } ]
  [ match
   { [ and { $eff-st } { $active-v } ] (
    [ match
     { $tableViewFiltersEqual (
      ; to eq !tableViewFiltersEqual $active-v.filters $eff-st.workingFilters
      [ propertyIs false eq ]
     ) }
     { true : false }
    ]
   ) }
   { true : false }
  ]
 )

 ; to view.persist-table-views (
  -- Persists saved view definitions for a table without triggering deployment record updates
  ; to { tbl } $argv
  [ match
   { [ and { $tbl } { $tbl.id } { $saveTableViews } ] (
    ; to st !view.ensure-table-views-state $tbl
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
     !saveTableViews $data $view.lane.data $view.lane.id $tbl.id [ object { activeViewId $st.activeViewId } { views $st.views } ] $tbl.columns $view.tables
    ) : null
    [ match
     { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
    ]
   ) }
  ]
 )

 ; to view.sanitize-views-for-table (
  -- Drops saved and working filters referencing deleted or incompatible columns without wiping views during remote outages
  ; to { tbl persist } $argv
  [ match
   { [ and { $tbl } { $tbl.id } { $sanitizeTableViewsForColumns } ] (
    ; to skip-outage [ match
     { [ and { $tbl.remote } { [ propertyIs true tbl.remote.missing ] } ] : true }
     { [ and { $tbl.remote } { [ propertyIs true tbl.remote.accessDenied ] } ] : true }
     { true : false }
    ]
    ; condition { propertyIs false skip-outage } (
     ; to st !view.ensure-table-views-state $tbl
     ; to res !sanitizeTableViewsForColumns $st $tbl.columns $view.tables
     ; set $res.activeViewId st.activeViewId
     ; set $res.views st.views
     ; to next-wf !clone-plain-data [ match { $res.workingFilters : $res.workingFilters } { true : {} } ] {}
     ; set $next-wf st.workingFilters
     [ match
      { [ and { [ propertyIs true persist ] } { [ propertyIs true res.savedChanged ] } ] : !view.persist-table-views $tbl }
     ]
    )
   ) }
  ]
 )

 ; to view.sync-view-btn-class (
  -- Keeps the View selector button highlight synced with open and Unsaved filters states
  ; to tbl !view.get-active-table
  ; to is-dirty [ match { $tbl : !view.is-view-dirty $tbl null } { true : false } ]
  ; to cls-dirty [ ternary $is-dirty ' lane-data-view-btn--dirty' '' ]
  ; to cls-open [ ternary $view.view-menu-open ' lane-data-view-btn--open' '' ]
  ; set [ add 'lane-data-view-btn' ; add $cls-dirty $cls-open ] view-btn.className
 )

 ; to view.render-view-options (
  -- Renders clickable view items in the Views popover and locks switching while Unsaved filters exist
  ; to { tbl st is-dirty } $argv
  ; while { propertyIsGreaterThan 0 view.view-option-els.length } (
   ; to old-o !view.view-option-els.pop
   [ match { $old-o.el.remove : !old-o.el.remove } ]
  )
  !clear-children $view-list-el
  ; to t-idx !view.get-table-index $tbl
  ; each $st.views (
   ; to { v } $argv
   ; to is-active [ propertyIs $st.activeViewId v.id ]
   ; to v-name [ match
    { $resolveTableViewDisplayName : !resolveTableViewDisplayName $v $tbl $t-idx }
    { true : [ match { $v.isDefault : !view.display-table-name $tbl $t-idx } { $v.name : $v.name } { true : View } ] }
   ]
   ; to f-count [ match
    { $is-active : $st.workingFilters.length }
    { [ !window.Array.isArray $v.filters ] : $v.filters.length }
    { true : 0 }
   ]
   ; to opt-cls [ ternary $is-active 'lane-data-view-option lane-data-view-option--active' lane-data-view-option ]
   ; to opt-btn !document.createElement button
   ; assign $opt-btn { type button } { className $opt-cls }
   !opt-btn.setAttribute role option
   !opt-btn.setAttribute aria-selected [ ternary $is-active 'true' 'false' ]
   ; to lock-switch [ ternary [ and { [ propertyIs true is-dirty ] } { [ propertyIs false is-active ] } ] true false ]
   ; set $lock-switch opt-btn.disabled
   ; set [ ternary $lock-switch 'Save, fork, or abandon unsaved filters before switching views' [ add 'Switch to view ' $v-name ] ] opt-btn.title
   ; to name-el !document.createElement span
   ; assign $name-el { className lane-data-view-option-name } { textContent $v-name }
   ; to meta-el !document.createElement span
   ; to meta-parts {}
   ; condition { propertyIs true v.isDefault } : !meta-parts.push default
   ; condition { propertyIsGreaterThan 0 f-count } : !meta-parts.push [ add $f-count [ ternary [ propertyIs 1 f-count ] ' filter' ' filters' ] ]
   ; condition { and { [ propertyIs true is-active ] } { [ propertyIs true is-dirty ] } } : !meta-parts.push unsaved
   ; to meta-txt !meta-parts.join ' · '
   ; assign $meta-el { className lane-data-view-option-meta } { textContent $meta-txt }
   !opt-btn.appendChild $name-el
   !opt-btn.appendChild $meta-el
   !opt-btn.addEventListener click (
    ; to { ev } $argv
    [ match { $ev.stopPropagation : !ev.stopPropagation } ]
    !view.switch-view $v.id
   )
   !view-list-el.appendChild $opt-btn
   !view.view-option-els.push ; object { id $v.id } { el $opt-btn }
  )
 )

 ; to view.sync-view-ui (
  -- Synchronizes the View selector button label, filter count badge, Unsaved filters bar, and popover controls
  ; to tbl !view.get-active-table
  [ match
   { [ propertyIs null tbl ] (
    ; set '' view-name-el.textContent
    ; set '' view-count-badge.textContent
    ; set true view-count-badge.hidden
    ; set true view-dirty-badge.hidden
    ; set '' view-title-text.textContent
    ; set true view-title-btn.hidden
    ; set true view-rename-row.hidden
    ; set true view-default-status.hidden
    ; set false view.editing-view-name
    ; while { propertyIsGreaterThan 0 view.view-option-els.length } (
     ; to old-o !view.view-option-els.pop
     [ match { $old-o.el.remove : !old-o.el.remove } ]
    )
    !clear-children $view-list-el
    !view.sync-view-btn-class
   ) }
   { true (
    ; to st !view.ensure-table-views-state $tbl
    ; to active-v !view.get-active-view-record $tbl $st
    ; to t-idx !view.get-table-index $tbl
    ; to v-name [ match
     { $resolveTableViewDisplayName : !resolveTableViewDisplayName $active-v $tbl $t-idx }
     { true : !view.display-table-name $tbl $t-idx }
    ]
    ; to is-dirty !view.is-view-dirty $tbl $st
    ; to f-count $st.workingFilters.length
    ; to is-default [ propertyIs true active-v.isDefault ]
    ; set $v-name view-name-el.textContent
    ; set [ add '' $f-count ] view-count-badge.textContent
    ; set [ propertyIs 0 f-count ] view-count-badge.hidden
    ; set [ ternary $is-dirty false true ] view-dirty-badge.hidden
    !view.sync-view-btn-class

    [ match
     { $is-default (
      ; set false view.editing-view-name
      ; set false view-default-status.hidden
      ; set [ add 'Default view · named after table (' ; add $v-name ')' ] view-default-status.textContent
      ; set true view-title-btn.hidden
      ; set true view-rename-row.hidden
     ) }
     { true (
      ; set true view-default-status.hidden
      ; set $v-name view-title-text.textContent
      [ match
       { [ propertyIs true view.editing-view-name ] (
        ; set true view-title-btn.hidden
        ; set false view-rename-row.hidden
        ; to is-focused [ propertyIs $view-rename-input document.activeElement ]
        ; condition { propertyIs false is-focused } : ; set $v-name view-rename-input.value
       ) }
       { true (
        ; set false view-title-btn.hidden
        ; set true view-rename-row.hidden
       ) }
      ]
     ) }
    ]
    ; set [ ternary $is-dirty false true ] view-draft-row.hidden
    ; to draft-unit [ ternary [ propertyIs 1 f-count ] ' filter)' ' filters)' ]
    ; set [ add 'Unsaved filters (' ; add $f-count $draft-unit ] view-draft-label.textContent
    ; set $is-dirty view-new-btn.disabled
    ; set [ ternary $is-dirty 'Save, fork, or abandon unsaved filters before creating a new view' 'Create a new view for this table' ] view-new-btn.title
    ; set false view-duplicate-btn.disabled
    ; to no-filters [ propertyIs 0 f-count ]
    ; set $no-filters view-reset-btn.disabled
    ; to can-delete [ ternary [ and { [ propertyIs false is-default ] } { [ propertyIsGreaterThan 1 st.views.length ] } ] true false ]
    ; set [ propertyIs false can-delete ] view-delete-btn.disabled
    ; set [ ternary $is-default 'Default view cannot be deleted' 'Delete this saved view' ] view-delete-btn.title
    !view.render-view-options $tbl $st $is-dirty
   ) }
  ]
 )

 ; to view.open-view-menu (
  -- Opens the table Views selector popover
  !view.close-table-menu
  !view.close-filter-menu
  ; set true view.view-menu-open
  ; set false view-menu.hidden
  !view-btn.setAttribute aria-expanded 'true'
  !view.sync-view-ui
 )

 ; to view.toggle-view-menu (
  -- Toggles the table Views selector popover open or closed
  [ match
   { $view.view-menu-open : !view.close-view-menu }
   { true : !view.open-view-menu }
  ]
 )

 ; to view.switch-view (
  -- Switches to a saved table view when no unsaved filter changes block switching
  ; to { target-id } $argv
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    [ match
     { [ propertyIs $st.activeViewId target-id ] : !view.close-view-menu }
     { true (
      ; to is-dirty !view.is-view-dirty $tbl $st
      ; condition { propertyIs false is-dirty } (
       ; to found-box ; object { v null }
       ; each $st.views (
        ; to { v } $argv
        ; condition { propertyIs $target-id v.id } : ; set $v found-box.v
       )
       ; to found-v $found-box.v
       [ match
        { $found-v (
         ; set $found-v.id st.activeViewId
         ; to next-wf !clone-plain-data [ match { $found-v.filters : $found-v.filters } { true : {} } ] {}
         ; set $next-wf st.workingFilters
         ; set false view.editing-view-name
         !view.clear-pinned-rows $tbl.id
         !view.close-view-menu
         !view.close-filter-menu
         !view.sync-view-ui
         !view.render-grid
         !view.persist-table-views $tbl
        ) }
       ]
      )
     ) }
    ]
   ) }
  ]
 )

 ; to view.save-active-view (
  -- Saves workingFilters onto the active view record and persists table views
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    ; to active-v !view.get-active-view-record $tbl $st
    [ match
     { $active-v (
      ; to saved-clone !clone-plain-data $st.workingFilters {}
      ; set $saved-clone active-v.filters
      !view.clear-pinned-rows $tbl.id
      !view.sync-view-ui
      !view.render-grid
      !view.persist-table-views $tbl
     ) }
    ]
   ) }
  ]
 )

 ; to view.fork-active-view (
  -- Creates a new saved view with the current working filters, leaving the original view unchanged
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    ; to active-v !view.get-active-view-record $tbl $st
    ; to t-idx !view.get-table-index $tbl
    ; to cur-name [ match
     { $resolveTableViewDisplayName : !resolveTableViewDisplayName $active-v $tbl $t-idx }
     { true : !view.display-table-name $tbl $t-idx }
    ]
    ; to fork-base ; add $cur-name ' copy'
    ; to new-name [ match
     { $buildUniqueTableViewName : !buildUniqueTableViewName $st.views $fork-base $tbl $t-idx }
     { true : $fork-base }
    ]
    ; to new-id !view.next-id view
    ; to saved-clone !clone-plain-data $st.workingFilters {}
    ; to next-wf !clone-plain-data $st.workingFilters {}
    ; to new-view [ object
     { id $new-id }
     { name $new-name }
     { isDefault false }
     { filters $saved-clone }
    ]
    !st.views.push $new-view
    ; set $new-id st.activeViewId
    ; set $next-wf st.workingFilters
    ; set false view.editing-view-name
    !view.clear-pinned-rows $tbl.id
    !view.sync-view-ui
    !view.render-grid
    !view.persist-table-views $tbl
    $new-view
   ) }
  ]
 )

 ; to view.abandon-view-changes (
  -- Reverts workingFilters back to the active view's saved filters
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    ; to active-v !view.get-active-view-record $tbl $st
    [ match
     { $active-v (
      ; to restored !clone-plain-data [ match { $active-v.filters : $active-v.filters } { true : {} } ] {}
      ; set $restored st.workingFilters
      !view.clear-pinned-rows $tbl.id
      !view.close-filter-menu
      !view.sync-view-ui
      !view.render-grid
     ) }
    ]
   ) }
  ]
 )

 ; to view.create-new-view (
  -- Creates a blank custom view when no unsaved filters block switching
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    ; to is-dirty !view.is-view-dirty $tbl $st
    ; condition { propertyIs false is-dirty } (
     ; to t-idx !view.get-table-index $tbl
     ; to new-name [ match
      { $buildUniqueTableViewName : !buildUniqueTableViewName $st.views View $tbl $t-idx }
      { true : View }
     ]
     ; to new-id !view.next-id view
     ; to new-view [ object
      { id $new-id }
      { name $new-name }
      { isDefault false }
      { filters {} }
     ]
     !st.views.push $new-view
     ; set $new-id st.activeViewId
     ; set {} st.workingFilters
     ; set false view.editing-view-name
     !view.clear-pinned-rows $tbl.id
     !view.close-filter-menu
     !view.sync-view-ui
     !view.render-grid
     !view.persist-table-views $tbl
     $new-view
    )
   ) }
  ]
 )

 ; to view.duplicate-active-view (
  -- Duplicates the active view (including current working filters) into a new saved view
  !view.fork-active-view
 )

 ; to view.reset-active-view (
  -- Clears all working filters on the current view (dirtying saved views until saved or abandoned)
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    ; set {} st.workingFilters
    !view.clear-pinned-rows $tbl.id
    !view.close-filter-menu
    !view.sync-view-ui
    !view.render-grid
   ) }
  ]
 )

 ; to view.request-delete-view (
  -- Prompts for confirmation before deleting a custom saved view
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    ; to active-v !view.get-active-view-record $tbl $st
    ; to is-def [ match { $active-v : [ propertyIs true active-v.isDefault ] } { true : true } ]
    ; to can-del [ ternary [ and { [ propertyIs false is-def ] } { [ propertyIsGreaterThan 1 st.views.length ] } ] true false ]
    ; condition { propertyIs true can-del } (
     ; to t-idx !view.get-table-index $tbl
     ; to v-name [ match
      { $resolveTableViewDisplayName : !resolveTableViewDisplayName $active-v $tbl $t-idx }
      { true : $active-v.name }
     ]
     !view.close-view-menu
     !view.close-filter-menu
     ; to msg ; add 'Delete view "' ; add $v-name '"?'
     ; to opts [ object
      { title 'Delete View' }
      { message $msg }
      { require-agreement false }
      { confirm-label 'Delete view' }
      { on-confirm (
       ; to next-views {}
       ; each $st.views (
        ; to { v } $argv
        ; to same-id [ propertyIs $active-v.id v.id ]
        ; condition { propertyIs false same-id } : !next-views.push $v
       )
       ; set $next-views st.views
       ; to fallback-v [ get next-views 0 ]
       ; set [ match { $fallback-v : $fallback-v.id } { true : default } ] st.activeViewId
       ; to restored !clone-plain-data [ match { $fallback-v.filters : $fallback-v.filters } { true : {} } ] {}
       ; set $restored st.workingFilters
       ; set false view.editing-view-name
       !view.clear-pinned-rows $tbl.id
       !view.sync-view-ui
       !view.render-grid
       !view.persist-table-views $tbl
      ) }
     ]
     !view.confirm $opts
    )
   ) }
  ]
 )

 ; to view.open-edit-view-name (
  -- Enters click-to-edit rename mode inside the Views popover for custom views
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    ; to active-v !view.get-active-view-record $tbl $st
    ; to is-def [ match { $active-v : [ propertyIs true active-v.isDefault ] } { true : true } ]
    ; condition { propertyIs false is-def } (
     ; to t-idx !view.get-table-index $tbl
     ; to v-name [ match
      { $resolveTableViewDisplayName : !resolveTableViewDisplayName $active-v $tbl $t-idx }
      { true : $active-v.name }
     ]
     ; set true view.editing-view-name
     ; set $v-name view-rename-input.value
     !view.sync-view-ui
     [ match { $view-rename-input.focus : !view-rename-input.focus } ]
     [ match { $view-rename-input.select : !view-rename-input.select } ]
    )
   ) }
  ]
 )

 ; to view.cancel-edit-view-name (
  -- Exits click-to-edit rename mode inside the Views popover without changing the view name
  ; set false view.editing-view-name
  !view.sync-view-ui
 )

 ; to view.rename-active-view (
  -- Renames the active custom (non-default) view, exits edit mode, and persists table views
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to st !view.ensure-table-views-state $tbl
    ; to active-v !view.get-active-view-record $tbl $st
    ; to is-def [ match { $active-v : [ propertyIs true active-v.isDefault ] } { true : true } ]
    ; condition { propertyIs false is-def } (
     ; to raw $view-rename-input.value
     ; to trimmed !raw.trim
     ; to is-empty [ propertyIs '' trimmed ]
     ; set false view.editing-view-name
     [ match
      { [ propertyIs false is-empty ] (
       ; set $trimmed active-v.name
       !view.sync-view-ui
       !view.persist-table-views $tbl
      ) }
      { true : !view.sync-view-ui }
     ]
    )
   ) }
  ]
 )

 ; to view.format-bubble-text (
  -- Formats concise pill text for an active column filter bubble
  ; to { tbl col flt } $argv
  ; to clock-opts !view.get-clock-display-opts
  ; to opts [ object
   { tables $view.tables }
   { ownerTable $tbl }
   { displayOpts $clock-opts }
   { lookupLaneTitle $view.lookup-lane-title }
  ]
  [ match
   { $formatTableFilterBubbleLabel : !formatTableFilterBubbleLabel $flt $col $opts }
   { true : $flt.operator }
  ]
 )

 ; to view.refresh-filter-bubble-labels (
  -- Refreshes displayed bubble labels after lane title or timezone display changes
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; each $view.grid-filter-cells (
     ; to { fcell } $argv
     [ match
      { [ and { $fcell.col } { [ !window.Array.isArray $fcell.chips ] } ] (
       ; each $fcell.chips (
        ; to { chip } $argv
        [ match
         { [ and { $chip.label-el } { $chip.flt } ] : ; set [ !view.format-bubble-text $tbl $fcell.col $chip.flt ] chip.label-el.textContent }
        ]
       )
      ) }
     ]
    )
   ) }
  ]
 )

 ; to view.build-single-filter-control (
  -- Builds the typed input or select control for a filter editor operand
  ; to { tbl col op-desc initial-val placeholder-override } $argv
  ; to kind [ match { $op-desc.inputKind : $op-desc.inputKind } { true : text } ]
  ; to init-str [ match
   { [ propertyIs undefined initial-val ] : '' }
   { [ propertyIs null initial-val ] : '' }
   { true : ; add '' $initial-val }
  ]
  ; to is-num-kind [ match
   { [ propertyIs integer kind ] : true }
   { [ propertyIs decimal kind ] : true }
   { [ propertyIs fixed kind ] : true }
   { true : false }
  ]
  ; to ctrl [ match
   { [ propertyIs boolean kind ] (
    ; to sel !document.createElement select
    ; set 'lane-input-type lane-data-filter-input' sel.className
    !sel.setAttribute aria-label 'Filter boolean value'
    ; to opt-t !document.createElement option
    ; assign $opt-t { value 'true' } { textContent 'true' }
    ; to opt-f !document.createElement option
    ; assign $opt-f { value 'false' } { textContent 'false' }
    !sel.appendChild $opt-t
    !sel.appendChild $opt-f
    ; set [ ternary [ propertyIs 'false' init-str ] 'false' 'true' ] sel.value
    $sel
   ) }
   { [ propertyIs workflow kind ] (
    ; to wf [ match
     { $resolveWorkflowTarget : !resolveWorkflowTarget $view.tables $col }
     { true : ; object { valid false } { values {} } }
    ]
    [ match
     { [ and { [ propertyIs true wf.valid ] } { [ propertyIsGreaterThan 0 wf.values.length ] } ] (
      ; to sel !document.createElement select
      ; set 'lane-input-type lane-data-filter-input' sel.className
      !sel.setAttribute aria-label 'Filter workflow value'
      ; to seen ; object
      ; each $wf.values (
       ; to { wv } $argv
       ; to wv-str ; add '' $wv
       ; to opt !document.createElement option
       ; assign $opt { value $wv-str } { textContent $wv-str }
       !sel.appendChild $opt
       ; to seen $wv-str true
      )
      ; to is-init-empty [ propertyIs '' init-str ]
      [ match
       { [ propertyIs false is-init-empty ] (
        ; to has-seen [ get seen $init-str ]
        ; to seen-flag [ propertyIs true has-seen ]
        ; condition { propertyIs false seen-flag } (
         ; to extra !document.createElement option
         ; assign $extra { value $init-str } { textContent $init-str }
         !sel.appendChild $extra
        )
        ; set $init-str sel.value
       ) }
       { true : ; set [ add '' [ get wf.values 0 ] ] sel.value }
      ]
      $sel
     ) }
     { true (
      ; to inp !document.createElement input
      ; assign $inp { type text } { className 'lane-data-cell-input lane-data-filter-input' } { placeholder [ match { $placeholder-override : $placeholder-override } { true : 'Workflow value…' } ] } { spellcheck false } { autocomplete off }
      ; set $init-str inp.value
      $inp
     ) }
    ]
   ) }
   { [ propertyIs row kind ] (
    ; to clock-opts !view.get-clock-display-opts
    ; to page [ match
     { $fetchRowOptionsPage : !fetchRowOptionsPage $view.tables $col [ object { offset 0 } { limit 200 } { ownerTable $tbl } { displayOpts $clock-opts } ] }
     { true : ; object { options {} } }
    ]
    [ match
     { [ and { $page.options } { [ propertyIsGreaterThan 0 page.options.length ] } ] (
      ; to sel !document.createElement select
      ; set 'lane-input-type lane-data-filter-input' sel.className
      !sel.setAttribute aria-label 'Filter row link value'
      ; to blank-opt !document.createElement option
      ; assign $blank-opt { value '' } { textContent 'Select row…' }
      !sel.appendChild $blank-opt
      ; to seen ; object
      ; each $page.options (
       ; to { ro } $argv
       ; to v-str ; add '' $ro.valueText
       ; to opt !document.createElement option
       ; assign $opt { value $v-str } { textContent $ro.label }
       !sel.appendChild $opt
       ; to seen $v-str true
      )
      ; to is-init-empty [ propertyIs '' init-str ]
      [ match
       { [ propertyIs false is-init-empty ] (
        ; to has-seen [ get seen $init-str ]
        ; to seen-flag [ propertyIs true has-seen ]
        ; condition { propertyIs false seen-flag } (
         ; to extra !document.createElement option
         ; assign $extra { value $init-str } { textContent $init-str }
         !sel.appendChild $extra
        )
        ; set $init-str sel.value
       ) }
      ]
      $sel
     ) }
     { true (
      ; to inp !document.createElement input
      ; assign $inp { type text } { className 'lane-data-cell-input lane-data-filter-input' } { placeholder [ match { $placeholder-override : $placeholder-override } { true : 'Row value…' } ] } { spellcheck false } { autocomplete off }
      ; set $init-str inp.value
      $inp
     ) }
    ]
   ) }
   { [ propertyIs lane kind ] (
    ; to lane-ids {}
    ; to seen-ids ; object
    [ match
     { [ !window.Array.isArray $lane-control.lanes ] (
      ; each $lane-control.lanes (
       ; to { ol } $argv
       [ match
        { $ol.id (
         ; to id-str ; add '' $ol.id
         ; to already [ get seen-ids $id-str ]
         ; to already-flag [ propertyIs true already ]
         ; condition { propertyIs false already-flag } (
          ; to seen-ids $id-str true
          !lane-ids.push $id-str
         )
        ) }
       ]
      )
     ) }
    ]
    [ match
     { [ and { $lane-control.catalog } { $window.Object.keys } ] (
      ; to cat-keys !window.Object.keys $lane-control.catalog
      ; each $cat-keys (
       ; to { cid } $argv
       ; to cid-str ; add '' $cid
       ; to already [ get seen-ids $cid-str ]
       ; to already-flag [ propertyIs true already ]
       ; condition { propertyIs false already-flag } (
        ; to seen-ids $cid-str true
        !lane-ids.push $cid-str
       )
      )
     ) }
    ]
    [ match
     { [ propertyIsGreaterThan 0 lane-ids.length ] (
      ; to sel !document.createElement select
      ; set 'lane-input-type lane-data-filter-input' sel.className
      !sel.setAttribute aria-label 'Filter lane value'
      ; to blank-opt !document.createElement option
      ; assign $blank-opt { value '' } { textContent 'Select lane…' }
      !sel.appendChild $blank-opt
      ; each $lane-ids (
       ; to { lid } $argv
       ; to linfo !view.lookup-lane-info $lid
       ; to opt !document.createElement option
       ; assign $opt { value $lid } { textContent $linfo.label }
       !sel.appendChild $opt
      )
      ; to is-init-empty [ propertyIs '' init-str ]
      [ match
       { [ propertyIs false is-init-empty ] (
        ; to has-seen [ get seen-ids $init-str ]
        ; to seen-flag [ propertyIs true has-seen ]
        ; condition { propertyIs false seen-flag } (
         ; to extra !document.createElement option
         ; assign $extra { value $init-str } { textContent $init-str }
         !sel.appendChild $extra
        )
        ; set $init-str sel.value
       ) }
      ]
      $sel
     ) }
     { true (
      ; to inp !document.createElement input
      ; assign $inp { type text } { className 'lane-data-cell-input lane-data-filter-input' } { placeholder [ match { $placeholder-override : $placeholder-override } { true : 'lane-id' } ] } { spellcheck false } { autocomplete off }
      ; set $init-str inp.value
      $inp
     ) }
    ]
   ) }
   { [ propertyIs date kind ] (
    ; to inp !document.createElement input
    ; assign $inp { type date } { className 'lane-data-cell-input lane-data-filter-input' } { placeholder [ match { $placeholder-override : $placeholder-override } { true : YYYY-MM-DD } ] } { spellcheck false } { autocomplete off }
    ; set $init-str inp.value
    $inp
   ) }
   { [ propertyIs datetime kind ] (
    ; to clock-opts !view.get-clock-display-opts
    ; to dt-ph [ match
     { $placeholder-override : $placeholder-override }
     { $formatDatetimePlaceholder : !formatDatetimePlaceholder $clock-opts }
     { true : 'YYYY-MM-DD HH:mm' }
    ]
    ; to inp !document.createElement input
    ; assign $inp { type text } { className 'lane-data-cell-input lane-data-filter-input' } { placeholder $dt-ph } { spellcheck false } { autocomplete off }
    ; set $init-str inp.value
    $inp
   ) }
   { [ propertyIs true is-num-kind ] (
    ; to num-ph [ match
     { $placeholder-override : $placeholder-override }
     { [ propertyIs in_last_days op-desc.op ] : days }
     { [ propertyIs in_next_days op-desc.op ] : days }
     { true : '0' }
    ]
    ; to num-mode [ ternary [ propertyIs integer kind ] numeric decimal ]
    ; to inp !document.createElement input
    ; assign $inp { type text } { className 'lane-data-cell-input lane-data-filter-input' } { placeholder $num-ph } { spellcheck false } { autocomplete off }
    !inp.setAttribute inputmode $num-mode
    !inp.setAttribute data-num-type $kind
    ; set $init-str inp.value
    ; to validate-filter-num (
     ; to raw-val $inp.value
     [ match
      { [ propertyIs '' raw-val ] (
       ; set 'lane-data-cell-input lane-data-filter-input' inp.className
       ; set '' inp.title
       !inp.setAttribute aria-invalid 'false'
      ) }
      { true (
       ; to fmt-res [ match
        { $parseNumericCellInput : !parseNumericCellInput $raw-val $kind [ !normalizeFixedDecimals $col.decimals ] }
        { true : ; object { ok true } { value null } { error '' } }
       ]
       ; to flt-res [ match
        { [ and { propertyIs true fmt-res.ok } { $parseTableFilterInput } ] : !parseTableFilterInput $col $op-desc.op $raw-val $raw-val [ object { tables $view.tables } ] }
        { true : $fmt-res }
       ]
       [ match
        { [ propertyIs false flt-res.ok ] (
         ; set 'lane-data-cell-input lane-data-filter-input lane-data-cell-input--invalid' inp.className
         ; set [ match { $flt-res.error : $flt-res.error } { true : 'Invalid number' } ] inp.title
         !inp.setAttribute aria-invalid 'true'
        ) }
        { true (
         ; set 'lane-data-cell-input lane-data-filter-input' inp.className
         ; set '' inp.title
         !inp.setAttribute aria-invalid 'false'
        ) }
       ]
      ) }
     ]
    )
    !validate-filter-num
    !inp.addEventListener input $validate-filter-num
    $inp
   ) }
   { [ propertyIs list kind ] (
    ; to inp !document.createElement input
    ; assign $inp { type text } { className 'lane-data-cell-input lane-data-filter-input' } { placeholder [ match { $placeholder-override : $placeholder-override } { true : 'value1, value2, …' } ] } { spellcheck false } { autocomplete off }
    ; set $init-str inp.value
    $inp
   ) }
   { true (
    ; to txt-ph [ match
     { $placeholder-override : $placeholder-override }
     { [ propertyIs matches_regex op-desc.op ] : '/pattern/i' }
     { [ propertyIs has_key op-desc.op ] : key }
     { true : 'Filter value…' }
    ]
    ; to inp !document.createElement input
    ; assign $inp { type text } { className 'lane-data-cell-input lane-data-filter-input' } { placeholder $txt-ph } { spellcheck false } { autocomplete off }
    ; set $init-str inp.value
    $inp
   ) }
  ]
  [ match
   { $ctrl (
    !ctrl.addEventListener keydown (
     ; to { ev } $argv
     [ match
      { [ propertyIs Enter ev.key ] (
       [ match { $ev.preventDefault : !ev.preventDefault } ]
       !view.apply-filter-editor
      ) }
      { [ propertyIs Escape ev.key ] (
       [ match { $ev.stopPropagation : !ev.stopPropagation } ]
       !view.close-filter-menu
      ) }
     ]
    )
    !view.filter-input-els.push $ctrl
   ) }
  ]
  $ctrl
 )

 ; to view.render-filter-value-inputs (
  -- Rebuilds operand value input controls inside the filter popover for the selected operator
  ; to { tbl col op-value init-val init-val-to } $argv
  ; while { propertyIsGreaterThan 0 view.filter-input-els.length } (
   ; to old-in !view.filter-input-els.pop
   [ match { $old-in.remove : !old-in.remove } ]
  )
  !clear-children $filter-value-fields
  ; set null view.filter-val-el
  ; set null view.filter-val-to-el
  ; set '' filter-error-el.textContent
  ; set true filter-error-el.hidden

  ; to ops [ match
   { $getFilterOperatorsForColumn : !getFilterOperatorsForColumn $col $view.tables }
   { true : {} }
  ]
  ; to desc-box ; object { desc null }
  ; each $ops (
   ; to { item } $argv
   ; condition { propertyIs $op-value item.op } : ; set $item desc-box.desc
  )
  ; to op-desc $desc-box.desc
  [ match
   { [ propertyIs null op-desc ] : ; set true filter-value-wrap.hidden }
   { [ propertyIs 0 op-desc.arity ] (
    ; set true filter-value-wrap.hidden
    ; set none view.filter-editor.input-kind
   ) }
   { [ propertyIs 2 op-desc.arity ] (
    ; set false filter-value-wrap.hidden
    ; set $op-desc.inputKind view.filter-editor.input-kind
    ; to c1 !view.build-single-filter-control $tbl $col $op-desc $init-val null
    ; to sep !document.createElement span
    ; assign $sep { className lane-data-filter-range-sep } { textContent and }
    ; to c2 !view.build-single-filter-control $tbl $col $op-desc $init-val-to null
    ; set $c1 view.filter-val-el
    ; set $c2 view.filter-val-to-el
    !filter-value-fields.appendChild $c1
    !filter-value-fields.appendChild $sep
    !filter-value-fields.appendChild $c2
   ) }
   { true (
    ; set false filter-value-wrap.hidden
    ; set $op-desc.inputKind view.filter-editor.input-kind
    ; to c1 !view.build-single-filter-control $tbl $col $op-desc $init-val null
    ; set $c1 view.filter-val-el
    !filter-value-fields.appendChild $c1
   ) }
  ]
 )

 ; to view.open-filter-menu (
  -- Opens the column filter popover in add or edit mode anchored to the '+' or bubble element
  ; to { tbl col existing-flt anchor-el } $argv
  !view.close-table-menu
  !view.close-view-menu
  ; to is-edit [ match { $existing-flt : true } { true : false } ]
  ; set true view.filter-editor.open
  ; set [ ternary $is-edit edit add ] view.filter-editor.mode
  ; set $tbl.id view.filter-editor.table-id
  ; set $col.id view.filter-editor.column-id
  ; set [ match { $existing-flt.id : $existing-flt.id } { true : '' } ] view.filter-editor.filter-id
  ; set $anchor-el view.filter-editor.anchor-el

  ; to col-label !view.display-col-name $col
  ; set $col-label filter-menu-col-name.textContent
  ; set [ !formatColumnType $col undefined undefined $view.tables ] filter-menu-col-type.textContent

  ; while { propertyIsGreaterThan 0 view.filter-op-els.length } (
   ; to old-op !view.filter-op-els.pop
   [ match { $old-op.remove : !old-op.remove } ]
  )
  !clear-children $filter-op-select
  ; to ops [ match
   { $getFilterOperatorsForColumn : !getFilterOperatorsForColumn $col $view.tables }
   { true : {} }
  ]
  ; to op-box ; object { first '' } { matched '' }
  ; each $ops (
   ; to { item idx } $argv
   ; condition { propertyIs 0 idx } : ; set $item.op op-box.first
   ; condition { and { $existing-flt } { [ propertyIs $existing-flt.operator item.op ] } } : ; set $item.op op-box.matched
   ; to opt !document.createElement option
   ; assign $opt { value $item.op } { textContent $item.label }
   !filter-op-select.appendChild $opt
   !view.filter-op-els.push $opt
  )
  ; to is-matched-empty [ propertyIs '' op-box.matched ]
  ; to selected-op [ ternary $is-matched-empty $op-box.first $op-box.matched ]
  ; set $selected-op filter-op-select.value

  ; to clock-opts !view.get-clock-display-opts
  ; to formatted [ match
   { [ and { $existing-flt } { $formatTableFilterInputValues } ] : !formatTableFilterInputValues $existing-flt $col [ object { tables $view.tables } { displayOpts $clock-opts } ] }
   { true : ; object { value '' } { valueTo '' } }
  ]
  !view.render-filter-value-inputs $tbl $col $selected-op $formatted.value $formatted.valueTo

  ; set [ ternary $is-edit 'Update filter' 'Add filter' ] filter-apply-btn.textContent
  ; set [ ternary $is-edit false true ] filter-delete-btn.hidden
  ; set false filter-menu.hidden
  [ match
   { [ and { $anchor-el } { $anchor-el.getBoundingClientRect } { $rows-section.getBoundingClientRect } ] (
    ; to a-rect !anchor-el.getBoundingClientRect
    ; to r-rect !rows-section.getBoundingClientRect
    ; to raw-left ; subtract $a-rect.left $r-rect.left
    ; to clamp-l [ ternary [ propertyIsLessThan 0 raw-left ] 0 $raw-left ]
    ; to max-l ; subtract $r-rect.width 260
    ; to final-l [ match
     { [ and { [ propertyIsGreaterThan 0 max-l ] } { [ propertyIsLessThan $clamp-l max-l ] } ] : $max-l }
     { true : $clamp-l }
    ]
    ; to raw-top ; subtract $a-rect.bottom $r-rect.top
    ; to final-t ; add $raw-top 4
    ; to l-css ; add $final-l px
    ; to t-css ; add $final-t px
    ; assign $filter-menu.style { left $l-css } { top $t-css }
   ) }
  ]
  [ match
   { [ and { $view.filter-val-el } { $view.filter-val-el.focus } ] : !view.filter-val-el.focus }
   { $filter-op-select.focus : !filter-op-select.focus }
  ]
 )

 ; to view.apply-filter-editor (
  -- Validates the filter popover inputs and adds or updates the filter on workingFilters
  ; to tbl !view.get-active-table
  ; to col-box ; object { col null }
  [ match
   { $tbl (
    ; each $tbl.columns (
     ; to { candidate } $argv
     ; condition { propertyIs $view.filter-editor.column-id candidate.id } : ; set $candidate col-box.col
    )
   ) }
  ]
  ; to col $col-box.col
  [ match
   { [ and { $tbl } { $col } { $parseTableFilterInput } ] (
    ; to op $filter-op-select.value
    ; to raw1 [ match { $view.filter-val-el : $view.filter-val-el.value } { true : undefined } ]
    ; to raw2 [ match { $view.filter-val-to-el : $view.filter-val-to-el.value } { true : undefined } ]
    ; to clock-opts !view.get-clock-display-opts
    ; to parsed !parseTableFilterInput $col $op $raw1 $raw2 [ object { tables $view.tables } { displayOpts $clock-opts } ]
    [ match
     { [ propertyIs false parsed.ok ] (
      ; set [ match { $parsed.error : $parsed.error } { true : 'Invalid filter value' } ] filter-error-el.textContent
      ; set false filter-error-el.hidden
      false
     ) }
     { true (
      ; to is-edit [ propertyIs edit view.filter-editor.mode ]
      ; to flt-id [ match
       { [ and { $is-edit } { $view.filter-editor.filter-id } ] : $view.filter-editor.filter-id }
       { true : !view.next-id flt }
      ]
      ; to next-flt [ object
       { id $flt-id }
       { columnId $col.id }
       { operator $parsed.operator }
      ]
      [ match
       { [ propertyIs true parsed.hasValue ] (
        ; to stored-val [ match
         { [ !window.Array.isArray $parsed.value ] : !clone-plain-data $parsed.value {} }
         { true : $parsed.value }
        ]
        ; set $stored-val next-flt.value
        ; to no-v2 [ propertyIs undefined parsed.valueTo ]
        ; condition { propertyIs false no-v2 } : ; set $parsed.valueTo next-flt.valueTo
       ) }
      ]
      ; to st !view.ensure-table-views-state $tbl
      [ match
       { $is-edit (
        ; to replaced ; object { hit false }
        ; to next-list {}
        ; each $st.workingFilters (
         ; to { existing } $argv
         [ match
          { [ propertyIs $flt-id existing.id ] (
           !next-list.push $next-flt
           ; set true replaced.hit
          ) }
          { true : !next-list.push $existing }
         ]
        )
        ; condition { propertyIs false replaced.hit } : !next-list.push $next-flt
        ; set $next-list st.workingFilters
       ) }
       { true : !st.workingFilters.push $next-flt }
      ]
      !view.clear-pinned-rows $tbl.id
      !view.close-filter-menu
      !view.sync-view-ui
      !view.render-grid
      true
     ) }
    ]
   ) }
   { true : false }
  ]
 )

 ; to view.delete-filter-by-id (
  -- Removes a filter bubble by ID from workingFilters, marks the view dirty, and re-renders rows
  ; to { tbl filter-id } $argv
  ; to eff-tbl [ match { $tbl : $tbl } { true : !view.get-active-table } ]
  [ match
   { [ and { $eff-tbl } { $filter-id } ] (
    ; to st !view.ensure-table-views-state $eff-tbl
    ; to next-list {}
    ; each $st.workingFilters (
     ; to { flt } $argv
     ; to same-id [ propertyIs $filter-id flt.id ]
     ; condition { propertyIs false same-id } : !next-list.push $flt
    )
    ; set $next-list st.workingFilters
    !view.clear-pinned-rows $eff-tbl.id
    ; condition { and { [ propertyIs true view.filter-editor.open ] } { [ propertyIs $filter-id view.filter-editor.filter-id ] } } : !view.close-filter-menu
    !view.sync-view-ui
    !view.render-grid
   ) }
  ]
 )

 ; to view.delete-editing-filter (
  -- Deletes the currently open filter from the filter editor popover
  ; to tbl !view.get-active-table
  ; to fid $view.filter-editor.filter-id
  !view.delete-filter-by-id $tbl $fid
  !view.close-filter-menu
 )

 ; to view.next-id (
  -- Generates a unique ID with the given prefix without colliding with loaded IDs
  ; to { prefix } $argv
  [ match
   { $window.crypto.randomUUID (
    ; to uuid !window.crypto.randomUUID
    ; to generated ; add $prefix ; add '-' $uuid
    ; to view.used-ids $generated true
    $generated
   ) }
   { true (
    ; to candidate ''
    ; while { propertyIs '' candidate } (
     ; to seq ; add $view.id-seq 1
     ; set $seq view.id-seq
     ; to try-id ; add $prefix ; add '-' $seq
     ; to taken [ get view.used-ids $try-id ]
     [ match
      { $taken : null }
      { true (
       ; to view.used-ids $try-id true
       ; set $try-id candidate
      ) }
     ]
    )
    $candidate
   ) }
  ]
 )

 ; to collect-ids (
  -- Extracts string IDs from an array of table or row records
  ; to { list } $argv
  ; to ids {}
  ; each $list (
   ; to { item } $argv
   !ids.push $item.id
  )
  $ids
 )

 ; to clone-plain-data (
  -- Deep-clones plain JSON-serializable table columns or row records so open owner and importer lanes stay isolated in memory
  ; to { raw fallback } $argv
  [ match
   { [ propertyIs undefined raw ] : $fallback }
   { [ propertyIs null raw ] : $fallback }
   { $window.JSON.stringify (
    ; to serialized null
    ; try (
     ; set [ !window.JSON.stringify $raw ] serialized
    ) : null
    [ match
     { [ propertyIs null serialized ] : $fallback }
     { [ propertyIs undefined serialized ] : $fallback }
     { $serialized.trim : !window.JSON.parse $serialized }
     { true : $fallback }
    ]
   ) }
   { true : $fallback }
  ]
 )

 ; to register-table-used-ids (
  -- Marks a table ID and its column and row IDs as used in this Data view
  ; to { tbl } $argv
  [ match
   { $tbl (
    [ match { $tbl.id : ; to view.used-ids $tbl.id true } ]
    [ match
     { [ !window.Array.isArray $tbl.columns ] (
      ; each $tbl.columns (
       ; to { col } $argv
       [ match { $col.id : ; to view.used-ids $col.id true } ]
      )
     ) }
    ]
    [ match
     { [ !window.Array.isArray $tbl.rows ] (
      ; each $tbl.rows (
       ; to { row } $argv
       [ match { $row.id : ; to view.used-ids $row.id true } ]
      )
     ) }
    ]
   ) }
  ]
 )

 ; to view.save (
  -- Persists all tables (schemas and rows) across split per-table and per-row KV keys
  !saveLaneTables $data $view.lane.data $view.lane.id $view.tables
 )

 ; to view.is-remote-table (
  -- Returns true if the given table is mounted remotely from another lane
  ; to { tbl } $argv
  [ match
   { [ propertyIs null tbl ] : false }
   { [ propertyIs undefined tbl ] : false }
   { $isRemoteTable : !isRemoteTable $tbl }
   { $tbl.remote (
    ; to rl [ match { $tbl.remote.laneId : ; add '' $tbl.remote.laneId } { true : '' } ]
    ; to rt [ match { $tbl.remote.tableId : ; add '' $tbl.remote.tableId } { true : '' } ]
    ; to rl-empty [ propertyIs '' rl ]
    ; to rt-empty [ propertyIs '' rt ]
    [ ternary [ and { [ propertyIs false rl-empty ] } { [ propertyIs false rt-empty ] } ] true false ]
   ) }
   { true : false }
  ]
 )

 ; to view.is-readonly-table (
  -- Returns true if the given table is a read-only remote table
  ; to { tbl } $argv
  [ match
   { [ propertyIs null tbl ] : false }
   { [ propertyIs undefined tbl ] : false }
   { $isReadOnlyRemoteTable : !isReadOnlyRemoteTable $tbl }
   { true (
    ; to is-rem !view.is-remote-table $tbl
    [ match
     { [ propertyIs false is-rem ] : false }
     { [ propertyIs 'read-write' tbl.remote.mode ] : false }
     { true : true }
    ]
   ) }
  ]
 )

 ; to view.remote-origin-info (
  -- Computes UI origin badge, jump label/path, and status metadata for a remote table (or null for local tables)
  ; to { tbl } $argv
  ; to is-rem !view.is-remote-table $tbl
  [ match
   { $is-rem (
    ; to owner-lane-id ; add '' $tbl.remote.laneId
    ; to owner-table-id ; add '' $tbl.remote.tableId
    ; to raw-owner-tname [ match
     { $tbl.remote.tableName : ; add '' $tbl.remote.tableName }
     { $tbl.name : ; add '' $tbl.name }
     { true : $owner-table-id }
    ]
    ; to owner-table-name !raw-owner-tname.trim
    ; to raw-mode [ match { $tbl.remote.mode : $tbl.remote.mode } { true : read-only } ]
    ; to norm-mode [ match
     { $normalizeTableImportMode : !normalizeTableImportMode $raw-mode }
     { true : [ ternary [ propertyIs 'read-write' raw-mode ] 'read-write' 'read-only' ] }
    ]
    ; to is-ro [ ternary [ propertyIs 'read-write' norm-mode ] false true ]
    ; to lane-info !view.lookup-lane-info $owner-lane-id
    ; to lane-label [ match
     { $lane-info.title : $lane-info.title }
     { true : $owner-lane-id }
    ]
    ; to path-label [ match
     { [ propertyIs '' owner-table-name ] : data }
     { true : ; add 'data/' $owner-table-name }
    ]
    ; to jump-text ; add '← From ' ; add $lane-label ; add ' · ' ; add $path-label ' ↗'
    ; to jump-title ; add 'Go to owner lane "' ; add $lane-label ; add '" (' ; add $path-label ')'
    ; to mode-badge-text [ ternary $is-ro 'REMOTE · READ-ONLY' 'REMOTE · READ-WRITE' ]
    ; to tab-badge-text [ ternary $is-ro '↗ RO' '↗ RW' ]
    ; to is-denied [ propertyIs true tbl.remote.accessDenied ]
    ; to is-missing [ propertyIs true tbl.remote.missing ]
    ; to status-text [ match
     { $is-denied : 'Owner lane package is locked' }
     { $is-missing : 'Owner table was deleted' }
     { true : '' }
    ]
    [ object
     { owner-lane-id $owner-lane-id }
     { owner-table-id $owner-table-id }
     { owner-table-name $owner-table-name }
     { mode $norm-mode }
     { is-readonly $is-ro }
     { lane-label $lane-label }
     { path-label $path-label }
     { jump-text $jump-text }
     { jump-title $jump-title }
     { mode-badge-text $mode-badge-text }
     { tab-badge-text $tab-badge-text }
     { status-text $status-text }
     { is-denied $is-denied }
     { is-missing $is-missing }
    ]
   ) }
   { true : null }
  ]
 )

 ; to view.sync-table-menu (
  -- Populates the "..." table actions dropdown menu items appropriate for local vs remote tables
  ; to { tbl } $argv
  !clear-children $table-menu
  !edit-table-btn.remove
  !jump-owner-btn.remove
  !edit-import-btn.remove
  !clear-rows-btn.remove
  !delete-table-btn.remove
  ; to is-rem !view.is-remote-table $tbl
  [ match
   { $is-rem (
    !table-menu.appendChild $jump-owner-btn
    [ match
     { $lane-control.pick-table-import : !table-menu.appendChild $edit-import-btn }
    ]
    ; to is-ro !view.is-readonly-table $tbl
    ; condition { propertyIs false is-ro } (
     !table-menu.appendChild $edit-table-btn
     !table-menu.appendChild $clear-rows-btn
    )
    ; assign $delete-table-btn { textContent 'Remove import' } { title 'Remove imported remote table from this lane' }
    !table-menu.appendChild $delete-table-btn
   ) }
   { true (
    !table-menu.appendChild $edit-table-btn
    !table-menu.appendChild $clear-rows-btn
    ; assign $delete-table-btn { textContent 'Delete table' } { title 'Delete this table' }
    !table-menu.appendChild $delete-table-btn
   ) }
  ]
 )

 ; to view.render-remote-bar (
  -- Renders or hides the remote origin bar and updates active-el read-only state for the selected table
  ; to tbl !view.get-active-table
  !view.sync-table-menu $tbl
  ; to info !view.remote-origin-info $tbl
  [ match
   { $info (
    ; to base-cls [ ternary $info.is-readonly lane-data-remote-bar 'lane-data-remote-bar lane-data-remote-bar--readwrite' ]
    ; to denied-cls [ ternary $info.is-denied [ add $base-cls ' lane-data-remote-bar--denied' ] $base-cls ]
    ; to full-cls [ ternary $info.is-missing [ add $denied-cls ' lane-data-remote-bar--missing' ] $denied-cls ]
    ; assign $remote-bar-el { className $full-cls } { hidden false }
    !remote-bar-el.setAttribute data-remote-lane $info.owner-lane-id
    !remote-bar-el.setAttribute data-remote-table $info.owner-table-id
    !remote-bar-el.setAttribute data-remote-mode $info.mode
    ; set $info.mode-badge-text remote-mode-badge.textContent
    ; assign $remote-jump-btn { textContent $info.jump-text } { title $info.jump-title }
    ; to no-status [ propertyIs '' info.status-text ]
    ; to has-status [ propertyIs false no-status ]
    ; assign $remote-status-el { textContent $info.status-text } { hidden [ ternary $has-status false true ] }
    ; set [ ternary $lane-control.pick-table-import false true ] remote-edit-btn.hidden
    ; set [ ternary $info.is-readonly 'lane-data-active lane-data-active--readonly' lane-data-active ] active-el.className
   ) }
   { true (
    ; assign $remote-bar-el { className lane-data-remote-bar } { hidden true }
    [ match
     { $remote-bar-el.removeAttribute (
      !remote-bar-el.removeAttribute data-remote-lane
      !remote-bar-el.removeAttribute data-remote-table
      !remote-bar-el.removeAttribute data-remote-mode
     ) }
    ]
    ; assign $remote-jump-btn { textContent '' } { title '' }
    ; assign $remote-status-el { textContent '' } { hidden true }
    ; set lane-data-active active-el.className
   ) }
  ]
 )

 ; to view.jump-to-owner-table (
  -- Navigates directly to the active remote table's original owner lane and data/<table> path
  ; to tbl !view.get-active-table
  ; to info !view.remote-origin-info $tbl
  [ match
   { $info (
    !view.close-table-menu
    [ match
     { $lane-control.navigate-to-lane-table : !lane-control.navigate-to-lane-table $info.owner-lane-id $info.owner-table-id $info.owner-table-name $view.lane.id }
     { $lane-control.open : !lane-control.open $info.owner-lane-id data $info.owner-table-name $view.lane.id }
    ]
   ) }
  ]
 )

 ; to view.propagate-table-mutation (
  -- Broadcasts table row or schema mutations between an owner lane and all open lanes mounting its tables remotely
  ; to { tbl action row } $argv
  [ match
   { [ and { $tbl } { $lane-control.notify-table-dependents } ] (
    ; to is-rem !view.is-remote-table $tbl
    ; to owner-id [ match { $is-rem : $tbl.remote.laneId } { true : $view.lane.id } ]
    ; to owner-tbl-id [ match { $is-rem : $tbl.remote.tableId } { true : $tbl.id } ]
    ; to owner-tables [ match
     { [ propertyIs $owner-id view.lane.id ] : $view.tables }
     { true : null }
    ]
    ; to row-id [ match { $row.id : $row.id } { true : '' } ]
    !lane-control.notify-table-dependents $owner-id $owner-tables $view.lane.id [ object { tableId $owner-tbl-id } { tableName $tbl.name } { action $action } { rowId $row-id } ]
   ) }
  ]
 )

 ; to view.notify-record-change (
  -- Notifies the owning notebook and dependent remote/owner lanes when a record in a table is added, updated, deleted, or cleared
  ; to { tbl row action } $argv
  [ match
   { [ and { $tbl } { $view.on-record-change } ] (
    !$view.on-record-change [ object
     { table $tbl }
     { tableId $tbl.id }
     { tableName $tbl.name }
     { row $row }
     { rowId [ match { $row.id : $row.id } { true : '' } ] }
     { action [ match { $action : $action } { true : 'update-row' } ] }
    ]
   ) }
  ]
  !view.propagate-table-mutation $tbl $action $row
 )

 ; to view.get-table-updates (
  -- Returns the list of deployment updates triggered by record changes in the specified table ID
  ; to { tbl-id } $argv
  [ match
   { $tbl-id (
    ; to list [ get view.table-updates $tbl-id ]
    [ match
     { [ !window.Array.isArray $list ] : $list }
     { true : {} }
    ]
   ) }
   { true : {} }
  ]
 )

 ; to view.render-updates (
  -- Renders the Updates section directly above the active table showing deployments triggered by record changes
  ; while { propertyIsGreaterThan 0 view.update-rows.length } (
   ; to old !view.update-rows.pop
   [ match
    { $old.el.remove : !old.el.remove }
   ]
  )
  ; while { propertyIsGreaterThan 0 updates-list.children.length } (
   ; to prev-len $updates-list.children.length
   ; to cidx ; subtract $prev-len 1
   ; to child [ get updates-list.children $cidx ]
   [ match
    { $child.remove : !child.remove }
   ]
   ; condition { propertyIs $prev-len updates-list.children.length } : !updates-list.children.pop
  )
  ; to tbl !view.get-active-table
  [ match
   { [ propertyIs null tbl ] (
    ; set true updates-section.hidden
    ; set '0' updates-count-badge.textContent
    ; set true updates-status-badge.hidden
   ) }
   { true (
    ; to list !view.get-table-updates $tbl.id
    ; to count $list.length
    ; set [ ; add '' $count ] updates-count-badge.textContent
    [ match
     { [ propertyIs 0 count ] (
      ; set true updates-section.hidden
      ; set true updates-status-badge.hidden
     ) }
     { true (
      ; set false updates-section.hidden
      ; to latest [ get list 0 ]
      ; to latest-status [ match { $latest.status : $latest.status } { true : deployed } ]
      ; to header-badge [ match
       { [ propertyIs deploying latest-status ] : [ object { text 'Deploying…' } { cls 'cc-badge cc-badge--warn lane-data-updates-status' } ] }
       { [ propertyIs error latest-status ] : [ object { text 'Deploy failed' } { cls 'cc-badge cc-badge--err lane-data-updates-status' } ] }
       { [ propertyIs false latest.ok ] : [ object { text 'Deploy failed' } { cls 'cc-badge cc-badge--err lane-data-updates-status' } ] }
       { true : [ object { text 'Live · Up to date' } { cls 'cc-badge cc-badge--ok lane-data-updates-status' } ] }
      ]
      ; assign $updates-status-badge { textContent $header-badge.text } { className $header-badge.cls } { hidden false }
      ; to shown !list.slice 0 5
      ; each $shown (
       ; to { upd idx } $argv
       ; to row-el !document.createElement div
       ; set lane-data-update-row row-el.className
       ; to st [ match { $upd.status : $upd.status } { true : deployed } ]
       ; to b-info [ match
        { [ propertyIs deploying st ] : [ object { text 'Deploying…' } { cls 'cc-badge cc-badge--warn lane-data-update-badge' } ] }
        { [ propertyIs error st ] : [ object { text 'Failed' } { cls 'cc-badge cc-badge--err lane-data-update-badge' } ] }
        { [ propertyIs false upd.ok ] : [ object { text 'Failed' } { cls 'cc-badge cc-badge--err lane-data-update-badge' } ] }
        { true : [ object { text 'Deployed ✓' } { cls 'cc-badge cc-badge--ok lane-data-update-badge' } ] }
       ]
       ; to badge-el !document.createElement span
       ; assign $badge-el { className $b-info.cls } { textContent $b-info.text }

       ; to target-id [ match { $upd.targetLaneId : $upd.targetLaneId } { true : '' } ]
       ; to target-title [ match
        { [ and { $target-id } { $lane-control.get-lane-title } ] : !lane-control.get-lane-title $target-id }
        { $upd.targetLaneTitle : $upd.targetLaneTitle }
        { true : $target-id }
       ]
       ; to lane-btn !document.createElement button
       ; assign $lane-btn { type button } { className lane-data-update-lane-btn } { textContent [ ; add $target-title ' ↗' ] } { title [ ; add 'Open ' $target-title ] }
       !lane-btn.addEventListener click (
        [ match
         { [ and { $target-id } { $lane-control.open-after } ] : !lane-control.open-after $target-id $view.lane.id }
         { [ and { $target-id } { $lane-control.open } ] : !lane-control.open $target-id }
        ]
       )

       ; to summary-el !document.createElement span
       ; assign $summary-el { className lane-data-update-summary } { textContent [ match { $upd.summary : $upd.summary } { true : '' } ] }

       ; to pub-url [ match { $upd.publicUrl : $upd.publicUrl } { true : '' } ]
       ; to url-el !document.createElement a
       ; assign $url-el { className lane-data-update-url } { href $pub-url } { target '_blank' } { rel 'noopener noreferrer' } { textContent $pub-url } { hidden [ ternary [ propertyIs '' pub-url ] true false ] }

       ; to raw-stamp [ match { $upd.deployedAt : $upd.deployedAt } { $upd.triggeredAt : $upd.triggeredAt } { true : '' } ]
       ; to clock-opts !view.get-clock-display-opts
       ; to ts-info [ match
        { [ and { $raw-stamp } { $formatLineTimestamp } ] : !formatLineTimestamp $raw-stamp $clock-opts }
        { true : ; object { display $raw-stamp } { iso $raw-stamp } }
       ]
       ; to ts-label [ match
        { $ts-info.display : $ts-info.display }
        { true : $raw-stamp }
       ]
       ; to meta-el !document.createElement span
       ; assign $meta-el { className lane-data-update-time } { textContent $ts-label } { title [ match { $ts-info.iso : $ts-info.iso } { true : $raw-stamp } ] }

       !row-el.appendChild $badge-el
       !row-el.appendChild $lane-btn
       !row-el.appendChild $summary-el
       !row-el.appendChild $url-el
       !row-el.appendChild $meta-el
       !updates-list.appendChild $row-el
       !view.update-rows.push [ object
        { update $upd }
        { el $row-el }
        { badge-el $badge-el }
        { lane-btn $lane-btn }
        { summary-el $summary-el }
        { url-el $url-el }
        { meta-el $meta-el }
        { index $idx }
       ]
      )
     ) }
    ]
   ) }
  ]
 )

 ; to view.upsert-table-update (
  -- Inserts or updates a deployment update entry for a table, optionally persisting to KV, and refreshes the Updates section
  ; to { tbl-id entry persist } $argv
  [ match
   { [ and { $tbl-id } { $entry } ] (
    ; to existing !view.get-table-updates $tbl-id
    ; to next-list { $entry }
    ; each $existing (
     ; to { item } $argv
     ; to is-same [ propertyIs $entry.id item.id ]
     ; condition { propertyIs false is-same } (
      ; condition { propertyIsLessThan 20 next-list.length } : !next-list.push $item
     )
    )
    ; to view.table-updates $tbl-id $next-list
    ; condition { propertyIs $tbl-id view.active-table-id } : !view.render-updates
    [ match
     { [ and { [ propertyIs true persist ] } { $saveTableUpdates } ] (
      !saveTableUpdates $data $view.lane.data $view.lane.id $tbl-id $next-list
     ) }
    ]
    $next-list
   ) }
   { true : {} }
  ]
 )

 ; to view.save-row (
  -- Persists a single table row to its own KV key (writing through to owner when remote read-write) and notifies listeners
  ; to { tbl row } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; condition { propertyIs false is-ro } (
   !saveTableRow $data $view.lane.data $view.lane.id $tbl $row
   !view.notify-record-change $tbl $row update-row
  )
 )

 ; to view.save-schema (
  -- Persists a single table schema (writing through to owner when remote read-write) and propagates to dependent lanes
  ; to { tbl } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; condition { propertyIs false is-ro } (
   !saveTableSchema $data $view.lane.data $view.lane.id $tbl
   !view.propagate-table-mutation $tbl update-schema null
  )
 )

 ; to view.save-schema-and-rows (
  -- Persists a single table schema and its rows after a structural column change and propagates to dependent lanes
  ; to { tbl } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; condition { propertyIs false is-ro } (
   !saveTableSchemaAndRows $data $view.lane.data $view.lane.id $tbl
   !view.propagate-table-mutation $tbl update-schema-and-rows null
  )
 )

 ; to view.sync-notebook-table-scope (
  -- Updates mounted notebook state table bindings after a remote table import, update, rename, or sync
  ; to { old-name } $argv
  [ match
   { [ and { $view.lane.notebook.state } { $buildTablesScope } ] (
    [ match
     { $old-name (
      ; to clean-old ; add '' $old-name
      ; to trimmed-old !clean-old.trim
      ; to old-empty [ propertyIs '' trimmed-old ]
      ; condition { propertyIs false old-empty } (
       ; to still-used ; object { hit false }
       ; each $view.tables (
        ; to { t } $argv
        ; to tname [ match { $t.name : !t.name.trim } { true : '' } ]
        ; condition { propertyIs $trimmed-old tname } : ; set true still-used.hit
       )
       ; condition { propertyIs false still-used.hit } (
        [ match
         { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $view.lane.notebook.state $trimmed-old }
        ]
       )
      )
     ) }
    ]
    ; to next-scoped !buildTablesScope $view.tables
    ; assign $view.lane.notebook.state $next-scoped
   ) }
  ]
 )

 ; to view.import-table (
  -- Mounts a remote table link into this lane's tables, persists only its schema link, selects it, and updates scope/URL
  ; to { spec } $argv
  [ match
   { [ and { $spec } { $spec.laneId } { $spec.tableId } ] (
    ; to raw-local [ match { $spec.localName : ; add '' $spec.localName } { $spec.tableName : ; add '' $spec.tableName } { true : imported_table } ]
    ; to clean-local !raw-local.trim
    ; to raw-owner-tname [ match { $spec.tableName : ; add '' $spec.tableName } { true : $clean-local } ]
    ; to raw-mode [ match { $spec.mode : $spec.mode } { true : read-only } ]
    ; to mode [ match { $normalizeTableImportMode : !normalizeTableImportMode $raw-mode } { true : [ ternary [ propertyIs 'read-write' raw-mode ] 'read-write' 'read-only' ] } ]
    ; to raw-remote [ object
     { laneId $spec.laneId }
     { tableId $spec.tableId }
     { tableName $raw-owner-tname }
     { mode $mode }
     { customName [ ternary $spec.customName true false ] }
    ]
    ; to remote-spec [ match
     { $normalizeTableRemoteSpec : !normalizeTableRemoteSpec $raw-remote }
     { true : $raw-remote }
    ]
    ; to cols !clone-plain-data [ match { [ !window.Array.isArray $spec.columns ] : $spec.columns } { true : {} } ] {}
    ; to rows !clone-plain-data [ match { [ !window.Array.isArray $spec.rows ] : $spec.rows } { true : {} } ] {}
    ; to tbl [ object
     { id !view.next-id tbl }
     { name [ match { [ propertyIs '' clean-local ] : $raw-owner-tname } { true : $clean-local } ] }
     { columns $cols }
     { rows $rows }
     { remote $remote-spec }
    ]
    !register-table-used-ids $tbl
    !view.tables.push $tbl
    ; set $tbl.id view.active-table-id
    ; set $tbl.name lane.subroute
    ; set [ !view.default-schema-open $tbl ] view.schema-open
    [ match
     { $lane-control.load-catalog : !lane-control.load-catalog }
    ]
    !view.render
    !view.sync-notebook-table-scope ''
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
     ; to table-ids !collect-ids $view.tables
     !addLaneTable $data $view.lane.data $view.lane.id $tbl $table-ids
     !view.sync-data-path
     [ match
      { $lane-control.update-url : !lane-control.update-url }
     ]
    ) : null
    [ match
     { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
    ]
    [ match
     { $view.lane.notebook.run-on-table-change : !view.lane.notebook.run-on-table-change [ object { tableId $tbl.id } { tableName $tbl.name } { action import-table } ] }
    ]
    $tbl
   ) }
   { true : null }
  ]
 )

 ; to view.open-import-modal (
  -- Opens the Import Table modal to pick an owner lane, source table, access mode, and local alias
  [ match
   { [ propertyIs true view.is-loading ] : null }
   { true (
    !view.close-table-menu
    [ match
     { $lane-control.pick-table-import (
      ; to opts [ object
       { lane $view.lane }
       { current-lane-id $view.lane.id }
       { existing-tables $view.tables }
       { on-confirm (
        ; to { spec } $argv
        !view.import-table $spec
       ) }
      ]
      !lane-control.pick-table-import $opts
     ) }
    ]
   ) }
  ]
 )

 ; to view.update-import-table (
  -- Updates an existing imported table's mode, local name, or source reference and persists its schema link
  ; to { tbl spec } $argv
  [ match
   { [ and { $tbl } { $spec } { $spec.laneId } { $spec.tableId } ] (
    ; to prev-name $tbl.name
    ; to raw-local [ match { $spec.localName : ; add '' $spec.localName } { $spec.tableName : ; add '' $spec.tableName } { true : $tbl.name } ]
    ; to clean-local !raw-local.trim
    ; to next-name [ match { [ propertyIs '' clean-local ] : $tbl.name } { true : $clean-local } ]
    ; to raw-owner-tname [ match { $spec.tableName : ; add '' $spec.tableName } { true : $next-name } ]
    ; to raw-mode [ match { $spec.mode : $spec.mode } { true : read-only } ]
    ; to mode [ match { $normalizeTableImportMode : !normalizeTableImportMode $raw-mode } { true : [ ternary [ propertyIs 'read-write' raw-mode ] 'read-write' 'read-only' ] } ]
    ; to raw-remote [ object
     { laneId $spec.laneId }
     { tableId $spec.tableId }
     { tableName $raw-owner-tname }
     { mode $mode }
     { customName [ ternary $spec.customName true false ] }
    ]
    ; to remote-spec [ match
     { $normalizeTableRemoteSpec : !normalizeTableRemoteSpec $raw-remote }
     { true : $raw-remote }
    ]
    ; to cols !clone-plain-data [ match { [ !window.Array.isArray $spec.columns ] : $spec.columns } { true : $tbl.columns } ] {}
    ; to rows !clone-plain-data [ match { [ !window.Array.isArray $spec.rows ] : $spec.rows } { true : $tbl.rows } ] {}
    ; set $next-name tbl.name
    ; set $remote-spec tbl.remote
    ; set $cols tbl.columns
    ; set $rows tbl.rows
    !register-table-used-ids $tbl
    ; condition { propertyIs $tbl.id view.active-table-id } (
     ; set $tbl.name lane.subroute
     ; set [ !view.default-schema-open $tbl ] view.schema-open
    )
    !view.render
    !view.sync-notebook-table-scope $prev-name
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
     [ match
      { $saveImportedTableLink : !saveImportedTableLink $data $view.lane.data $view.lane.id $tbl }
      { true : !saveTableSchema $data $view.lane.data $view.lane.id $tbl }
     ]
     !view.sync-data-path
     [ match
      { $lane-control.update-url : !lane-control.update-url }
     ]
    ) : null
    [ match
     { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
    ]
    [ match
     { $view.lane.notebook.run-on-table-change : !view.lane.notebook.run-on-table-change [ object { tableId $tbl.id } { tableName $tbl.name } { action update-import } ] }
    ]
    $tbl
   ) }
   { true : null }
  ]
 )

 ; to view.open-edit-import (
  -- Opens the Import Table modal in edit mode for a mounted remote table
  ; to { target-tbl } $argv
  ; to tbl [ match { $target-tbl : $target-tbl } { true : !view.get-active-table } ]
  ; to is-rem !view.is-remote-table $tbl
  [ match
   { [ and { $is-rem } { $lane-control.pick-table-import } ] (
    !view.close-table-menu
    ; to cur-mode [ match { $tbl.remote.mode : $tbl.remote.mode } { true : read-only } ]
    ; to opts [ object
     { lane $view.lane }
     { current-lane-id $view.lane.id }
     { existing-tables $view.tables }
     { editing-table-id $tbl.id }
     { lane-id $tbl.remote.laneId }
     { table-id $tbl.remote.tableId }
     { local-name $tbl.name }
     { custom-name [ propertyIs true tbl.remote.customName ] }
     { mode $cur-mode }
     { on-confirm (
      ; to { spec } $argv
      !view.update-import-table $tbl $spec
     ) }
    ]
    !lane-control.pick-table-import $opts
   ) }
  ]
 )

 ; to view.has-remote-from-lane (
  -- Returns true if this lane mounts at least one remote table owned by owner-lane-id
  ; to { owner-lane-id } $argv
  ; to clean-owner [ match { $owner-lane-id : ; add '' $owner-lane-id } { true : '' } ]
  ; to owner-empty [ propertyIs '' clean-owner ]
  ; to found ; object { hit false }
  [ match
   { [ propertyIs false owner-empty ] (
    ; each $view.tables (
     ; to { tbl } $argv
     ; to is-rem !view.is-remote-table $tbl
     ; condition { and { [ propertyIs true is-rem ] } { [ propertyIs $clean-owner tbl.remote.laneId ] } } : ; set true found.hit
    )
   ) }
  ]
  $found.hit
 )

 ; to view.sync-remote-tables-from-owner (
  -- Refreshes in-memory remote tables owned by owner-lane-id after the owner or another read-write importer writes changes
  ; to { owner-lane-id owner-tables change-info } $argv
  ; to clean-owner [ match { $owner-lane-id : ; add '' $owner-lane-id } { true : '' } ]
  ; to fresh-by-id ; object
  [ match
   { [ !window.Array.isArray $owner-tables ] (
    ; each $owner-tables (
     ; to { ot } $argv
     [ match { $ot.id : ; to fresh-by-id $ot.id $ot } ]
    )
   ) }
  ]
  ; to changed ; object { hit false }
  ; to active-renamed ; object { hit false }
  ; to prev-active-name ''
  ; each $view.tables (
   ; to { tbl } $argv
   ; to is-rem !view.is-remote-table $tbl
   ; condition { and { [ propertyIs true is-rem ] } { [ propertyIs $clean-owner tbl.remote.laneId ] } } (
    ; set true changed.hit
    ; to match-ot [ get fresh-by-id $tbl.remote.tableId ]
    [ match
     { $match-ot (
      ; to next-cols !clone-plain-data [ match { [ !window.Array.isArray $match-ot.columns ] : $match-ot.columns } { true : {} } ] {}
      ; to next-rows !clone-plain-data [ match { [ !window.Array.isArray $match-ot.rows ] : $match-ot.rows } { true : {} } ] {}
      ; set $next-cols tbl.columns
      ; set $next-rows tbl.rows
      ; to next-rname [ match { $match-ot.name : ; add '' $match-ot.name } { true : '' } ]
      ; set $next-rname tbl.remote.tableName
      [ match
       { $window.Reflect.deleteProperty (
        !window.Reflect.deleteProperty $tbl.remote missing
        !window.Reflect.deleteProperty $tbl.remote accessDenied
       ) }
       { true (
        ; set false tbl.remote.missing
        ; set false tbl.remote.accessDenied
       ) }
      ]
      !register-table-used-ids $tbl
      !view.sanitize-views-for-table $tbl false
      ; to has-custom [ propertyIs true tbl.remote.customName ]
      ; to same-rname [ propertyIs $next-rname tbl.name ]
      ; condition { and { [ propertyIs false has-custom ] } { [ propertyIs false same-rname ] } } (
       ; condition { propertyIs $tbl.id view.active-table-id } : ; set $tbl.name prev-active-name
       ; set $next-rname tbl.name
       ; condition { propertyIs $tbl.id view.active-table-id } (
        ; set true active-renamed.hit
        ; set $next-rname lane.subroute
       )
      )
     ) }
     { true (
      ; set true tbl.remote.missing
      ; set {} tbl.columns
      ; set {} tbl.rows
     ) }
    ]
   )
  )
  [ match
   { $changed.hit (
    !view.sync-notebook-table-scope $prev-active-name
    !view.render
    ; condition { propertyIs true active-renamed.hit } (
     !view.sync-data-path
     [ match
      { $lane-control.update-url : !lane-control.update-url }
     ]
    )
    true
   ) }
   { true : false }
  ]
 )

 ; to view.apply-external-owner-table-sync (
  -- Applies changes written to an owner table by an external read-write importer into this owner lane's open Data view
  ; to { fresh-owner-tables change-info } $argv
  ; to fresh-by-id ; object
  [ match
   { [ !window.Array.isArray $fresh-owner-tables ] (
    ; each $fresh-owner-tables (
     ; to { ft } $argv
     [ match { $ft.id : ; to fresh-by-id $ft.id $ft } ]
    )
   ) }
  ]
  ; to target-tid [ match { $change-info.tableId : ; add '' $change-info.tableId } { true : '' } ]
  ; to no-tid [ propertyIs '' target-tid ]
  ; to has-tid [ propertyIs false no-tid ]
  ; to changed ; object { hit false }
  ; to active-renamed ; object { hit false }
  ; to prev-active-name ''
  ; each $view.tables (
   ; to { tbl } $argv
   ; to is-rem !view.is-remote-table $tbl
   ; to should-check [ match
    { $is-rem : false }
    { $has-tid : [ propertyIs $target-tid tbl.id ] }
    { true : true }
   ]
   ; condition { propertyIs true should-check } (
    ; to ft [ get fresh-by-id $tbl.id ]
    [ match
     { $ft (
      ; to next-cols !clone-plain-data [ match { [ !window.Array.isArray $ft.columns ] : $ft.columns } { true : {} } ] {}
      ; to next-rows !clone-plain-data [ match { [ !window.Array.isArray $ft.rows ] : $ft.rows } { true : {} } ] {}
      ; to next-name [ match { $ft.name : ; add '' $ft.name } { true : '' } ]
      ; to same-name [ propertyIs $next-name tbl.name ]
      ; condition { propertyIs false same-name } (
       ; condition { propertyIs $tbl.id view.active-table-id } : ; set $tbl.name prev-active-name
       ; set $next-name tbl.name
       ; condition { propertyIs $tbl.id view.active-table-id } (
        ; set true active-renamed.hit
        ; set $next-name lane.subroute
       )
      )
      ; set $next-cols tbl.columns
      ; set $next-rows tbl.rows
      !register-table-used-ids $tbl
      !view.sanitize-views-for-table $tbl false
      ; set true changed.hit
     ) }
    ]
   )
  )
  [ match
   { $changed.hit (
    !view.sync-notebook-table-scope $prev-active-name
    !view.render
    ; condition { propertyIs true active-renamed.hit } (
     !view.sync-data-path
     [ match
      { $lane-control.update-url : !lane-control.update-url }
     ]
    )
    true
   ) }
   { true : false }
  ]
 )

 ; to view.seed-env (
  -- Seeds named tables as typed row-object arrays and a syncTable helper into the lane execution environment
  ; to { env } $argv
  ; to scoped !buildTablesScope $view.tables
  ; assign $env $scoped
  ; to env.syncTable (
   ; to { tbl-query records key-col } $argv
   ; to res [ match
    { $syncTableRowsInMemory : !syncTableRowsInMemory $view.tables $tbl-query $records $key-col }
    { true : ; object { ok false } { count 0 } { added 0 } { updated 0 } }
   ]
   [ match
    { $res.ok (
     ; to next-scoped !buildTablesScope $view.tables
     ; assign $env $next-scoped
     !view.render-grid
     !view.update-table-tabs-text
     !view.save-schema-and-rows $res.table
    ) }
   ]
   $res
  )
  $env
 )

 ; to view.default-schema-open (
  -- Collapses schema by default whenever a table has rows; keeps it open when no rows exist
  ; to { tbl } $argv
  [ match
   { $tbl : [ propertyIs 0 tbl.rows.length ] }
   { true : true }
  ]
 )

 ; to view.get-active-table (
  -- Returns the currently selected table object, or null if none
  ; to found ; object { table null }
  ; each $view.tables (
   ; to { tbl } $argv
   ; condition { propertyIs $view.active-table-id tbl.id } : ; set $tbl found.table
  )
  $found.table
 )

 ; to view.display-table-name (
  -- Returns a readable display label for a table
  ; to { tbl idx } $argv
  ; to trimmed !tbl.name.trim
  [ match
   { [ propertyIs '' trimmed ] (
    ; to num ; add $idx 1
    ; add 'Table ' $num
   ) }
   { true : $trimmed }
  ]
 )

 ; to view.display-col-name (
  -- Returns a readable display label for a column
  ; to { col } $argv
  ; to trimmed !col.name.trim
  [ match
   { [ propertyIs '' trimmed ] : '(unnamed)' }
   { true : $trimmed }
  ]
 )

 ; to view.display-template-token (
  -- Returns a $name token for simple column names, otherwise a $id token
  ; to { col } $argv
  ; to name !view.display-col-name $col
  ; to safe [ match
   { [ !name.includes ' ' ] : false }
   { [ !name.includes '.' ] : false }
   { [ !name.includes '\'' ] : false }
   { true : true }
  ]
  ; to token [ match { $safe : ; add '$' $name } { true : ; add '$' $col.id } ]
  $token
 )

 ; to view.preview-display-template (
  -- Previews a display template against the first linked row, reporting syntax errors and unknown columns
  ; to { tbl col text } $argv
  ; to box ; object { ok true } { text '' } { error '' } { unresolved null }
  ; to parsed !parseDisplayTemplate $text
  [ match
   { [ propertyIs false parsed.ok ] (
    ; set false box.ok
    ; set $parsed.error box.error
   ) }
   { [ propertyIs '' parsed.text ] : null }
   { true (
    ; to target !resolveRowTarget $view.tables $col $tbl
    [ match
     { [ propertyIs false target.valid ] (
      ; set false box.ok
      ; set 'Configure a valid link first' box.error
     ) }
     { true (
      ; to clock-opts !view.get-clock-display-opts
      ; to rows [ match { $target.table.rows : $target.table.rows } { true : null } ]
      ; match
       { $rows (
        ; each $rows (
         ; to { item } $argv
         [ match { [ propertyIs '' box.text ] (
          ; to rendered !formatRowDisplayTemplate $view.tables $target.table $item $parsed $clock-opts
          ; set $rendered.text box.text
          ; set $rendered.unresolved box.unresolved
         ) } { true : null } ]
        )
       ) }
       { true : null }
      ; match
       { $box.unresolved (
        ; match
         { propertyIsGreaterThan 0 box.unresolved.length (
          ; set [ ; add 'Unknown column: ' $box.unresolved.0 ] box.error
         ) }
         { true : null }
        ) }
       { true : null }
     ) }
    ]
   ) }
  ]
  $box
 )

 ; to view.row-placeholder-label (
  -- Returns "Select <column name>…" when the column has a name, or "Select row…" when unnamed
  ; to { col } $argv
  ; to trimmed !col.name.trim
  [ match
   { [ propertyIs '' trimmed ] : 'Select row…' }
   { true : ; add 'Select ' ; add $trimmed '…' }
  ]
 )

 ; to view.refresh-row-column-triggers (
  -- Re-renders row cell trigger labels for a column after its name changes in Schema
  ; to { col-idx } $argv
  ; each $view.grid-rows (
   ; to { grow } $argv
   ; to cell [ get grow.cells $col-idx ]
   [ match
    { $cell (
     ; condition { propertyIs row cell.col.type } (
      ; to val [ get grow.row.values $cell.col.id ]
      [ match
       { $cell.multi (
        ; to arr [ match
         { [ !window.Array.isArray $val ] : $val }
         { true : {} }
        ]
        ; each $cell.items (
         ; to { item idx } $argv
         [ match
          { $item.update-trigger : !item.update-trigger [ get arr $idx ] }
         ]
        )
        ; to active-tbl !view.get-active-table
        !view.apply-multi-filter $active-tbl $grow.row $cell.col $cell
       ) }
       { $cell.update-trigger : !cell.update-trigger $val }
      ]
     )
    ) }
   ]
  )
 )

 ; to view.confirm (
  -- Opens the confirmation modal for a destructive action scoped to this lane
  ; to { opts } $argv
  ; to full-opts ; object
  ; assign $full-opts [ object { lane $view.lane } { lane-id $view.lane.id } { host $view.container } ] $opts
  !view.confirm-modal.open $full-opts
 )

 ; to view.update-table-tabs-text (
  -- Updates pill labels, remote badges, and row count badges without full re-render
  ; each $view.tables (
   ; to { tbl idx } $argv
   ; to tab [ get view.table-tabs $idx ]
   [ match
    { $tab (
     ; to label !view.display-table-name $tbl $idx
     ; set $label tab.label-el.textContent
     ; set $tbl.rows.length tab.count-el.textContent
     ; to r-info !view.remote-origin-info $tbl
     [ match
      { [ and { $r-info } { $tab.remote-el } ] (
       ; set $r-info.tab-badge-text tab.remote-el.textContent
       ; set $r-info.jump-title tab.el.title
      ) }
     ]
    ) }
   ]
  )
 )

 ; to view.render-table-tabs (
  -- Renders the top table switcher pills
  ; while { propertyIsGreaterThan 0 view.table-tabs.length } (
   ; to old !view.table-tabs.pop
   !old.el.remove
  )
  ; each $view.tables (
   ; to { tbl idx } $argv
   ; to is-active [ propertyIs $view.active-table-id tbl.id ]
   ; to r-info !view.remote-origin-info $tbl
   ; to btn !document.createElement button
   ; to base-cls [ ternary $is-active 'lane-data-table-tab lane-data-table-tab--active' lane-data-table-tab ]
   ; to cls [ match
    { $r-info (
     ; to mode-cls [ ternary $r-info.is-readonly 'lane-data-table-tab--remote lane-data-table-tab--readonly' 'lane-data-table-tab--remote lane-data-table-tab--readwrite' ]
     ; add $base-cls ; add ' ' $mode-cls
    ) }
    { true : $base-cls }
   ]
   ; assign $btn { type button } { className $cls }
   !btn.setAttribute aria-selected [ ternary $is-active 'true' 'false' ]
   ; to label-el !document.createElement span
   ; assign $label-el { className lane-data-table-tab-label } { textContent !view.display-table-name $tbl $idx }
   !btn.appendChild $label-el
   ; to remote-el [ match
    { $r-info (
     !btn.setAttribute data-remote-lane $r-info.owner-lane-id
     !btn.setAttribute data-remote-table $r-info.owner-table-id
     !btn.setAttribute data-remote-mode $r-info.mode
     ; set $r-info.jump-title btn.title
     ; to r-badge !document.createElement span
     ; assign $r-badge { className lane-data-table-tab-remote } { textContent $r-info.tab-badge-text }
     !btn.appendChild $r-badge
     $r-badge
    ) }
    { true : null }
   ]
   ; to count-el !document.createElement span
   ; assign $count-el { className lane-data-table-tab-count } { textContent $tbl.rows.length }
   !btn.appendChild $count-el
   !btn.addEventListener click : !view.select-table $tbl.id
   !tabs-el.appendChild $btn
   ; to tab-rec ; object { id $tbl.id } { el $btn } { label-el $label-el } { remote-el $remote-el } { count-el $count-el }
   !view.table-tabs.push $tab-rec
  )
 )

 ; to view.get-clock-display-opts (
  -- Resolves active clock timezone and 12h/24h formatting options for Data table timestamps
  [ match
   { $lane-control.get-clock-display-options : !lane-control.get-clock-display-options }
   { $resolveClockDisplayOptions (
    ; to raw-tz [ match { $lane-control.clock-timezone : $lane-control.clock-timezone } { true : browser } ]
    ; to raw-hr [ match { $lane-control.clock-hour-format : $lane-control.clock-hour-format } { true : '12h' } ]
    !resolveClockDisplayOptions $raw-tz $lane-control.preferences-timezones $raw-hr $window.Intl
   ) }
   { true (
    ; to fb-tz [ match { $getBrowserTimeZone : !getBrowserTimeZone $window.Intl } { true : UTC } ]
    ; to fb-hr [ match { $lane-control.clock-hour-format : $lane-control.clock-hour-format } { true : '12h' } ]
    [ object { timeZone $fb-tz } { shortZone $fb-tz } { hourFormat $fb-hr } { showTimeZone true } { intl $window.Intl } ]
   ) }
  ]
 )

 ; to view.fetch-row-page (
  -- Loads a single paginated slice of linked row options asynchronously on edit
  ; to { col offset limit owner-row owner-table } $argv
  ; to clock-opts !view.get-clock-display-opts
  ; to page-opts [ object { offset $offset } { limit $limit } { row $owner-row } { ownerTable $owner-table } { displayOpts $clock-opts } ]
  !fetchRowOptionsPage $view.tables $col $page-opts
 )

 ; to view.set-col-constraints (
  -- Normalizes and assigns col.constraints + col.constraint (or removes both when empty)
  ; to { col next-list } $argv
  ; to norm [ match
   { $normalizeColumnConstraints : !normalizeColumnConstraints $next-list $col.type $col.decimals }
   { true : {} }
  ]
  [ match
   { [ propertyIsGreaterThan 0 norm.length ] (
    ; to first-c [ get norm 0 ]
    ; set $first-c col.constraint
    ; set $norm col.constraints
   ) }
   { true (
    [ match
     { $window.Reflect.deleteProperty (
      !window.Reflect.deleteProperty $col constraint
      !window.Reflect.deleteProperty $col constraints
     ) }
     { true (
      ; set undefined col.constraint
      ; set undefined col.constraints
     ) }
    ]
   ) }
  ]
  $norm
 )

 ; to view.validate-cell-value (
  -- Validates a single cell or array-item value against non-workflow column constraints
  ; to { col val owner-tbl owner-row item-idx } $argv
  ; to row-arr [ match
   { [ and { $col.multiple } { $owner-row.values } ] (
    ; to raw-list [ get owner-row.values $col.id ]
    [ match
     { [ !window.Array.isArray $raw-list ] : $raw-list }
     { true : null }
    ]
   ) }
   { true : null }
  ]
  ; to copts !view.get-clock-display-opts
  [ match
   { $validateColumnConstraints : !validateColumnConstraints $col $val [ object { tables $view.tables } { table $owner-tbl } { row $owner-row } { itemIndex $item-idx } { rowValuesArray $row-arr } { displayOpts $copts } ] }
   { true : ; object { ok true } { error null } { errors {} } }
  ]
 )

 ; to view.col-has-unique-constraint (
  -- Returns true if col defines a unique constraint
  ; to { col } $argv
  ; to clist [ match
   { $normalizeColumnConstraints : !normalizeColumnConstraints $col $col.type $col.decimals }
   { true : {} }
  ]
  ; to found ; object { hit false }
  ; each $clist (
   ; to { c } $argv
   ; condition { propertyIs unique c.type } : ; set true found.hit
  )
  $found.hit
 )

 ; to view.refresh-row-cells (
  -- Re-evaluates row-type cell triggers and cross-row unique constraints when a column value changes
  ; to { row } $argv
  [ match
   { $row (
    ; to refresh-cells-in-grow (
     ; to { target-tbl grow unique-col-ids } $argv
     ; to is-same-row [ propertyIs $row.id grow.row.id ]
     ; each $grow.cells (
      ; to { cell } $argv
      ; to is-row-cell [ and { $is-same-row } { [ propertyIs row cell.col.type ] } ]
      ; to is-uniq-cell [ match
       { [ get unique-col-ids $cell.col.id ] : true }
       { true : false }
      ]
      ; to should-refresh [ match
       { $is-row-cell : true }
       { $is-uniq-cell : true }
       { true : false }
      ]
      ; condition { propertyIs true should-refresh } (
       ; to val [ get grow.row.values $cell.col.id ]
       [ match
        { $cell.multi (
         ; to arr [ match
          { [ !window.Array.isArray $val ] : $val }
          { true : {} }
         ]
         ; each $cell.items (
          ; to { item idx } $argv
          [ match
           { $item.update-trigger : !item.update-trigger [ get arr $idx ] }
          ]
         )
         !view.apply-multi-filter $target-tbl $grow.row $cell.col $cell
        ) }
        { $cell.update-trigger : !cell.update-trigger $val }
       ]
      )
     )
    )
    ; to build-uniq-map (
     ; to { tbl } $argv
     ; to umap ; object
     [ match
      { $tbl.columns (
       ; each $tbl.columns (
        ; to { ucol } $argv
        ; to is-uniq !view.col-has-unique-constraint $ucol
        ; condition { propertyIs true is-uniq } : ; set true umap $ucol.id
       )
      ) }
     ]
     $umap
    )
    ; to active-tbl !view.get-active-table
    ; to active-uniq !build-uniq-map $active-tbl
    ; each $view.grid-rows (
     ; to { grow } $argv
     !refresh-cells-in-grow $active-tbl $grow $active-uniq
     [ match
      { $grow.subtable-groups (
       ; each $grow.subtable-groups (
        ; to { sgrp } $argv
        ; to s-uniq !build-uniq-map $sgrp.table
        ; each $sgrp.rows (
         ; to { sgrow } $argv
         !refresh-cells-in-grow $sgrp.table $sgrow $s-uniq
        )
       )
      ) }
     ]
    )
   ) }
  ]
 )

 ; to view.lookup-lane-info (
  -- Resolves display metadata for a stored lane ID from open lanes or persistent catalog
  ; to { raw-id } $argv
  ; to str [ match
   { [ propertyIs undefined raw-id ] : '' }
   { [ propertyIs null raw-id ] : '' }
   { true : ; add '' $raw-id }
  ]
  ; to id !str.trim
  [ match
   { [ propertyIs '' id ] : ; object { is-empty true } { found false } { id '' } { title '' } { has-separate-title false } { label '' } }
   { true (
    ; to open-lane [ get lane-control.by-id $id ]
    ; to cat-entry [ get lane-control.catalog $id ]
    ; to found [ match
     { $open-lane : true }
     { $cat-entry : true }
     { true : false }
    ]
    ; to title [ match
     { $open-lane.title : $open-lane.title }
     { $cat-entry.title : $cat-entry.title }
     { $lane-control.get-lane-title : !lane-control.get-lane-title $id }
     { true : $id }
    ]
    ; to has-separate-title [ match
     { [ propertyIs '' title ] : false }
     { [ propertyIs $id title ] : false }
     { true : true }
    ]
    ; to label [ match
     { $has-separate-title : ; add $title ; add ' (' ; add $id ')' }
     { true : $id }
    ]
    ; object { is-empty false } { found $found } { id $id } { title $title } { has-separate-title $has-separate-title } { label $label }
   ) }
  ]
 )

 ; to view.refresh-lane-labels (
  -- Re-renders remote origin banner, tab tooltips, and lane cell trigger labels across the active table grid after a lane rename or reload
  !view.render-remote-bar
  !view.update-table-tabs-text
  !view.render-updates
  ; to refresh-lanes-in-grow (
   ; to { target-tbl grow } $argv
   ; each $grow.cells (
    ; to { cell } $argv
    ; condition { propertyIs lane cell.col.type } (
     ; to val [ get grow.row.values $cell.col.id ]
     [ match
      { $cell.multi (
       ; to arr [ match
        { [ !window.Array.isArray $val ] : $val }
        { true : {} }
       ]
       ; each $cell.items (
        ; to { item idx } $argv
        [ match
         { $item.update-trigger : !item.update-trigger [ get arr $idx ] }
        ]
       )
       !view.apply-multi-filter $target-tbl $grow.row $cell.col $cell
      ) }
      { $cell.update-trigger : !cell.update-trigger $val }
     ]
    )
   )
  )
  ; to active-tbl !view.get-active-table
  ; each $view.grid-rows (
   ; to { grow } $argv
   !refresh-lanes-in-grow $active-tbl $grow
   [ match
    { $grow.subtable-groups (
     ; each $grow.subtable-groups (
      ; to { sgrp } $argv
      ; each $sgrp.rows (
       ; to { sgrow } $argv
       !refresh-lanes-in-grow $sgrp.table $sgrow
      )
     )
    ) }
   ]
  )
  !view.refresh-filter-bubble-labels
 )

 ; to view.refresh-clock-displays (
  -- Re-renders datetime cells, linked row displays referencing datetime columns, and deployment update timestamps using active timezone and 12h/24h preferences
  !view.render-updates
  ; to refresh-clock-in-grow (
   ; to { target-tbl grow } $argv
   ; each $grow.cells (
    ; to { cell } $argv
    ; to is-tz-col [ match
     { [ propertyIs datetime cell.col.type ] : true }
     { [ propertyIs date cell.col.type ] : true }
     { [ propertyIs row cell.col.type ] : true }
     { true : false }
    ]
    ; condition { propertyIs true is-tz-col } (
     ; to val [ get grow.row.values $cell.col.id ]
     [ match
      { $cell.multi (
       ; to arr [ match
        { [ !window.Array.isArray $val ] : $val }
        { true : {} }
       ]
       ; each $cell.items (
        ; to { item idx } $argv
        [ match
         { $item.update-trigger : !item.update-trigger [ get arr $idx ] }
        ]
       )
       !view.apply-multi-filter $target-tbl $grow.row $cell.col $cell
      ) }
      { $cell.update-trigger : !cell.update-trigger $val }
     ]
    )
   )
  )
  ; to active-tbl !view.get-active-table
  ; each $view.grid-rows (
   ; to { grow } $argv
   !refresh-clock-in-grow $active-tbl $grow
   [ match
    { $grow.subtable-groups (
     ; each $grow.subtable-groups (
      ; to { sgrp } $argv
      ; each $sgrp.rows (
       ; to { sgrow } $argv
       !refresh-clock-in-grow $sgrp.table $sgrow
      )
     )
    ) }
   ]
  )
  !view.refresh-filter-bubble-labels
 )

 ; to create-picker-trigger (
  -- Creates the shared trigger button DOM skeleton (display span, ID badge span, caret) for row and lane cells
  ; to trigger-btn !document.createElement button
  ; assign $trigger-btn { type button } { className lane-data-row-trigger }
  ; to display-el !document.createElement span
  ; set lane-data-row-cell-display display-el.className
  ; to id-el !document.createElement span
  ; set lane-data-row-cell-id id-el.className
  ; to caret-el !document.createElement span
  ; assign $caret-el { className lane-data-row-cell-caret } { textContent '▾' }
  !trigger-btn.appendChild $display-el
  !trigger-btn.appendChild $id-el
  !trigger-btn.appendChild $caret-el
  { $trigger-btn $display-el $id-el }
 )

 ; to view.create-typed-control (
  -- Builds an editable typed input, checkbox, or async row/lane picker trigger for a single value of col.type
  ; to { col initial-val on-valid on-enter owner-tbl owner-row on-open-picker item-idx } $argv
  ; to is-ro !view.is-readonly-table $owner-tbl
  ; to wf-constraint [ match
   { $getColumnWorkflowConstraint : !getColumnWorkflowConstraint $col }
   { true : null }
  ]
  [ match
   { [ propertyIs row col.type ] (
    ; to { trigger-btn display-el id-el } !create-picker-trigger

    ; to ctrl-state ; object { value $initial-val }
    ; to update-trigger (
     ; to { next-val } $argv
     ; set $next-val ctrl-state.value
     ; to clock-opts !view.get-clock-display-opts
     ; to info !lookupRowDisplay $view.tables $col $next-val $owner-row $owner-tbl $clock-opts
     [ match
      { [ propertyIs false info.configured ] (
       ; set 'Configure link…' display-el.textContent
       ; set '' id-el.textContent
       ; set true id-el.hidden
       ; set 'lane-data-row-trigger lane-data-row-trigger--unconfigured' trigger-btn.className
       ; set true trigger-btn.disabled
       ; set 'Select linked table and column in Schema' trigger-btn.title
       !trigger-btn.setAttribute aria-invalid 'false'
      ) }
      { [ propertyIs false info.valid ] (
       [ match
        { $info.isEmpty (
         ; set 'Invalid link' display-el.textContent
         ; set '' id-el.textContent
         ; set true id-el.hidden
        ) }
        { true (
         ; set $info.valueText display-el.textContent
         ; set '(missing)' id-el.textContent
         ; set false id-el.hidden
        ) }
       ]
       ; set 'lane-data-row-trigger lane-data-row-trigger--invalid' trigger-btn.className
       ; set true trigger-btn.disabled
       ; set 'Linked table or column not found' trigger-btn.title
       !trigger-btn.setAttribute aria-invalid 'true'
      ) }
      { $info.isEmpty (
       ; to select-ph !view.row-placeholder-label $col
       ; set $select-ph display-el.textContent
       ; set '' id-el.textContent
       ; set true id-el.hidden
       ; to empty-cls [ ternary $col.required 'lane-data-row-trigger lane-data-row-trigger--empty lane-data-row-trigger--required-empty' 'lane-data-row-trigger lane-data-row-trigger--empty' ]
       ; set $empty-cls trigger-btn.className
       ; set false trigger-btn.disabled
       ; set [ ternary $col.required 'Required value' 'Pick a linked row' ] trigger-btn.title
       !trigger-btn.setAttribute aria-invalid [ ternary $col.required 'true' 'false' ]
      ) }
      { [ propertyIs false info.filterMatched ] (
       ; to err-disp [ match
        { $info.hasSeparateDisplay [ match
         { [ propertyIs '' info.displayText ] : $info.valueText }
         { true : $info.displayText }
        ] }
        { true : $info.valueText }
       ]
       ; set $err-disp display-el.textContent
       ; set '(invalid)' id-el.textContent
       ; set false id-el.hidden
       ; set 'lane-data-row-trigger lane-data-row-trigger--invalid' trigger-btn.className
       ; set false trigger-btn.disabled
       ; set $info.filterError trigger-btn.title
       !trigger-btn.setAttribute aria-invalid 'true'
      ) }
      { $info.hasSeparateDisplay [ match
       { $info.found [ match
        { [ propertyIs '' info.displayText ] (
         ; set $info.valueText display-el.textContent
         ; set '' id-el.textContent
         ; set true id-el.hidden
         ; set 'lane-data-row-trigger lane-data-row-trigger--filled' trigger-btn.className
         ; set false trigger-btn.disabled
         ; set $info.valueText trigger-btn.title
         !trigger-btn.setAttribute aria-invalid 'false'
        ) }
        { true (
         ; set $info.displayText display-el.textContent
         ; set $info.valueText id-el.textContent
         ; set false id-el.hidden
         ; set 'lane-data-row-trigger lane-data-row-trigger--filled' trigger-btn.className
         ; set false trigger-btn.disabled
         ; set $info.label trigger-btn.title
         !trigger-btn.setAttribute aria-invalid 'false'
        ) }
       ] }
       { true (
        ; set $info.valueText display-el.textContent
        ; set '(not found)' id-el.textContent
        ; set false id-el.hidden
        ; set 'lane-data-row-trigger lane-data-row-trigger--missing' trigger-btn.className
        ; set false trigger-btn.disabled
        ; set $info.valueText trigger-btn.title
        !trigger-btn.setAttribute aria-invalid 'false'
       ) }
      ] }
      { [ propertyIs false info.found ] (
       ; set $info.valueText display-el.textContent
       ; set '(not found)' id-el.textContent
       ; set false id-el.hidden
       ; set 'lane-data-row-trigger lane-data-row-trigger--missing' trigger-btn.className
       ; set false trigger-btn.disabled
       ; set $info.valueText trigger-btn.title
       !trigger-btn.setAttribute aria-invalid 'false'
      ) }
      { true (
       ; set $info.valueText display-el.textContent
       ; set '' id-el.textContent
       ; set true id-el.hidden
       ; set 'lane-data-row-trigger lane-data-row-trigger--filled' trigger-btn.className
       ; set false trigger-btn.disabled
       ; set $info.valueText trigger-btn.title
       !trigger-btn.setAttribute aria-invalid 'false'
      ) }
     ]
     ; condition { and { [ propertyIs false info.isEmpty ] } { $info.valid } { $info.filterMatched } } (
      ; to vres !view.validate-cell-value $col $next-val $owner-tbl $owner-row $item-idx
      ; condition { propertyIs false vres.ok } (
       ; set 'lane-data-row-trigger lane-data-row-trigger--invalid' trigger-btn.className
       ; set $vres.error trigger-btn.title
       !trigger-btn.setAttribute aria-invalid 'true'
      )
     )
     ; condition { propertyIs true is-ro } : ; set true trigger-btn.disabled
    )
    !update-trigger $initial-val

    !trigger-btn.addEventListener click (
     ; condition { propertyIs false is-ro } (
      [ match
       { $on-open-picker : !$on-open-picker }
      { true (
       ; to target !resolveRowTarget $view.tables $col $owner-tbl
       ; condition { propertyIs true target.valid } (
        ; to col-label !view.display-col-name $col
        ; to trimmed-tbl !target.table.name.trim
        ; to tbl-name [ match
         { [ propertyIs '' trimmed-tbl ] : $target.table.id }
         { true : $trimmed-tbl }
        ]
        ; to title ; add 'Select ' ; add $col-label ; add ' (' ; add $tbl-name ')'
        ; to ph ; add 'Search ' ; add $tbl-name ' rows...'
        ; to init-row-vals ; object
        ; each $target.table.columns (
         ; to { tcol } $argv
         ; to def-v [ match
          { $tcol.multiple : {} }
          { [ propertyIs boolean tcol.type ] : false }
          { [ propertyIs integer tcol.type ] : null }
          { [ propertyIs decimal tcol.type ] : null }
          { [ propertyIs fixed tcol.type ] : null }
          { true : !defaultDataValue $tcol }
         ]
         ; to init-row-vals $tcol.id $def-v
        )
        ; to can-prefill-filter [ match
         { [ and { $target.filterValid } { $target.refFilterCol } { $target.filterByCol } { $owner-row.values } ] : true }
         { true : false }
        ]
        [ match
         { $can-prefill-filter (
          ; to raw-fval [ get owner-row.values $target.filterByCol.id ]
          ; to filter-empty !isDataCellValueEmpty $raw-fval $target.filterByCol
          [ match
           { [ propertyIs false filter-empty ] (
            ; to prefilled [ match
             { $target.refFilterCol.multiple [ match
              { [ !window.Array.isArray $raw-fval ] : !coerceDataValue $raw-fval $target.refFilterCol true $target.filterByCol $view.tables }
              { true (
               ; to single-coerced !coerceDataValue $raw-fval $target.refFilterCol false $target.filterByCol $view.tables
               { $single-coerced }
              ) }
             ] }
             { [ !window.Array.isArray $raw-fval ] [ match
              { [ propertyIsGreaterThan 0 raw-fval.length ] : !coerceDataValue [ get raw-fval 0 ] $target.refFilterCol false $target.filterByCol $view.tables }
              { true : !defaultDataValue $target.refFilterCol }
             ] }
             { true : !coerceDataValue $raw-fval $target.refFilterCol false $target.filterByCol $view.tables }
            ]
            ; to init-row-vals $target.refFilterCol.id $prefilled
           ) }
          ]
         ) }
        ]
        ; to create-row-fn (
         ; to { row-values } $argv
         ; to values ; object
         ; each $target.table.columns (
          ; to { tcol } $argv
          ; to has-draft [ match
           { $row-values : [ !window.Object.hasOwn $row-values $tcol.id ] }
           { true : false }
          ]
          ; to col-val [ match
           { $has-draft : !coerceDataValue [ get row-values $tcol.id ] $tcol $tcol.multiple null $view.tables }
           { true : !defaultDataValue $tcol }
          ]
          ; to values $tcol.id $col-val
         )
         ; to new-row [ object
          { id !view.next-id row }
          { values $values }
         ]
         !target.table.rows.push $new-row
         !view.update-table-tabs-text
         ; to row-ids !collect-ids $target.table.rows
         !addTableRow $data $view.lane.data $view.lane.id $target.table $new-row $row-ids
         !view.notify-record-change $target.table $new-row add-row
         ; to chosen-val [ get values $target.linkCol.id ]
         ; to after-select (
          [ match
           { [ propertyIs $target.table.id view.active-table-id ] : !view.render-grid }
           { true (
            !view.render-grid
           ) }
          ]
         )
         ; object { ok true } { row $new-row } { value $chosen-val } { after-select $after-select }
        )
        ; to target-is-ro !view.is-readonly-table $target.table
        ; to pick-opts [ object
         { lane $view.lane }
         { lane-id $view.lane.id }
         { host $view.container }
         { title $title }
         { placeholder $ph }
         { current-value $ctrl-state.value }
         { page-size $view.row-page-size }
         { tables $view.tables }
         { target-table $target.table }
         { target-columns $target.table.columns }
         { link-col $target.linkCol }
         { display-col $target.displayCol }
         { initial-row-values $init-row-vals }
         { fetch-page (
          ; to { offset limit } $argv
          !view.fetch-row-page $col $offset $limit $owner-row $owner-tbl
         ) }
         { on-create-row [ ternary $target-is-ro null $create-row-fn ] }
         { on-select (
          ; to { chosen-val } $argv
          !update-trigger $chosen-val
          !$on-valid $chosen-val
         ) }
        ]
        !view.row-picker.open $pick-opts
       )
      ) }
     ]
     )
    )
    ; object { el $trigger-btn } { input-el $trigger-btn } { trigger-el $trigger-btn } { display-el $display-el } { id-el $id-el } { update-trigger $update-trigger }
   ) }
   { [ propertyIs lane col.type ] (
    ; to open-icon-svg '<svg class="lane-data-lane-open-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5L8.5 3.5M4.5 3.5H8.5V7.5"></path></svg>'
    ; to control-wrap !document.createElement div
    ; set 'lane-data-lane-control lane-data-lane-control--empty' control-wrap.className

    ; to trigger-btn !document.createElement button
    ; assign $trigger-btn { type button } { className 'lane-data-row-trigger lane-data-row-trigger--empty lane-data-lane-id-btn' }
    ; to placeholder-el !document.createElement span
    ; set 'lane-data-row-cell-display lane-data-lane-placeholder' placeholder-el.className
    ; to id-el !document.createElement span
    ; set 'lane-data-row-cell-id lane-data-lane-id' id-el.className
    ; to caret-el !document.createElement span
    ; assign $caret-el { className lane-data-row-cell-caret } { textContent '▾' }
    !trigger-btn.appendChild $placeholder-el
    !trigger-btn.appendChild $id-el
    !trigger-btn.appendChild $caret-el

    ; to open-btn !document.createElement button
    ; assign $open-btn { type button } { className lane-data-lane-open-btn } { hidden true }
    ; to display-el !document.createElement span
    ; set lane-data-lane-open-label display-el.className
    ; to open-icon-el !document.createElement span
    ; assign $open-icon-el { className lane-data-lane-open-icon-wrap } { innerHTML $open-icon-svg }
    !open-btn.appendChild $display-el
    !open-btn.appendChild $open-icon-el

    !control-wrap.appendChild $trigger-btn
    !control-wrap.appendChild $open-btn

    ; to ctrl-state ; object { value $initial-val }
    ; to set-trigger-view (
     ; to { wrap-cls trig-cls ph-txt hide-ph id-txt hide-id trig-ttl hide-open open-cls disp-txt open-ttl trig-disabled open-disabled } $argv
     ; set $wrap-cls control-wrap.className
     ; set $trig-cls trigger-btn.className
     ; set $ph-txt placeholder-el.textContent
     ; set $hide-ph placeholder-el.hidden
     ; set $id-txt id-el.textContent
     ; set $hide-id id-el.hidden
     ; set $trig-ttl trigger-btn.title
     ; set $trig-disabled trigger-btn.disabled
     ; set $hide-open open-btn.hidden
     ; set $open-cls open-btn.className
     ; set $disp-txt display-el.textContent
     ; set $open-ttl open-btn.title
     ; set $open-disabled open-btn.disabled
     !open-btn.setAttribute aria-label $open-ttl
    )
    ; to update-trigger (
     ; to { next-val } $argv
     ; set $next-val ctrl-state.value
     ; to info !view.lookup-lane-info $next-val
     ; to has-picker [ match
      { $lane-control.pick-lane : true }
      { true : false }
     ]
     ; to has-open [ match
      { $lane-control.open-after : true }
      { $lane-control.open : true }
      { true : false }
     ]
     ; to trig-disabled [ match
      { $is-ro : true }
      { $has-picker : false }
      { true : true }
     ]
     ; to open-disabled [ ternary $has-open false true ]
     [ match
      { $info.is-empty (
       ; to empty-lane-trig-cls [ ternary $col.required 'lane-data-row-trigger lane-data-row-trigger--empty lane-data-row-trigger--required-empty lane-data-lane-id-btn' 'lane-data-row-trigger lane-data-row-trigger--empty lane-data-lane-id-btn' ]
       ; to empty-lane-ttl [ ternary $col.required 'Required value' 'Select a lane' ]
       !set-trigger-view 'lane-data-lane-control lane-data-lane-control--empty' $empty-lane-trig-cls 'Select lane…' false '' true $empty-lane-ttl true lane-data-lane-open-btn '' '' $trig-disabled $open-disabled
       !trigger-btn.setAttribute aria-invalid [ ternary $col.required 'true' 'false' ]
      ) }
      { [ propertyIs false info.found ] (
       ; to chg-ttl ; add 'Change lane (' ; add $info.id ')'
       ; to op-ttl ; add 'Open ' ; add $info.id ' to the right'
       !set-trigger-view 'lane-data-lane-control lane-data-lane-control--missing' 'lane-data-row-trigger lane-data-row-trigger--missing lane-data-lane-id-btn' '' true $info.id false $chg-ttl false 'lane-data-lane-open-btn lane-data-lane-open-btn--missing' '(not found)' $op-ttl $trig-disabled $open-disabled
       !trigger-btn.setAttribute aria-invalid 'false'
      ) }
      { $info.has-separate-title (
       ; to chg-ttl ; add 'Change lane (' ; add $info.label ')'
       ; to op-ttl ; add 'Open ' ; add $info.title ' to the right'
       !set-trigger-view 'lane-data-lane-control lane-data-lane-control--filled' 'lane-data-row-trigger lane-data-row-trigger--filled lane-data-lane-id-btn' '' true $info.id false $chg-ttl false lane-data-lane-open-btn $info.title $op-ttl $trig-disabled $open-disabled
       !trigger-btn.setAttribute aria-invalid 'false'
      ) }
      { true (
       ; to chg-ttl ; add 'Change lane (' ; add $info.id ')'
       ; to op-ttl ; add 'Open ' ; add $info.id ' to the right'
       !set-trigger-view 'lane-data-lane-control lane-data-lane-control--filled' 'lane-data-row-trigger lane-data-row-trigger--filled lane-data-lane-id-btn' '' true $info.id false $chg-ttl false lane-data-lane-open-btn Open $op-ttl $trig-disabled $open-disabled
       !trigger-btn.setAttribute aria-invalid 'false'
      ) }
     ]
     ; condition { propertyIs false info.is-empty } (
      ; to vres !view.validate-cell-value $col $next-val $owner-tbl $owner-row $item-idx
      ; condition { propertyIs false vres.ok } (
       ; set 'lane-data-row-trigger lane-data-row-trigger--invalid lane-data-lane-id-btn' trigger-btn.className
       ; set $vres.error trigger-btn.title
       !trigger-btn.setAttribute aria-invalid 'true'
      )
     )
    )
    !update-trigger $initial-val

    !trigger-btn.addEventListener click (
     ; condition { propertyIs false is-ro } (
      [ match
       { $on-open-picker : !$on-open-picker }
       { $lane-control.pick-lane (
        ; to trimmed-name !col.name.trim
        ; to title [ match
         { [ propertyIs '' trimmed-name ] : 'Select Lane' }
         { true : ; add 'Select ' $trimmed-name }
        ]
        ; to pick-opts [ object
         { lane $view.lane }
         { lane-id $view.lane.id }
         { title $title }
         { current-value $ctrl-state.value }
         { on-select (
          ; to { chosen-id } $argv
          !update-trigger $chosen-id
          !$on-valid $chosen-id
         ) }
        ]
        !lane-control.pick-lane $pick-opts
       ) }
      ]
     )
    )
    !open-btn.addEventListener click (
     [ match
      { $ctrl-state.value (
       [ match
        { $lane-control.open-after : !lane-control.open-after $ctrl-state.value $view.lane.id }
        { $lane-control.open (
         [ match
          { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Loading…' }
         ]
         ; try (
          !lane-control.open $ctrl-state.value
          [ match
           { $lane-control.update-url : !lane-control.update-url }
          ]
         ) : null
         [ match
          { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
         ]
        ) }
       ]
      ) }
     ]
    )
    ; object { el $control-wrap } { input-el $trigger-btn } { trigger-el $trigger-btn } { open-el $open-btn } { placeholder-el $placeholder-el } { display-el $display-el } { id-el $id-el } { update-trigger $update-trigger }
   ) }
   { $wf-constraint (
    ; to select-el !document.createElement select
    ; to ctrl-state ; object { value $initial-val } { option-els {} }
    ; to render-options (
     ; to { cur-val } $argv
     ; set $cur-val ctrl-state.value
     ; while { propertyIsGreaterThan 0 ctrl-state.option-els.length } (
      ; to old-opt !ctrl-state.option-els.pop
      !old-opt.remove
     )
     ; to wf-state !getWorkflowCellState $view.tables $col $cur-val
     ; each $wf-state.options (
      ; to { opt-spec } $argv
      ; to opt !document.createElement option
      ; assign $opt { value $opt-spec.value } { textContent $opt-spec.label }
      ; condition { propertyIs true opt-spec.isCurrent } : ; set true opt.selected
      ; condition { propertyIs true opt-spec.isInvalid } : !opt.setAttribute data-invalid 'true'
      !select-el.appendChild $opt
      !ctrl-state.option-els.push $opt
     )
     ; set $wf-state.currentValue select-el.value
     ; to wf-single-spec [ object { type $col.type } { multiple false } ]
     ; to is-wf-req-empty [ match
      { $col.required : !isDataCellValueEmpty $cur-val $wf-single-spec }
      { true : false }
     ]
     ; to wf-vres !view.validate-cell-value $col $cur-val $owner-tbl $owner-row $item-idx
     [ match
      { [ propertyIs false wf-state.valid ] (
       ; set 'lane-data-cell-select lane-data-cell-select--unconfigured' select-el.className
       ; set true select-el.disabled
       !select-el.setAttribute aria-invalid 'false'
       ; set $wf-state.hint select-el.title
      ) }
      { [ propertyIs false wf-state.isValueValid ] (
       ; set 'lane-data-cell-select lane-data-cell-select--invalid' select-el.className
       ; set false select-el.disabled
       !select-el.setAttribute aria-invalid 'true'
       ; set $wf-state.error select-el.title
      ) }
      { [ propertyIs false wf-vres.ok ] (
       ; set 'lane-data-cell-select lane-data-cell-select--invalid' select-el.className
       ; set false select-el.disabled
       !select-el.setAttribute aria-invalid 'true'
       ; set $wf-vres.error select-el.title
      ) }
      { $is-wf-req-empty (
       ; set 'lane-data-cell-select lane-data-cell-select--invalid lane-data-cell-select--required-empty' select-el.className
       ; set false select-el.disabled
       !select-el.setAttribute aria-invalid 'true'
       ; set 'Required value' select-el.title
      ) }
      { true (
       ; set lane-data-cell-select select-el.className
       ; set false select-el.disabled
       !select-el.setAttribute aria-invalid 'false'
       ; set $wf-state.hint select-el.title
      ) }
     ]
     ; condition { propertyIs true is-ro } : ; set true select-el.disabled
    )
    !render-options $initial-val
    !select-el.addEventListener change (
     ; condition { propertyIs false is-ro } (
      ; to next-val !parseWorkflowOptionValue $select-el.value $col
      !render-options $next-val
      !$on-valid $next-val
     )
    )
    ; object { el $select-el } { input-el $select-el } { select-el $select-el } { option-els $ctrl-state.option-els } { render-options $render-options } { update-trigger $render-options }
   ) }
   { [ propertyIs boolean col.type ] (
    ; to wrap !document.createElement label
    ; set lane-data-bool-wrap wrap.className
    ; to cb !document.createElement input
    ; assign $cb { type checkbox } { className lane-data-bool-input } { disabled $is-ro }
    ; to bool-val !formatCellInputValue $initial-val boolean
    ; to txt !document.createElement span
    ; set lane-data-bool-label txt.className
    !wrap.appendChild $cb
    !wrap.appendChild $txt
    ; to apply-bool-state (
     ; to { next-b } $argv
     ; to clean-b !formatCellInputValue $next-b boolean
     ; set $clean-b cb.checked
     ; set [ ternary $clean-b 'true' 'false' ] txt.textContent
     ; to vres !view.validate-cell-value $col $clean-b $owner-tbl $owner-row $item-idx
     [ match
      { [ propertyIs false vres.ok ] (
       ; set 'lane-data-bool-wrap lane-data-bool-wrap--invalid' wrap.className
       ; set $vres.error wrap.title
       ; set $vres.error cb.title
       !cb.setAttribute aria-invalid 'true'
      ) }
      { true (
       ; set lane-data-bool-wrap wrap.className
       ; set '' wrap.title
       ; set '' cb.title
       !cb.setAttribute aria-invalid 'false'
      ) }
     ]
    )
    !apply-bool-state $bool-val
    !cb.addEventListener change (
     ; condition { propertyIs false is-ro } (
      ; to next-bool [ ternary $cb.checked true false ]
      !apply-bool-state $next-bool
      !$on-valid $next-bool
     )
    )
    ; object { el $wrap } { input-el $cb } { label-el $txt } { update-trigger $apply-bool-state }
   ) }
   { [ propertyIs datetime col.type ] (
    ; to cal-svg '<svg class="lane-data-datetime-picker-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="2.5" width="9" height="8" rx="1.2"></rect><path d="M1.5 5.2h9M4 1.5v2M8 1.5v2"></path></svg>'
    ; to wrap !document.createElement div
    ; set lane-data-datetime-wrap wrap.className
    ; to input-el !document.createElement input
    ; to picker-btn !document.createElement button
    ; assign $picker-btn { type button } { className lane-data-datetime-picker-btn } { innerHTML $cal-svg }
    !picker-btn.setAttribute tabindex '-1'
    !picker-btn.setAttribute aria-label 'Pick date and time'
    ; to native-picker !document.createElement input
    ; assign $native-picker { type datetime-local } { className lane-data-datetime-native-picker }
    !native-picker.setAttribute step '1'
    !native-picker.setAttribute tabindex '-1'
    !native-picker.setAttribute aria-hidden 'true'
    !wrap.appendChild $input-el
    !wrap.appendChild $picker-btn
    !wrap.appendChild $native-picker

    ; to ctrl-state ; object { value $initial-val } { valid true }
    ; to single-spec [ object { type datetime } { multiple false } ]
    ; to resolve-placeholder (
     ; to { copts } $argv
     [ match
      { $formatDatetimePlaceholder : !formatDatetimePlaceholder $copts }
      { true : 'YYYY-MM-DD HH:mm' }
     ]
    )
    ; to sync-picker-title (
     ; to { copts } $argv
     ; to tz-lbl [ match { $copts.shortZone : $copts.shortZone } { $copts.timeZone : $copts.timeZone } { true : '' } ]
     ; to btn-ttl [ match
      { $tz-lbl : ; add 'Pick date & time (' ; add $tz-lbl ')' }
      { true : 'Pick date & time' }
     ]
     ; set $btn-ttl picker-btn.title
    )
    ; to apply-input-state (
     ; to { ok val err-msg } $argv
     ; to cur-text $input-el.value
     ; to is-date-empty [ propertyIs '' cur-text ]
     ; to is-req-empty [ match
      { $col.required : !isDataCellValueEmpty $val $single-spec }
      { true : false }
     ]
     ; to cls 'lane-data-cell-input lane-data-cell-input--datetime'
     ; condition { propertyIs true is-date-empty } : ; set [ add $cls ' lane-data-cell-input--date-empty' ] cls
     ; to vres [ match
      { [ and { [ propertyIs true ok ] } { [ propertyIs false is-req-empty ] } ] : !view.validate-cell-value $col $val $owner-tbl $owner-row $item-idx }
      { true : ; object { ok true } { error null } }
     ]
     [ match
      { [ propertyIs false ok ] (
       ; set [ add $cls ' lane-data-cell-input--invalid' ] cls
       ; set $err-msg input-el.title
       !input-el.setAttribute aria-invalid 'true'
      ) }
      { $is-req-empty (
       ; set [ add $cls ' lane-data-cell-input--invalid lane-data-cell-input--required-empty' ] cls
       ; set 'Required value' input-el.title
       !input-el.setAttribute aria-invalid 'true'
      ) }
      { [ propertyIs false vres.ok ] (
       ; set [ add $cls ' lane-data-cell-input--invalid' ] cls
       ; set $vres.error input-el.title
       !input-el.setAttribute aria-invalid 'true'
      ) }
      { true (
       ; to ttl [ match
        { [ propertyIs '' cur-text ] : '' }
        { $val : ; add '' $val }
        { true : '' }
       ]
       ; set $ttl input-el.title
       !input-el.setAttribute aria-invalid 'false'
      ) }
     ]
     ; set $cls input-el.className
    )
    ; to init-opts !view.get-clock-display-opts
    ; to formatted !formatCellInputValue $initial-val $col undefined $view.tables $init-opts
    ; to ph !resolve-placeholder $init-opts
    ; assign $input-el { type text } { className 'lane-data-cell-input lane-data-cell-input--datetime' } { value $formatted } { placeholder $ph } { spellcheck false } { autocomplete off }
    !sync-picker-title $init-opts
    !apply-input-state true $initial-val ''
    ; condition { propertyIs true is-ro } (
     ; set true input-el.disabled
     ; set true input-el.readOnly
     ; set true picker-btn.disabled
     ; set true picker-btn.hidden
     ; set true native-picker.disabled
    )

    ; to update-datetime (
     ; to { next-val } $argv
     ; to resolved-next [ match
      { [ propertyIs undefined next-val ] : $ctrl-state.value }
      { true : $next-val }
     ]
     ; to was-invalid [ propertyIs false ctrl-state.valid ]
     ; to copts !view.get-clock-display-opts
     ; to next-ph !resolve-placeholder $copts
     ; set $next-ph input-el.placeholder
     !sync-picker-title $copts
     ; to is-focused [ match
      { $document.activeElement : [ propertyIs $input-el document.activeElement ] }
      { true : false }
     ]
     ; to keep-editing [ and { propertyIs true is-focused } { propertyIs true was-invalid } ]
     [ match
      { $keep-editing : null }
      { true (
       ; set $resolved-next ctrl-state.value
       ; set true ctrl-state.valid
       ; to next-fmt !formatCellInputValue $resolved-next $col undefined $view.tables $copts
       [ match
        { [ propertyIs $next-fmt input-el.value ] : null }
        { true : ; set $next-fmt input-el.value }
       ]
       !apply-input-state true $resolved-next ''
      ) }
     ]
    )
    ; to handle-edit (
     ; condition { propertyIs false is-ro } (
      ; to copts !view.get-clock-display-opts
      ; to raw-text $input-el.value
      ; to cur-display !formatCellInputValue $ctrl-state.value $col undefined $view.tables $copts
      [ match
       { [ and { propertyIs true ctrl-state.valid } { propertyIs $cur-display raw-text } ] (
        !apply-input-state true $ctrl-state.value ''
       ) }
       { true (
        ; to parsed !parseCellValue $raw-text $col undefined $view.tables $copts
        [ match
         { $parsed.ok (
          ; set $parsed.value ctrl-state.value
          ; set true ctrl-state.valid
          !apply-input-state true $parsed.value ''
          !$on-valid $parsed.value
         ) }
         { true (
          ; set false ctrl-state.valid
          !apply-input-state false null $parsed.error
         ) }
        ]
       ) }
      ]
     )
    )
    ; to handle-blur (
     ; to copts !view.get-clock-display-opts
     ; to raw-text $input-el.value
     ; to cur-display !formatCellInputValue $ctrl-state.value $col undefined $view.tables $copts
     [ match
      { [ and { propertyIs true ctrl-state.valid } { propertyIs $cur-display raw-text } ] (
       !apply-input-state true $ctrl-state.value ''
      ) }
      { true (
       ; to parsed !parseCellValue $raw-text $col undefined $view.tables $copts
       [ match
        { $parsed.ok (
         ; set $parsed.value ctrl-state.value
         ; set true ctrl-state.valid
         ; to disp !formatCellInputValue $parsed.value $col undefined $view.tables $copts
         ; set $disp input-el.value
         !apply-input-state true $parsed.value ''
        ) }
       ]
      ) }
     ]
    )
    !input-el.addEventListener input $handle-edit
    !input-el.addEventListener change $handle-edit
    !input-el.addEventListener blur $handle-blur
    !picker-btn.addEventListener click (
     ; condition { propertyIs false is-ro } (
      ; to { ev } $argv
      [ match
       { $ev.preventDefault : !ev.preventDefault }
      ]
      [ match
       { $ev.stopPropagation : !ev.stopPropagation }
      ]
      ; to copts !view.get-clock-display-opts
      ; to local-val [ match
       { $formatDatetimeLocalInTimeZone : !formatDatetimeLocalInTimeZone $ctrl-state.value $copts.timeZone $window.Intl }
       { true : '' }
      ]
      ; set $local-val native-picker.value
      [ match
       { $native-picker.showPicker : ; try ( !native-picker.showPicker ) (
        [ match { $native-picker.focus : !native-picker.focus } ]
        [ match { $native-picker.click : !native-picker.click } ]
       ) }
       { true (
        [ match { $native-picker.focus : !native-picker.focus } ]
        [ match { $native-picker.click : !native-picker.click } ]
       ) }
      ]
     )
    )
    !native-picker.addEventListener change (
     ; condition { propertyIs false is-ro } (
      ; to copts !view.get-clock-display-opts
      ; to parsed !parseCellValue $native-picker.value $col undefined $view.tables $copts
      [ match
       { $parsed.ok (
        ; set $parsed.value ctrl-state.value
        ; set true ctrl-state.valid
        ; to disp !formatCellInputValue $parsed.value $col undefined $view.tables $copts
        ; set $disp input-el.value
        !apply-input-state true $parsed.value ''
        !$on-valid $parsed.value
       ) }
      ]
     )
    )
    [ match
     { $on-enter (
      !input-el.addEventListener keydown (
       ; to { ev } $argv
       ; condition { propertyIs Enter ev.key } (
        [ match
         { $ev.preventDefault : !ev.preventDefault }
        ]
        !handle-blur
        !$on-enter
       )
      )
     ) }
    ]
    ; object { el $wrap } { input-el $input-el } { picker-btn $picker-btn } { native-picker $native-picker } { update-trigger $update-datetime }
   ) }
   { true (
    ; to input-el !document.createElement input
    ; to is-num-col [ match
     { [ propertyIs integer col.type ] : true }
     { [ propertyIs decimal col.type ] : true }
     { [ propertyIs fixed col.type ] : true }
     { true : false }
    ]
    ; to input-type [ match
     { [ propertyIs date col.type ] : date }
     { [ propertyIs datetime col.type ] : datetime-local }
     { [ propertyIs url col.type ] : url }
     { [ propertyIs email col.type ] : email }
     { true : text }
    ]
    ; to placeholder [ match
     { [ propertyIs integer col.type ] : '0' }
     { [ propertyIs decimal col.type ] : '0.0' }
     { [ propertyIs fixed col.type ] : !formatCellInputValue 0 $col }
     { [ propertyIs url col.type ] : 'https://...' }
     { [ propertyIs email col.type ] : 'name@example.com' }
     { [ propertyIs json col.type ] : 'JSON' }
     { true : '' }
    ]
    ; to base-cls [ match
     { [ propertyIs integer col.type ] : 'lane-data-cell-input lane-data-cell-input--num lane-data-cell-input--right' }
     { [ propertyIs decimal col.type ] : 'lane-data-cell-input lane-data-cell-input--num' }
     { [ propertyIs fixed col.type ] : 'lane-data-cell-input lane-data-cell-input--num lane-data-cell-input--right' }
     { [ propertyIs json col.type ] : 'lane-data-cell-input lane-data-cell-input--json' }
     { true : lane-data-cell-input }
    ]
    ; to is-date-like [ match
     { [ propertyIs date col.type ] : true }
     { [ propertyIs datetime col.type ] : true }
     { true : false }
    ]
    ; to formatted !formatCellInputValue $initial-val $col
    ; assign $input-el { type $input-type } { className $base-cls } { value $formatted } { placeholder $placeholder } { spellcheck false } { autocomplete off }
    [ match
     { [ propertyIs integer col.type ] (
      !input-el.setAttribute inputmode numeric
      !input-el.setAttribute data-num-type integer
     ) }
     { [ propertyIs decimal col.type ] (
      !input-el.setAttribute inputmode decimal
      !input-el.setAttribute data-num-type decimal
     ) }
     { [ propertyIs fixed col.type ] (
      !input-el.setAttribute inputmode decimal
      !input-el.setAttribute data-num-type fixed
     ) }
    ]
    ; to parse-current (
     [ match
      { [ and { propertyIs true is-num-col } { $parseNumericCellInput } ] : !parseNumericCellInput $input-el.value $col }
      { true : !parseCellValue $input-el.value $col }
     ]
    )
    ; to ctrl-state ; object { value $initial-val } { syntax-ok true }
    ; to single-spec [ object { type $col.type } { multiple false } ]
    ; to apply-input-state (
     ; to { ok val err-msg } $argv
     ; to cur-text $input-el.value
     ; to is-date-empty [ match
      { $is-date-like : [ propertyIs '' cur-text ] }
      { true : false }
     ]
     ; to is-req-empty [ match
      { $col.required : !isDataCellValueEmpty $val $single-spec }
      { true : false }
     ]
     ; to cls $base-cls
     ; condition { propertyIs true is-date-empty } : ; set [ add $cls ' lane-data-cell-input--date-empty' ] cls
     ; to vres [ match
      { [ and { [ propertyIs true ok ] } { [ propertyIs false is-req-empty ] } ] : !view.validate-cell-value $col $val $owner-tbl $owner-row $item-idx }
      { true : ; object { ok true } { error null } }
     ]
     [ match
      { [ propertyIs false ok ] (
       ; set [ add $cls ' lane-data-cell-input--invalid' ] cls
       ; set $err-msg input-el.title
       !input-el.setAttribute aria-invalid 'true'
      ) }
      { $is-req-empty (
       ; set [ add $cls ' lane-data-cell-input--invalid lane-data-cell-input--required-empty' ] cls
       ; set 'Required value' input-el.title
       !input-el.setAttribute aria-invalid 'true'
      ) }
      { [ propertyIs false vres.ok ] (
       ; set [ add $cls ' lane-data-cell-input--invalid' ] cls
       ; set $vres.error input-el.title
       !input-el.setAttribute aria-invalid 'true'
      ) }
      { true (
       ; set '' input-el.title
       !input-el.setAttribute aria-invalid 'false'
      ) }
     ]
     ; set $cls input-el.className
    )
    !apply-input-state true $initial-val ''
    ; condition { propertyIs true is-ro } (
     ; set true input-el.disabled
     ; set true input-el.readOnly
    )
    ; to revalidate (
     ; to { next-val } $argv
     ; condition { propertyIs true ctrl-state.syntax-ok } (
      ; to cur-v [ match
       { [ propertyIs undefined next-val ] : $ctrl-state.value }
       { true : $next-val }
      ]
      ; set $cur-v ctrl-state.value
      !apply-input-state true $cur-v ''
     )
    )
    ; to handle-edit (
     ; condition { propertyIs false is-ro } (
      ; to parsed !parse-current
      [ match
       { $parsed.ok (
        ; set $parsed.value ctrl-state.value
        ; set true ctrl-state.syntax-ok
        !apply-input-state true $parsed.value ''
        !$on-valid $parsed.value
       ) }
       { true (
        ; set false ctrl-state.syntax-ok
        !apply-input-state false null $parsed.error
       ) }
      ]
     )
    )
    !input-el.addEventListener input $handle-edit
    [ match
     { [ propertyIs date col.type ] : !input-el.addEventListener change $handle-edit }
     { [ propertyIs datetime col.type ] : !input-el.addEventListener change $handle-edit }
     { $is-num-col (
      !input-el.addEventListener blur (
       ; to parsed !parse-current
       [ match
        { $parsed.ok (
         ; to formatted-blur !formatCellInputValue $parsed.value $col
         ; set $formatted-blur input-el.value
        ) }
       ]
      )
     ) }
    ]
    [ match
     { $on-enter (
      !input-el.addEventListener keydown (
       ; to { ev } $argv
       ; condition { propertyIs Enter ev.key } (
        [ match
         { $ev.preventDefault : !ev.preventDefault }
        ]
        !$on-enter
       )
      )
     ) }
    ]
    ; object { el $input-el } { input-el $input-el } { update-trigger $revalidate }
   ) }
  ]
 )

 ; to view.get-multi-item-search-text (
  -- Builds a searchable text string for a single item chip inside a multiple ([]) cell
  ; to { tbl row col item-rec item-val } $argv
  ; to clock-opts !view.get-clock-display-opts
  [ match
   { [ propertyIs row col.type ] (
    ; to info !lookupRowDisplay $view.tables $col $item-val $row $tbl $clock-opts
    [ match
     { $info.isEmpty : '' }
     { true (
      ; to disp-txt [ match { $item-rec.display-el.textContent : $item-rec.display-el.textContent } { true : '' } ]
      ; to id-txt [ match { $item-rec.id-el.textContent : $item-rec.id-el.textContent } { true : '' } ]
      ; to info-lbl [ match { $info.label : $info.label } { true : '' } ]
      ; to info-disp [ match { $info.displayText : $info.displayText } { true : '' } ]
      ; to info-val [ match { $info.valueText : $info.valueText } { true : '' } ]
      ; add $disp-txt ; add ' ' ; add $id-txt ; add ' ' ; add $info-lbl ; add ' ' ; add $info-disp ; add ' ' $info-val
     ) }
    ]
   ) }
   { [ propertyIs lane col.type ] (
    ; to info !view.lookup-lane-info $item-val
    [ match
     { $info.is-empty : '' }
     { true (
      ; to disp-txt [ match { $item-rec.display-el.textContent : $item-rec.display-el.textContent } { true : '' } ]
      ; to id-txt [ match { $item-rec.id-el.textContent : $item-rec.id-el.textContent } { true : '' } ]
      ; to info-lbl [ match { $info.label : $info.label } { true : '' } ]
      ; to info-ttl [ match { $info.title : $info.title } { true : '' } ]
      ; to info-id [ match { $info.id : $info.id } { true : '' } ]
      ; add $disp-txt ; add ' ' ; add $id-txt ; add ' ' ; add $info-lbl ; add ' ' ; add $info-ttl ; add ' ' $info-id
     ) }
    ]
   ) }
   { [ propertyIs boolean col.type ] (
    ; to bool-val !formatCellInputValue $item-val boolean
    [ ternary $bool-val 'true' 'false' ]
   ) }
   { true (
    ; to input-txt [ match
     { [ propertyIs undefined item-rec.input-el.value ] : '' }
     { [ propertyIs null item-rec.input-el.value ] : '' }
     { true : ; add '' $item-rec.input-el.value }
    ]
    ; to fmt-txt !formatCellInputValue $item-val $col undefined $view.tables $clock-opts
    [ match
     { [ propertyIs '' input-txt ] : ; add '' $fmt-txt }
     { [ propertyIs $input-txt fmt-txt ] : $input-txt }
     { true : ; add $input-txt ; add ' ' $fmt-txt }
    ]
   ) }
  ]
 )

 ; to view.apply-multi-filter (
  -- Filters visible chip items in a multiple ([]) cell by the cell's filter input query
  ; to { tbl row col cell-rec } $argv
  ; to raw-q [ match
   { $cell-rec.filter-input.value : ; add '' $cell-rec.filter-input.value }
   { true : '' }
  ]
  ; set $raw-q cell-rec.filter-query
  ; to trimmed !raw-q.trim
  ; to q !trimmed.toLowerCase
  ; to has-q [ match
   { [ propertyIs '' q ] : false }
   { true : true }
  ]
  ; to raw-val [ get row.values $col.id ]
  ; to arr [ match
   { [ !window.Array.isArray $raw-val ] : $raw-val }
   { true : {} }
  ]
  ; to match-count ; object { count 0 }
  ; each $cell-rec.items (
   ; to { item-rec idx } $argv
   ; to item-val [ get arr $idx ]
   ; to is-match [ match
    { [ propertyIs false has-q ] : true }
    { true (
     ; to search-txt !view.get-multi-item-search-text $tbl $row $col $item-rec $item-val
     ; to lower-txt !search-txt.toLowerCase
     !lower-txt.includes $q
    ) }
   ]
   ; to is-hidden [ ternary $is-match false true ]
   ; set $is-match item-rec.matched
   ; set $is-hidden item-rec.hidden
   ; set $is-hidden item-rec.el.hidden
   ; condition { propertyIs true is-match } : ; set [ add $match-count.count 1 ] match-count.count
  )
  ; set $match-count.count cell-rec.match-count
  $match-count.count
 )

 ; to view.get-selectable-col-status (
  -- Determines whether a column supports multiselect option picking (row, lane, or text with workflow constraint) and whether its source is configured
  ; to { col owner-tbl } $argv
  [ match
   { [ propertyIs row col.type ] (
    ; to target !resolveRowTarget $view.tables $col $owner-tbl
    [ match
     { $target.valid : ; object { selectable true } { ready true } { reason '' } }
     { $target.configured : ; object { selectable true } { ready false } { reason 'Linked table or column not found' } }
     { true : ; object { selectable true } { ready false } { reason 'Select linked table and column in Schema' } }
    ]
   ) }
   { [ propertyIs lane col.type ] (
    [ match
     { $lane-control.pick-lane : ; object { selectable true } { ready true } { reason '' } }
     { true : ; object { selectable true } { ready false } { reason 'Lane picker unavailable' } }
    ]
   ) }
   { [ match { $getColumnWorkflowConstraint : !getColumnWorkflowConstraint $col } { true : null } ] (
    ; to wf-target !resolveWorkflowTarget $view.tables $col
    [ match
     { $wf-target.valid : ; object { selectable true } { ready true } { reason '' } }
     { $wf-target.configured : ; object { selectable true } { ready false } { reason [ match { $wf-target.typeMismatch : ; add 'Workflow From and To columns must be ' $col.type } { true : 'Workflow table or columns not found' } ] } }
     { true : ; object { selectable true } { ready false } { reason 'Configure workflow table, From, and To columns in Schema' } }
    ]
   ) }
   { true : ; object { selectable false } { ready true } { reason '' } }
  ]
 )

 ; to view.sync-multi-add-btn (
  -- Updates the + button enabled state and tooltip on a multiple ([]) cell
  ; to { tbl col add-btn } $argv
  ; to is-ro !view.is-readonly-table $tbl
  [ match
   { $add-btn (
    ; set $is-ro add-btn.hidden
    [ match
     { $is-ro (
      ; set true add-btn.disabled
      ; set 'Read-only remote table' add-btn.title
     ) }
     { true (
      ; to st !view.get-selectable-col-status $col $tbl
      [ match
       { $st.selectable (
        ; set [ ternary $st.ready false true ] add-btn.disabled
        ; set [ ternary $st.ready 'Add or remove items' $st.reason ] add-btn.title
       ) }
       { true (
        ; set false add-btn.disabled
        ; set 'Add item' add-btn.title
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to view.open-multi-select (
  -- Opens a multiselect modal (with Apply / Cancel) for a selectable multiple ([]) cell (lane[], row[], or text(workflow)[])
  ; to { tbl row row-idx col cell-rec on-row-edited } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; condition { propertyIs false is-ro } (
   ; to raw-val [ get row.values $col.id ]
  ; to raw-arr [ match
   { [ !window.Array.isArray $raw-val ] : $raw-val }
   { true : !coerceDataValue $raw-val $col true null $view.tables }
  ]
  ; to single-spec [ object { type $col.type } { multiple false } ]
  ; to cur-list {}
  ; each $raw-arr (
   ; to { iv } $argv
   ; to is-empty !isDataCellValueEmpty $iv $single-spec
   ; condition { propertyIs false is-empty } : !cur-list.push $iv
  )
  ; to apply-multi-values (
   ; to { next-vals } $argv
   ; to coerced !coerceDataValue $next-vals $col true null $view.tables
   ; to row.values $col.id $coerced
   !view.render-multi-cell $tbl $row $row-idx $col $cell-rec -1
   !view.refresh-row-cells $row
   !view.save-row $tbl $row
   [ match { $on-row-edited : !$on-row-edited } ]
  )
  [ match
   { [ propertyIs lane col.type ] (
    [ match
     { $lane-control.pick-lane (
      ; to trimmed-name !col.name.trim
      ; to title [ match
       { [ propertyIs '' trimmed-name ] : 'Select Lanes' }
       { true : ; add 'Select ' $trimmed-name }
      ]
      ; to pick-opts [ object
       { lane $view.lane }
       { lane-id $view.lane.id }
       { multiple true }
       { title $title }
       { current-values $cur-list }
       { on-select $apply-multi-values }
      ]
      !lane-control.pick-lane $pick-opts
     ) }
    ]
   ) }
   { [ propertyIs row col.type ] (
    ; to target !resolveRowTarget $view.tables $col $tbl
    ; condition { propertyIs true target.valid } (
     ; to col-label !view.display-col-name $col
     ; to trimmed-tbl !target.table.name.trim
     ; to tbl-name [ match
      { [ propertyIs '' trimmed-tbl ] : $target.table.id }
      { true : $trimmed-tbl }
     ]
     ; to title ; add 'Select ' ; add $col-label ; add ' (' ; add $tbl-name ')'
     ; to ph ; add 'Search ' ; add $tbl-name ' rows...'
     ; to init-row-vals ; object
     ; each $target.table.columns (
      ; to { tcol } $argv
      ; to def-v [ match
       { $tcol.multiple : {} }
       { [ propertyIs boolean tcol.type ] : false }
       { [ propertyIs integer tcol.type ] : null }
       { [ propertyIs decimal tcol.type ] : null }
       { [ propertyIs fixed tcol.type ] : null }
       { true : !defaultDataValue $tcol }
      ]
      ; to init-row-vals $tcol.id $def-v
     )
     ; to can-prefill-filter [ match
      { [ and { $target.filterValid } { $target.refFilterCol } { $target.filterByCol } { $row.values } ] : true }
      { true : false }
     ]
     [ match
      { $can-prefill-filter (
       ; to raw-fval [ get row.values $target.filterByCol.id ]
       ; to filter-empty !isDataCellValueEmpty $raw-fval $target.filterByCol
       [ match
        { [ propertyIs false filter-empty ] (
         ; to prefilled [ match
          { $target.refFilterCol.multiple [ match
           { [ !window.Array.isArray $raw-fval ] : !coerceDataValue $raw-fval $target.refFilterCol true $target.filterByCol $view.tables }
           { true (
            ; to single-coerced !coerceDataValue $raw-fval $target.refFilterCol false $target.filterByCol $view.tables
            { $single-coerced }
           ) }
          ] }
          { [ !window.Array.isArray $raw-fval ] [ match
           { [ propertyIsGreaterThan 0 raw-fval.length ] : !coerceDataValue [ get raw-fval 0 ] $target.refFilterCol false $target.filterByCol $view.tables }
           { true : !defaultDataValue $target.refFilterCol }
          ] }
          { true : !coerceDataValue $raw-fval $target.refFilterCol false $target.filterByCol $view.tables }
         ]
         ; to init-row-vals $target.refFilterCol.id $prefilled
        ) }
       ]
      ) }
     ]
     ; to create-row-fn (
      ; to { row-values } $argv
      ; to values ; object
      ; each $target.table.columns (
       ; to { tcol } $argv
       ; to has-draft [ match
        { $row-values : [ !window.Object.hasOwn $row-values $tcol.id ] }
        { true : false }
       ]
       ; to col-val [ match
        { $has-draft : !coerceDataValue [ get row-values $tcol.id ] $tcol $tcol.multiple null $view.tables }
        { true : !defaultDataValue $tcol }
       ]
       ; to values $tcol.id $col-val
      )
      ; to new-row [ object
       { id !view.next-id row }
       { values $values }
      ]
      !target.table.rows.push $new-row
      !view.update-table-tabs-text
      ; to row-ids !collect-ids $target.table.rows
      !addTableRow $data $view.lane.data $view.lane.id $target.table $new-row $row-ids
      !view.notify-record-change $target.table $new-row add-row
      ; to chosen-val [ get values $target.linkCol.id ]
      ; to after-select (
       !view.render-grid
      )
      ; object { ok true } { row $new-row } { value $chosen-val } { after-select $after-select }
     )
     ; to target-is-ro !view.is-readonly-table $target.table
     ; to pick-opts [ object
      { lane $view.lane }
      { lane-id $view.lane.id }
      { host $view.container }
      { multiple true }
      { title $title }
      { placeholder $ph }
      { current-values $cur-list }
      { page-size $view.row-page-size }
      { tables $view.tables }
      { target-table $target.table }
      { target-columns $target.table.columns }
      { link-col $target.linkCol }
      { display-col $target.displayCol }
      { initial-row-values $init-row-vals }
      { resolve-display (
       ; to { val } $argv
       ; to clock-opts !view.get-clock-display-opts
       !lookupRowDisplay $view.tables $col $val $row $tbl $clock-opts
      ) }
      { fetch-page (
       ; to { offset limit } $argv
       !view.fetch-row-page $col $offset $limit $row $tbl
      ) }
       { on-create-row [ ternary $target-is-ro null $create-row-fn ] }
       { on-select $apply-multi-values }
      ]
      !view.row-picker.open $pick-opts
     )
    ) }
    { [ match { $getColumnWorkflowConstraint : !getColumnWorkflowConstraint $col } { true : null } ] (
     ; to wf-target !resolveWorkflowTarget $view.tables $col
     ; condition { propertyIs true wf-target.valid } (
      ; to col-label !view.display-col-name $col
      ; to title ; add 'Select ' ; add $col-label ; add ' (' ; add $wf-target.tableName ')'
      ; to state-items {}
      ; to seen-states ; object
      ; each $wf-target.fromValues (
       ; to { fv } $argv
       ; to already [ get seen-states $fv ]
       [ match
        { $already : null }
        { [ propertyIs '' fv ] : null }
        { true (
         ; to seen-states $fv true
         ; to typed-fv !parseWorkflowOptionValue $fv $col
         !state-items.push [ object { value $typed-fv } { valueText $fv } { displayText $fv } { hasSeparateDisplay false } { label $fv } ]
        ) }
       ]
      )
      ; each $wf-target.toValues (
       ; to { tv } $argv
       ; to already [ get seen-states $tv ]
       [ match
        { $already : null }
        { [ propertyIs '' tv ] : null }
        { true (
         ; to seen-states $tv true
         ; to typed-tv !parseWorkflowOptionValue $tv $col
         !state-items.push [ object { value $typed-tv } { valueText $tv } { displayText $tv } { hasSeparateDisplay false } { label $tv } ]
        ) }
       ]
      )
      ; to pick-opts [ object
       { lane $view.lane }
       { lane-id $view.lane.id }
       { host $view.container }
       { multiple true }
       { title $title }
       { placeholder 'Filter states...' }
       { item-noun state }
       { item-noun-plural states }
       { empty-message 'No workflow states available in mapped table.' }
       { current-values $cur-list }
       { page-size $view.row-page-size }
       { resolve-display (
        ; to { val } $argv
        ; to wf-st !getWorkflowCellState $view.tables $col $val
        ; to st-txt $wf-st.currentValue
        ; object { isEmpty !isDataCellValueEmpty $val $single-spec } { valueText $st-txt } { displayText $st-txt } { hasSeparateDisplay false } { label $st-txt } { filterMatched $wf-st.isValueValid }
       ) }
       { fetch-page (
        ; to { offset limit } $argv
        ; to end ; add $offset $limit
        ; to slice !state-items.slice $offset $end
        ; to next-off ; add $offset $slice.length
        ; to has-more [ propertyIsLessThan $state-items.length next-off ]
        ; object { ok true } { items $slice } { total $state-items.length } { nextOffset $next-off } { hasMore $has-more }
       ) }
       { on-select $apply-multi-values }
      ]
      !view.row-picker.open $pick-opts
     )
    ) }
   ]
  )
 )

 ; to view.render-multi-cell (
  -- Renders a multiple-value ([]) cell editor with typed item inputs, confirmed removal, and + item button
  ; to { tbl row row-idx col cell-rec focus-idx } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; to items-el $cell-rec.items-el
  ; while { propertyIsGreaterThan 0 cell-rec.items.length } (
   ; to old !cell-rec.items.pop
   !old.el.remove
  )
  !view.sync-multi-add-btn $tbl $col $cell-rec.add-btn
  ; to raw-val [ get row.values $col.id ]
  ; to arr [ match
   { [ !window.Array.isArray $raw-val ] : $raw-val }
   { true (
    ; to coerced !coerceDataValue $raw-val $col true null $view.tables
    ; to row.values $col.id $coerced
    $coerced
   ) }
  ]
  ; to multi-picker-cb [ match
   { $is-ro : null }
   { [ propertyIs row col.type ] : : !view.open-multi-select $tbl $row $row-idx $col $cell-rec $cell-rec.on-row-edited }
   { [ propertyIs lane col.type ] : : !view.open-multi-select $tbl $row $row-idx $col $cell-rec $cell-rec.on-row-edited }
   { true : null }
  ]
  ; each $arr (
   ; to { item-val item-idx } $argv
   ; to item-el !document.createElement div
   ; set lane-data-multi-item item-el.className
   ; to on-item-valid (
    ; to { next-val } $argv
    ; to arr $item-idx $next-val
    !view.sync-td-state $col $cell-rec.td $arr $cell-rec.multi-wrap
    !view.apply-multi-filter $tbl $row $col $cell-rec
    !view.refresh-row-cells $row
    !view.save-row $tbl $row
   )
   ; to on-item-enter (
    ; to next-idx ; add $item-idx 1
    ; to def-item !defaultDataValue $col false
    !arr.splice $next-idx 0 $def-item
    !view.render-multi-cell $tbl $row $row-idx $col $cell-rec $next-idx
    !view.refresh-row-cells $row
    !view.save-row $tbl $row
   )
   ; to eff-enter [ ternary $is-ro null $on-item-enter ]
   ; to ctrl !view.create-typed-control $col $item-val $on-item-valid $eff-enter $tbl $row $multi-picker-cb $item-idx
   ; to rm-btn !document.createElement button
   ; assign $rm-btn { type button } { className lane-data-multi-remove } { textContent '×' } { title 'Remove item' } { hidden $is-ro } { disabled $is-ro }
   !rm-btn.addEventListener click : ; condition { propertyIs false is-ro } : !view.request-remove-multi-item $tbl $row $row-idx $col $cell-rec $item-idx
   !item-el.appendChild $ctrl.el
   !item-el.appendChild $rm-btn
   !items-el.appendChild $item-el
   ; to item-rec [ object
    { el $item-el }
    { input-el $ctrl.input-el }
    { select-el $ctrl.select-el }
    { option-els $ctrl.option-els }
    { trigger-el $ctrl.trigger-el }
    { open-el $ctrl.open-el }
    { placeholder-el $ctrl.placeholder-el }
    { display-el $ctrl.display-el }
    { id-el $ctrl.id-el }
    { update-trigger $ctrl.update-trigger }
    { remove-btn $rm-btn }
    { index $item-idx }
    { matched true }
    { hidden false }
   ]
   !cell-rec.items.push $item-rec
  )
  !view.sync-td-state $col $cell-rec.td $arr $cell-rec.multi-wrap
  !view.apply-multi-filter $tbl $row $col $cell-rec
  [ match
   { [ propertyIsGreaterThanOrEqual 0 focus-idx ] (
    ; to target [ get cell-rec.items $focus-idx ]
    [ match
     { $target.input-el.focus : !target.input-el.focus }
    ]
   ) }
  ]
 )

 ; to view.request-remove-multi-item (
  -- Prompts for confirmation before removing an item from a multiple ([]) cell
  ; to { tbl row row-idx col cell-rec item-idx } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; condition { propertyIs false is-ro } (
   ; to arr [ get row.values $col.id ]
   ; to item-val [ get arr $item-idx ]
   ; to col-label !view.display-col-name $col
   ; to row-num ; add $row-idx 1
   ; to item-num ; add $item-idx 1
   ; to val-str [ match
    { [ propertyIs row col.type ] (
     ; to clock-opts !view.get-clock-display-opts
     ; to info !lookupRowDisplay $view.tables $col $item-val undefined undefined $clock-opts
     [ match
      { $info.isEmpty : empty }
      { [ propertyIs '' info.label ] : empty }
      { true : $info.label }
     ]
    ) }
    { [ propertyIs lane col.type ] (
     ; to info !view.lookup-lane-info $item-val
     [ match
      { $info.is-empty : empty }
      { [ propertyIs '' info.label ] : empty }
      { true : $info.label }
     ]
    ) }
    { true : !formatCellInputValue $item-val $col undefined $view.tables [ !view.get-clock-display-opts ] }
   ]
   ; to msg ; add 'Remove item #' ; add $item-num ; add ' ("' ; add $val-str ; add '") from "' ; add $col-label ; add '" in row #' ; add $row-num '?'
   ; to opts [ object
    { title 'Remove Item' }
    { message $msg }
    { confirm-label 'Remove item' }
    { on-confirm (
     !arr.splice $item-idx 1
     !view.render-multi-cell $tbl $row $row-idx $col $cell-rec -1
     !view.refresh-row-cells $row
     !view.save-row $tbl $row
    ) }
   ]
   !view.confirm $opts
  )
 )

 ; to view.is-right-aligned-col (
  -- Returns true for integer and fixed numeric types (right-aligned cells only)
  ; to { col } $argv
  [ match
   { [ propertyIs integer col.type ] : true }
   { [ propertyIs fixed col.type ] : true }
   { true : false }
  ]
 )

 ; to view.td-class-for-col (
  -- Builds the CSS class string for a data cell based on alignment, explicit column width, and required-empty state
  ; to { col has-width is-req-empty } $argv
  ; to is-right !view.is-right-aligned-col $col
  ; to base [ ternary $is-right 'lane-data-td lane-data-td--right' lane-data-td ]
  ; to sized [ ternary $has-width [ add $base ' lane-data-td--sized' ] $base ]
  [ ternary $is-req-empty [ add $sized ' lane-data-td--required-empty' ] $sized ]
 )

 ; to view.sync-td-state (
  -- Updates a cell's td (and multi-wrap if multiple) CSS class based on column width and required-empty state
  ; to { col td val multi-wrap } $argv
  ; to w !normalizeColumnWidth $col.width
  ; to has-w [ match { $w : true } { true : false } ]
  ; to is-req-empty [ match
   { $col.required : !isDataCellValueEmpty $val $col }
   { true : false }
  ]
  [ match
   { $td : ; set [ !view.td-class-for-col $col $has-w $is-req-empty ] td.className }
  ]
  [ match
   { $multi-wrap : ; set [ ternary $is-req-empty 'lane-data-multi lane-data-multi--required-empty' lane-data-multi ] multi-wrap.className }
  ]
 )

 ; to view.apply-column-width (
  -- Applies or clears an explicit pixel width across a column header and all cells in that column
  ; to { col-idx raw-width } $argv
  ; to w !normalizeColumnWidth $raw-width
  ; to has-w [ match { $w : true } { true : false } ]
  ; to px [ match { $w : ; add $w px } { true : '' } ]
  ; to col-head-offset [ match
   { [ propertyIsGreaterThan 0 view.grid-head-cells.length ] (
    ; to first-h [ get view.grid-head-cells 0 ]
    [ ternary [ propertyIs subtoggle first-h.kind ] 2 1 ]
   ) }
   { true : 1 }
  ]
  ; to h-idx ; add $col-idx $col-head-offset
  ; to h-cell [ get view.grid-head-cells $h-idx ]
  [ match
   { $h-cell.el (
    ; assign h-cell.el.style { width $px } { minWidth $px } { maxWidth $px }
    ; set [ ternary $has-w 'lane-data-th lane-data-th--sized' lane-data-th ] h-cell.el.className
   ) }
  ]
  ; to f-cell [ get view.grid-filter-cells $h-idx ]
  [ match
   { $f-cell.el (
    ; assign f-cell.el.style { width $px } { minWidth $px } { maxWidth $px }
    ; set [ ternary $has-w 'lane-data-th lane-data-filter-th lane-data-th--sized' 'lane-data-th lane-data-filter-th' ] f-cell.el.className
   ) }
  ]
  ; each $view.grid-rows (
   ; to { grow } $argv
   ; to cell [ get grow.cells $col-idx ]
   [ match
    { $cell.td (
     ; assign cell.td.style { width $px } { minWidth $px } { maxWidth $px }
     ; to cur-val [ get grow.row.values $cell.col.id ]
     !view.sync-td-state $cell.col $cell.td $cur-val $cell.multi-wrap
    ) }
   ]
  )
 )

 ; to view.get-inbound-subtables (
  -- Returns all tables in this lane that have at least one row column referencing the given target table
  ; to { target-tbl } $argv
  [ match
   { [ and { $target-tbl } { $resolveInboundSubtables } ] : !resolveInboundSubtables $view.tables $target-tbl }
   { true : {} }
  ]
 )

 ; to view.is-subtable-visible (
  -- Returns true if the given subtable ID is enabled in display options for the active table in this session
  ; to { tbl-id subtable-id } $argv
  [ match
   { $lane-control.is-subtable-visible : !lane-control.is-subtable-visible $view.lane.id $tbl-id $subtable-id }
   { true : false }
  ]
 )

 ; to view.toggle-subtable-option (
  -- Toggles show/hide display state for an inbound subtable when viewing the active table, marking the session dirty
  ; to { tbl-id subtable-id } $argv
  [ match
   { $lane-control.toggle-subtable-visible : !lane-control.toggle-subtable-visible $view.lane.id $tbl-id $subtable-id }
  ]
  !view.render-grid
 )

 ; to view.is-subtable-group-collapsed (
  -- Returns true when a specific parent row's subtable group has been collapsed via its caret
  ; to { tbl-id row-id subtable-id } $argv
  ; to key ; add $tbl-id ; add ':' ; add $row-id ; add ':' $subtable-id
  ; to flag [ get view.subtable-group-collapsed $key ]
  [ ternary $flag true false ]
 )

 ; to view.toggle-subtable-group-collapsed (
  -- Toggles the expanded/collapsed state of a parent row's subtable group caret (default expanded)
  ; to { tbl-id row-id subtable-id } $argv
  ; to key ; add $tbl-id ; add ':' ; add $row-id ; add ':' $subtable-id
  ; to was-collapsed !view.is-subtable-group-collapsed $tbl-id $row-id $subtable-id
  ; to next-collapsed [ ternary $was-collapsed false true ]
  ; to view.subtable-group-collapsed $key $next-collapsed
  $next-collapsed
 )

 ; to view.render-display-options (
  -- Renders the row of table display options right above the header row for toggling inbound subtables
  ; to { tbl inbound-list } $argv
  ; while { propertyIsGreaterThan 0 view.display-options-btns.length } (
   ; to old-btn !view.display-options-btns.pop
   !old-btn.el.remove
  )
  ; to has-inbound [ match
   { [ and { $tbl } { $inbound-list } { [ propertyIsGreaterThan 0 inbound-list.length ] } ] : true }
   { true : false }
  ]
  ; set [ ternary $has-inbound false true ] display-options-el.hidden
  [ match
   { $has-inbound (
    ; each $inbound-list (
     ; to { sub-spec } $argv
     ; to sub-tbl $sub-spec.table
     ; to sub-id $sub-spec.tableId
     ; to is-on !view.is-subtable-visible $tbl.id $sub-id
     ; to btn !document.createElement button
     ; to cls [ ternary $is-on 'lane-data-display-option lane-data-display-option--active' lane-data-display-option ]
     ; to link-col-names {}
     ; each $sub-spec.links (
      ; to { lnk } $argv
      !link-col-names.push $lnk.sourceColumnName
     )
     ; to via-txt !link-col-names.join ', '
     ; to ttl ; add [ ternary $is-on 'Hide ' 'Show ' ] ; add $sub-spec.tableName ; add ' rows linked via ' ; add $sub-spec.tableName ; add '.' $via-txt
     ; assign $btn { type button } { className $cls } { title $ttl }
     !btn.setAttribute aria-pressed [ ternary $is-on 'true' 'false' ]
     !btn.setAttribute data-subtable-id $sub-id
     ; to check-span !document.createElement span
     ; assign $check-span { className lane-data-display-option-check } { textContent [ ternary $is-on '▾' '▸' ] }
     ; to name-span !document.createElement span
     ; assign $name-span { className lane-data-display-option-name } { textContent $sub-spec.tableName }
     ; to count-span !document.createElement span
     ; assign $count-span { className lane-data-display-option-count } { textContent $sub-tbl.rows.length }
     !btn.appendChild $check-span
     !btn.appendChild $name-span
     !btn.appendChild $count-span
     !btn.addEventListener click : !view.toggle-subtable-option $tbl.id $sub-id
     !display-options-list.appendChild $btn
     !view.display-options-btns.push [ object
      { subtable-id $sub-id }
      { table $sub-tbl }
      { active $is-on }
      { el $btn }
      { check-el $check-span }
      { name-el $name-span }
      { count-el $count-span }
     ]
    )
   ) }
  ]
 )

 ; to view.build-row-cells (
  -- Builds and appends the editable data cells for a row in tbl into tr and returns the cells array
  ; to { tbl row row-idx tr on-row-edited cols-override } $argv
  ; to cols-list [ match
   { [ !window.Array.isArray $cols-override ] : $cols-override }
   { true : $tbl.columns }
  ]
  ; to cells {}
  ; each $cols-list (
   ; to { col } $argv
   ; to td !document.createElement td
   ; to saved-col-w !normalizeColumnWidth $col.width
   ; to has-saved-w [ match { $saved-col-w : true } { true : false } ]
   ; set [ !view.td-class-for-col $col $has-saved-w false ] td.className
   [ match
    { $saved-col-w (
     ; to col-px ; add $saved-col-w px
     ; assign td.style { width $col-px } { minWidth $col-px } { maxWidth $col-px }
    ) }
   ]
   ; to cur-val [ get row.values $col.id ]
   [ match
    { $col.multiple (
     ; to multi-wrap !document.createElement div
     ; set lane-data-multi multi-wrap.className
     ; to filter-input !document.createElement input
     ; assign $filter-input { type text } { className lane-data-multi-filter } { placeholder 'Filter items…' } { title 'Filter items in this cell' } { spellcheck false } { autocomplete off }
     !filter-input.setAttribute aria-label 'Filter items'
     ; to items-el !document.createElement div
     ; set lane-data-multi-items items-el.className
     ; to add-item-btn !document.createElement button
     ; assign $add-item-btn { type button } { className lane-data-multi-add } { textContent '+' } { title 'Add item' }
     !multi-wrap.appendChild $filter-input
     !multi-wrap.appendChild $items-el
     !multi-wrap.appendChild $add-item-btn
     !td.appendChild $multi-wrap
     ; to cell-rec [ object
      { col $col }
      { td $td }
      { multi true }
      { multi-wrap $multi-wrap }
      { filter-input $filter-input }
      { filter-el $filter-input }
      { filter-query '' }
      { match-count 0 }
      { items-el $items-el }
      { add-btn $add-item-btn }
      { on-row-edited $on-row-edited }
      { items {} }
     ]
     !filter-input.addEventListener input (
      !view.apply-multi-filter $tbl $row $col $cell-rec
     )
     !filter-input.addEventListener keydown (
      ; to { ev } $argv
      ; condition { propertyIs Escape ev.key } (
       ; to cur-q [ match { $filter-input.value : ; add '' $filter-input.value } { true : '' } ]
       ; to is-empty-q [ propertyIs '' cur-q ]
       ; condition { propertyIs false is-empty-q } (
        [ match
         { $ev.preventDefault : !ev.preventDefault }
        ]
        [ match
         { $ev.stopPropagation : !ev.stopPropagation }
        ]
        ; set '' filter-input.value
        !view.apply-multi-filter $tbl $row $col $cell-rec
       )
      )
     )
     !add-item-btn.addEventListener click (
      ; to tbl-is-ro !view.is-readonly-table $tbl
      ; condition { propertyIs false tbl-is-ro } (
       ; to sel-st !view.get-selectable-col-status $col $tbl
       [ match
        { $sel-st.selectable (
         ; condition { propertyIs true sel-st.ready } : !view.open-multi-select $tbl $row $row-idx $col $cell-rec $on-row-edited
        ) }
        { true (
         ; to arr [ get row.values $col.id ]
         ; to list [ match
          { [ !window.Array.isArray $arr ] : $arr }
          { true (
           ; to fresh {}
           ; to row.values $col.id $fresh
           $fresh
          ) }
         ]
         ; to def-val !defaultDataValue $col false
         !list.push $def-val
         ; to new-idx ; subtract $list.length 1
         !view.render-multi-cell $tbl $row $row-idx $col $cell-rec $new-idx
         !view.save-row $tbl $row
         [ match { $on-row-edited : !$on-row-edited } ]
        ) }
       ]
      )
     )
     !view.render-multi-cell $tbl $row $row-idx $col $cell-rec -1
     !cells.push $cell-rec
    ) }
    { true (
     ; to on-valid (
      ; to { next-val } $argv
      ; to row.values $col.id $next-val
      !view.sync-td-state $col $td $next-val null
      !view.refresh-row-cells $row
      !view.save-row $tbl $row
      [ match { $on-row-edited : !$on-row-edited } ]
     )
     ; to ctrl !view.create-typed-control $col $cur-val $on-valid null $tbl $row
     !td.appendChild $ctrl.el
     !view.sync-td-state $col $td $cur-val null
     ; to cell-rec [ object
      { col $col }
      { td $td }
      { multi false }
      { input-el $ctrl.input-el }
      { select-el $ctrl.select-el }
      { option-els $ctrl.option-els }
      { trigger-el $ctrl.trigger-el }
      { open-el $ctrl.open-el }
      { placeholder-el $ctrl.placeholder-el }
      { display-el $ctrl.display-el }
      { id-el $ctrl.id-el }
      { update-trigger $ctrl.update-trigger }
     ]
     !cells.push $cell-rec
    ) }
   ]
   !tr.appendChild $td
  )
  $cells
 )

 ; to view.render-grid (
  -- Renders the editable table headers, filters row, display options bar, and rows (plus any visible inbound subtable groups) for the active table
  ; while { propertyIsGreaterThan 0 view.grid-head-cells.length } (
   ; to old-h !view.grid-head-cells.pop
   !old-h.el.remove
  )
  ; while { propertyIsGreaterThan 0 view.grid-filter-cells.length } (
   ; to old-f !view.grid-filter-cells.pop
   [ match
    { $old-f.chips (
     ; each $old-f.chips (
      ; to { oc } $argv
      [ match { $oc.el.remove : !oc.el.remove } ]
     )
    ) }
   ]
   [ match { $old-f.add-btn.remove : !old-f.add-btn.remove } ]
   [ match { $old-f.el.remove : !old-f.el.remove } ]
  )
  !clear-children $grid-frow
  ; while { propertyIsGreaterThan 0 view.grid-rows.length } (
   ; to old-r !view.grid-rows.pop
   [ match
    { $old-r.subtable-groups (
     ; each $old-r.subtable-groups (
      ; to { sgrp } $argv
      [ match { $sgrp.el.remove : !sgrp.el.remove } ]
     )
    ) }
   ]
   !old-r.el.remove
  )
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to is-ro !view.is-readonly-table $tbl
    ; to col-count $tbl.columns.length
    ; to row-count $tbl.rows.length
    ; to st !view.ensure-table-views-state $tbl
    ; to clock-opts !view.get-clock-display-opts
    ; to pinned [ get view.pinned-row-ids $tbl.id ]
    ; to filtered [ match
     { $filterTableRows : !filterTableRows $tbl $st.workingFilters [ object { tables $view.tables } { displayOpts $clock-opts } { lookupLaneTitle $view.lookup-lane-title } { pinnedRowIds $pinned } ] }
     { true (
      ; to fb-entries {}
      ; each $tbl.rows (
       ; to { frow fidx } $argv
       !fb-entries.push ; object { row $frow } { rowIndex $fidx } { rowNumber ; add $fidx 1 }
      )
      ; object { matchedEntries $fb-entries } { totalCount $row-count } { matchedCount $row-count } { hasActiveFilters false }
     ) }
    ]
    ; set [ match
     { [ propertyIs true filtered.hasActiveFilters ] : ; add 'Rows (' ; add $filtered.matchedCount ; add ' of ' ; add $row-count ')' }
     { true : ; add 'Rows (' ; add $row-count ')' }
    ] rows-title.textContent
    ; to has-cols [ propertyIsGreaterThan 0 col-count ]
    ; to has-rows [ propertyIsGreaterThan 0 row-count ]
    ; set $is-ro add-row-btn.hidden
    ; set [ match { $is-ro : true } { $has-cols : false } { true : true } ] add-row-btn.disabled
    ; set [ ternary $is-ro 'Read-only remote table' 'Add a new row to this table' ] add-row-btn.title
    ; set [ match { $is-ro : true } { $has-rows : false } { true : true } ] clear-rows-btn.disabled
    ; set [ ternary $has-cols false true ] grid-wrap.hidden

    ; to inbound-subtables !view.get-inbound-subtables $tbl
    !view.render-display-options $tbl $inbound-subtables
    ; to visible-subtables {}
    ; each $inbound-subtables (
     ; to { sub-spec } $argv
     ; to is-vis !view.is-subtable-visible $tbl.id $sub-spec.tableId
     ; condition { propertyIs true is-vis } : !visible-subtables.push $sub-spec
    )
    ; to has-visible-subtables [ propertyIsGreaterThan 0 visible-subtables.length ]

    [ match
     { $has-cols (
      [ match
       { $has-visible-subtables (
        ; to subtoggle-th !document.createElement th
        ; assign $subtoggle-th { className 'lane-data-th lane-data-th--subtoggle' } { textContent '' }
        !grid-hrow.appendChild $subtoggle-th
        !view.grid-head-cells.push ; object { kind subtoggle } { el $subtoggle-th }
       ) }
      ]
      ; to num-th !document.createElement th
      ; assign $num-th { className 'lane-data-th lane-data-th--num' } { textContent '#' }
      !grid-hrow.appendChild $num-th
      !view.grid-head-cells.push ; object { kind num } { el $num-th }

      ; each $tbl.columns (
       ; to { col col-idx } $argv
       ; to th !document.createElement th
       ; set lane-data-th th.className
       ; to th-inner !document.createElement div
       ; set lane-data-th-inner th-inner.className
       ; to name-span !document.createElement span
       ; assign $name-span { className lane-data-th-name } { textContent !view.display-col-name $col }
       ; to type-text !formatColumnType $col undefined undefined $view.tables
       ; to type-span !document.createElement span
       ; assign $type-span { className lane-data-th-type } { textContent $type-text }
       [ match
        { [ propertyIs row col.type ] (
         ; to row-target !resolveRowTarget $view.tables $col $tbl
         [ match
          { $row-target.valid (
           ; to lit-fmt !formatColumnType $row-target.valueSpec
           ; to hint-title ; add $type-text ; add ' · literal ' $lit-fmt
           [ match
            { $row-target.displayCol (
             ; to d-name !view.display-col-name $row-target.displayCol
             ; set [ add $hint-title ; add ' · display ' $d-name ] hint-title
            ) }
           ]
           [ match
            { $row-target.filterValid (
             ; to filter-op [ match { $row-target.refFilterCol.multiple : ' contains ' } { true : ' is ' } ]
             ; set [ add $hint-title ; add ' · filter where ' ; add $row-target.tableName ; add '.' ; add $row-target.refFilterColName ; add $filter-op ; add $row-target.ownerTableName ; add '.' $row-target.filterByColName ] hint-title
            ) }
           ]
           ; set $hint-title type-span.title
          ) }
          { true : ; set 'Linked row column not configured' type-span.title }
         ]
        ) }
        { [ propertyIs lane col.type ] : ; set 'Stores a selected lane ID' type-span.title }
       ]
       ; to c-desc [ match
        { $describeAllColumnConstraints : !describeAllColumnConstraints $col $view.tables $clock-opts }
        { true : '' }
       ]
       ; condition { propertyIsGreaterThan 0 c-desc.length } (
        [ match
         { [ propertyIs '' type-span.title ] : ; set $c-desc type-span.title }
         { true : ; set [ add $type-span.title [ add ' · ' $c-desc ] ] type-span.title }
        ]
       )
       ; to resizer-el !document.createElement div
       ; assign $resizer-el { className lane-data-col-resizer } { title 'Drag to resize column (double-click to reset)' } { hidden $is-ro }
       !resizer-el.setAttribute role separator
       !resizer-el.setAttribute aria-orientation vertical
       !resizer-el.addEventListener mousedown (
        ; condition { propertyIs false is-ro } (
         ; to { ev } $argv
         [ match
          { $ev.preventDefault : !ev.preventDefault }
         ]
         [ match
          { $ev.stopPropagation : !ev.stopPropagation }
         ]
         ; to start-x [ match
          { [ propertyIs undefined ev.clientX ] : 0 }
          { [ propertyIs null ev.clientX ] : 0 }
          { true : $ev.clientX }
         ]
         ; to saved-w !normalizeColumnWidth $col.width
         ; to measured [ match
          { $saved-w : $saved-w }
          { $th.getBoundingClientRect (
           ; to rect !th.getBoundingClientRect
           !window.Math.round $rect.width
          ) }
          { [ propertyIsGreaterThan 0 th.offsetWidth ] : $th.offsetWidth }
          { true : 120 }
         ]
         ; to drag ; object { start-x $start-x } { start-w $measured } { moved false }
         ; set 'lane-data-col-resizer lane-data-col-resizer--active' resizer-el.className
         ; to on-move (
          ; to { mev } $argv
          ; to cur-x [ match
           { [ propertyIs undefined mev.clientX ] : $drag.start-x }
           { [ propertyIs null mev.clientX ] : $drag.start-x }
           { true : $mev.clientX }
          ]
          ; to delta ; subtract $cur-x $drag.start-x
          ; to raw-next ; add $drag.start-w $delta
          ; to safe-next [ match
           { [ propertyIsLessThan 1 raw-next ] : 1 }
           { true : $raw-next }
          ]
          ; to next-w !normalizeColumnWidth $safe-next
          [ match
           { $next-w (
            ; set true drag.moved
            ; set $next-w col.width
            !view.apply-column-width $col-idx $next-w
           ) }
          ]
         )
         ; to on-up (
          ; set lane-data-col-resizer resizer-el.className
          [ match
           { $window.removeEventListener (
            !window.removeEventListener mousemove $on-move
            !window.removeEventListener mouseup $on-up
           ) }
          ]
          [ match
           { $drag.moved : !view.save-schema $tbl }
          ]
         )
         !window.addEventListener mousemove $on-move
         !window.addEventListener mouseup $on-up
        )
       )
       !resizer-el.addEventListener dblclick (
        ; condition { propertyIs false is-ro } (
         [ match
          { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col width }
          { true : ; set undefined col.width }
         ]
         !view.apply-column-width $col-idx null
         !view.save-schema $tbl
        )
       )
       !th-inner.appendChild $name-span
       !th-inner.appendChild $type-span
       !th.appendChild $th-inner
       !th.appendChild $resizer-el
       !grid-hrow.appendChild $th
       !view.grid-head-cells.push ; object { kind col } { col $col } { el $th } { name-el $name-span } { type-el $type-span } { resizer-el $resizer-el }
      )

      ; to act-th !document.createElement th
      ; assign $act-th { className 'lane-data-th lane-data-th--actions' } { textContent '' }
      !grid-hrow.appendChild $act-th
      !view.grid-head-cells.push ; object { kind actions } { el $act-th }

      [ match
       { $has-visible-subtables (
        ; to f-subtoggle-th !document.createElement th
        ; assign $f-subtoggle-th { className 'lane-data-th lane-data-th--subtoggle lane-data-filter-th lane-data-filter-th--subtoggle' } { textContent '' }
        !grid-frow.appendChild $f-subtoggle-th
        !view.grid-filter-cells.push ; object { kind subtoggle } { el $f-subtoggle-th }
       ) }
      ]
      ; to f-num-th !document.createElement th
      ; assign $f-num-th { className 'lane-data-th lane-data-th--num lane-data-filter-th lane-data-filter-th--funnel' } { innerHTML $funnel-svg } { title 'Column filters' }
      !f-num-th.setAttribute aria-label Filters
      !grid-frow.appendChild $f-num-th
      !view.grid-filter-cells.push ; object { kind num } { el $f-num-th }

      ; each $tbl.columns (
       ; to { fcol } $argv
       ; to f-th !document.createElement th
       ; set 'lane-data-th lane-data-filter-th' f-th.className
       ; to f-cell-wrap !document.createElement div
       ; set lane-data-filter-cell f-cell-wrap.className
       ; to chips {}
       ; each $st.workingFilters (
        ; to { flt } $argv
        ; condition { propertyIs $fcol.id flt.columnId } (
         ; to chip-el !document.createElement span
         ; set lane-data-filter-chip chip-el.className
         ; to bubble-btn !document.createElement button
         ; to bubble-label !view.format-bubble-text $tbl $fcol $flt
         ; assign $bubble-btn { type button } { className lane-data-filter-bubble } { textContent $bubble-label } { title 'Edit filter' }
         !bubble-btn.addEventListener click (
          ; to { ev } $argv
          [ match { $ev.stopPropagation : !ev.stopPropagation } ]
          !view.open-filter-menu $tbl $fcol $flt $bubble-btn
         )
         ; to rm-flt-btn !document.createElement button
         ; assign $rm-flt-btn { type button } { className lane-data-filter-remove } { textContent '×' } { title 'Remove filter' }
         !rm-flt-btn.setAttribute aria-label 'Remove filter'
         !rm-flt-btn.addEventListener click (
          ; to { ev } $argv
          [ match { $ev.stopPropagation : !ev.stopPropagation } ]
          !view.delete-filter-by-id $tbl $flt.id
         )
         !chip-el.appendChild $bubble-btn
         !chip-el.appendChild $rm-flt-btn
         !f-cell-wrap.appendChild $chip-el
         !chips.push ; object { flt $flt } { el $chip-el } { label-el $bubble-btn } { remove-el $rm-flt-btn }
        )
       )
       ; to add-flt-btn !document.createElement button
       ; assign $add-flt-btn { type button } { className lane-data-filter-add-btn } { textContent '+' } { title 'Add filter' }
       !add-flt-btn.setAttribute aria-label 'Add filter'
       !add-flt-btn.addEventListener click (
        ; to { ev } $argv
        [ match { $ev.stopPropagation : !ev.stopPropagation } ]
        !view.open-filter-menu $tbl $fcol null $add-flt-btn
       )
       !f-cell-wrap.appendChild $add-flt-btn
       !f-th.appendChild $f-cell-wrap
       !grid-frow.appendChild $f-th
       !view.grid-filter-cells.push ; object { kind col } { col $fcol } { el $f-th } { wrap-el $f-cell-wrap } { add-btn $add-flt-btn } { chips $chips }
      )

      ; to f-act-th !document.createElement th
      ; assign $f-act-th { className 'lane-data-th lane-data-th--actions lane-data-filter-th lane-data-filter-th--actions' } { textContent '' }
      !grid-frow.appendChild $f-act-th
      !view.grid-filter-cells.push ; object { kind actions } { el $f-act-th }

      ; to span-col-count ; add $col-count 1
      ; each $filtered.matchedEntries (
       ; to { entry } $argv
       ; to row $entry.row
       ; to row-idx $entry.rowIndex
       ; to row-num $entry.rowNumber
       ; to tr !document.createElement tr
       ; set lane-data-row tr.className
       ; to subtoggle-td [ match
        { $has-visible-subtables (
         ; to st-td !document.createElement td
         ; set 'lane-data-td lane-data-td--subtoggle' st-td.className
         !tr.appendChild $st-td
         $st-td
        ) }
        { true : null }
       ]
       ; to num-td !document.createElement td
       ; assign $num-td { className 'lane-data-td lane-data-td--num' } { textContent $row-num }
       !tr.appendChild $num-td

       ; to cells !view.build-row-cells $tbl $row $row-idx $tr null

       ; to act-td !document.createElement td
       ; set 'lane-data-td lane-data-td--actions' act-td.className
       ; to rm-row-btn !document.createElement button
       ; assign $rm-row-btn { type button } { className lane-data-row-remove } { textContent '×' } { title 'Delete row' } { hidden $is-ro } { disabled $is-ro }
       !rm-row-btn.addEventListener click : !view.request-delete-row $tbl $row-idx
       !act-td.appendChild $rm-row-btn
       !tr.appendChild $act-td

       !grid-tbody.appendChild $tr

       ; to subtable-groups {}
       [ match
        { $has-visible-subtables (
         ; each $visible-subtables (
          ; to { sub-spec } $argv
          ; to matched-entries [ match
           { $getInboundSubtableRowsForParent : !getInboundSubtableRowsForParent $sub-spec $row $view.tables }
           { true : {} }
          ]
          ; condition { propertyIsGreaterThan 0 matched-entries.length } (
           ; to sub-tbl $sub-spec.table
           ; to sub-id $sub-spec.tableId
           ; to sub-display-cols [ match
            { [ !window.Array.isArray $sub-spec.displayColumns ] : $sub-spec.displayColumns }
            { true : $sub-tbl.columns }
           ]
           ; to is-collapsed !view.is-subtable-group-collapsed $tbl.id $row.id $sub-id
           ; to sub-tr !document.createElement tr
           ; to sub-tr-cls [ ternary $is-collapsed 'lane-data-subtable-row lane-data-subtable-row--collapsed' lane-data-subtable-row ]
           ; set $sub-tr-cls sub-tr.className
           !sub-tr.setAttribute data-parent-row-id $row.id
           !sub-tr.setAttribute data-subtable-id $sub-id

           ; to indent-td !document.createElement td
           ; set 'lane-data-td lane-data-td--subtoggle lane-data-td--subtable-indent' indent-td.className
           !sub-tr.appendChild $indent-td

           ; to caret-td !document.createElement td
           ; set 'lane-data-td lane-data-td--num lane-data-td--subtable-caret' caret-td.className
           ; to caret-btn !document.createElement button
           ; to caret-cls [ ternary $is-collapsed 'lane-data-subtable-caret lane-data-subtable-caret--collapsed' lane-data-subtable-caret ]
           ; to caret-ttl ; add [ ternary $is-collapsed 'Expand ' 'Collapse ' ] ; add $sub-spec.tableName ' linked records'
           ; assign $caret-btn { type button } { className $caret-cls } { textContent [ ternary $is-collapsed '▸' '▾' ] } { title $caret-ttl }
           !caret-btn.setAttribute aria-expanded [ ternary $is-collapsed 'false' 'true' ]
           !caret-btn.setAttribute aria-label $caret-ttl
           !caret-td.appendChild $caret-btn
           !sub-tr.appendChild $caret-td

           ; to content-td !document.createElement td
           ; set 'lane-data-td lane-data-td--subtable-content' content-td.className
           !content-td.setAttribute colspan [ ; add '' $span-col-count ]
           ; to group-box !document.createElement div
           ; set lane-data-subtable-group group-box.className

           ; to group-hdr !document.createElement div
           ; set lane-data-subtable-group-header group-hdr.className
           ; to group-title-btn !document.createElement button
           ; assign $group-title-btn { type button } { className lane-data-subtable-group-title } { textContent $sub-spec.tableName } { title [ ; add 'Switch to ' ; add $sub-spec.tableName ' table' ] }
           !group-title-btn.addEventListener click : !view.select-table $sub-id
           ; to group-count-el !document.createElement span
           ; assign $group-count-el { className lane-data-subtable-group-count } { textContent $matched-entries.length }
           ; to via-col-names {}
           ; each $sub-spec.links (
            ; to { lnk } $argv
            !via-col-names.push [ ; add $lnk.sourceColumnName ; add ' → ' $lnk.targetColumnName ]
           )
           ; to group-via-el !document.createElement span
           ; assign $group-via-el { className lane-data-subtable-group-via } { textContent [ !via-col-names.join ', ' ] }
           !group-hdr.appendChild $group-title-btn
           !group-hdr.appendChild $group-count-el
           !group-hdr.appendChild $group-via-el

           ; to group-body !document.createElement div
           ; assign $group-body { className lane-data-subtable-group-body } { hidden $is-collapsed }

           ; to sub-grid !document.createElement table
           ; set 'lane-data-grid lane-data-subtable-grid' sub-grid.className
           ; to sub-thead !document.createElement thead
           ; to sub-hrow !document.createElement tr
           ; to sub-num-th !document.createElement th
           ; assign $sub-num-th { className 'lane-data-th lane-data-th--num' } { textContent '#' }
           !sub-hrow.appendChild $sub-num-th
           ; each $sub-display-cols (
            ; to { scol } $argv
            ; to sth !document.createElement th
            ; to sw !normalizeColumnWidth $scol.width
            ; to s-has-w [ match { $sw : true } { true : false } ]
            ; set [ ternary $s-has-w 'lane-data-th lane-data-th--sized' lane-data-th ] sth.className
            [ match
             { $sw (
              ; to spx ; add $sw px
              ; assign sth.style { width $spx } { minWidth $spx } { maxWidth $spx }
             ) }
            ]
            ; to sth-inner !document.createElement div
            ; set lane-data-th-inner sth-inner.className
            ; to sname-span !document.createElement span
            ; assign $sname-span { className lane-data-th-name } { textContent !view.display-col-name $scol }
            ; to stype-span !document.createElement span
            ; assign $stype-span { className lane-data-th-type } { textContent !formatColumnType $scol undefined undefined $view.tables }
            !sth-inner.appendChild $sname-span
            !sth-inner.appendChild $stype-span
            !sth.appendChild $sth-inner
            !sub-hrow.appendChild $sth
           )
           ; to sub-act-th !document.createElement th
           ; assign $sub-act-th { className 'lane-data-th lane-data-th--actions' } { textContent '' }
           !sub-hrow.appendChild $sub-act-th
           !sub-thead.appendChild $sub-hrow

           ; to sub-tbody !document.createElement tbody
           ; set lane-data-subtable-tbody sub-tbody.className
           ; to sub-rows {}
           ; each $matched-entries (
            ; to { m-entry } $argv
            ; to s-row $m-entry.row
            ; to s-idx $m-entry.rowIndex
            ; to s-num $m-entry.rowNumber
            ; to s-tr !document.createElement tr
            ; set 'lane-data-row lane-data-subtable-data-row' s-tr.className
            ; to s-num-td !document.createElement td
            ; assign $s-num-td { className 'lane-data-td lane-data-td--num' } { textContent $s-num }
            !s-tr.appendChild $s-num-td

            ; to s-cells !view.build-row-cells $sub-tbl $s-row $s-idx $s-tr null $sub-display-cols

            ; to s-act-td !document.createElement td
            ; set 'lane-data-td lane-data-td--actions' s-act-td.className
            ; to sub-ro !view.is-readonly-table $sub-tbl
            ; to s-rm-btn !document.createElement button
            ; assign $s-rm-btn { type button } { className lane-data-row-remove } { textContent '×' } { title 'Delete row' } { hidden $sub-ro } { disabled $sub-ro }
            !s-rm-btn.addEventListener click : !view.request-delete-row $sub-tbl $s-idx
            !s-act-td.appendChild $s-rm-btn
            !s-tr.appendChild $s-act-td

            !sub-tbody.appendChild $s-tr
            !sub-rows.push [ object
             { row $s-row }
             { el $s-tr }
             { num-el $s-num-td }
             { cells $s-cells }
             { remove-btn $s-rm-btn }
             { index $s-idx }
             { row-number $s-num }
            ]
           )

           !sub-grid.appendChild $sub-thead
           !sub-grid.appendChild $sub-tbody
           !group-body.appendChild $sub-grid
           !group-box.appendChild $group-hdr
           !group-box.appendChild $group-body
           !content-td.appendChild $group-box
           !sub-tr.appendChild $content-td
           !grid-tbody.appendChild $sub-tr

           ; to grp-rec [ object
            { subtable-id $sub-id }
            { table $sub-tbl }
            { table-name $sub-spec.tableName }
            { display-columns $sub-display-cols }
            { parent-row $row }
            { collapsed $is-collapsed }
            { el $sub-tr }
            { indent-td $indent-td }
            { caret-td $caret-td }
            { caret-btn $caret-btn }
            { content-td $content-td }
            { group-box $group-box }
            { header-el $group-hdr }
            { title-btn $group-title-btn }
            { count-el $group-count-el }
            { via-el $group-via-el }
            { body-el $group-body }
            { grid-el $sub-grid }
            { rows $sub-rows }
           ]
           !caret-btn.addEventListener click (
            ; to next-col !view.toggle-subtable-group-collapsed $tbl.id $row.id $sub-id
            ; set $next-col grp-rec.collapsed
            ; set $next-col group-body.hidden
            ; to next-tr-cls [ ternary $next-col 'lane-data-subtable-row lane-data-subtable-row--collapsed' lane-data-subtable-row ]
            ; set $next-tr-cls sub-tr.className
            ; to next-c-cls [ ternary $next-col 'lane-data-subtable-caret lane-data-subtable-caret--collapsed' lane-data-subtable-caret ]
            ; to next-c-ttl ; add [ ternary $next-col 'Expand ' 'Collapse ' ] ; add $sub-spec.tableName ' linked records'
            ; assign $caret-btn { className $next-c-cls } { textContent [ ternary $next-col '▸' '▾' ] } { title $next-c-ttl }
            !caret-btn.setAttribute aria-expanded [ ternary $next-col 'false' 'true' ]
            !caret-btn.setAttribute aria-label $next-c-ttl
           )
           !subtable-groups.push $grp-rec
          )
         )
        ) }
       ]

       !view.grid-rows.push ; object { row $row } { el $tr } { subtoggle-el $subtoggle-td } { num-el $num-td } { cells $cells } { remove-btn $rm-row-btn } { index $row-idx } { subtable-groups $subtable-groups }
      )

      ; each $tbl.columns (
       ; to { col col-idx } $argv
       ; to saved-w !normalizeColumnWidth $col.width
       [ match
        { $saved-w : !view.apply-column-width $col-idx $saved-w }
       ]
      )

      ; to has-filtered-rows [ propertyIsGreaterThan 0 filtered.matchedCount ]
      ; to no-matches [ ternary [ and { $has-rows } { [ propertyIs false has-filtered-rows ] } ] true false ]
      ; set $has-filtered-rows rows-empty-el.hidden
      ; set [ match
       { [ propertyIs true tbl.remote.accessDenied ] : 'Owner lane package is locked.' }
       { [ propertyIs true tbl.remote.missing ] : 'Owner table was deleted.' }
       { $no-matches : 'No rows match the active filters.' }
       { $is-ro : 'No rows in remote table.' }
       { true : 'No rows yet. Click + Row to add data.' }
      ] rows-empty-el.textContent
     ) }
     { true (
      ; set false rows-empty-el.hidden
      ; set [ match
       { [ propertyIs true tbl.remote.accessDenied ] : 'Owner lane package is locked.' }
       { [ propertyIs true tbl.remote.missing ] : 'Owner table was deleted.' }
       { $is-ro : 'Remote table has no columns.' }
       { true : 'Add at least one column to start entering rows.' }
      ] rows-empty-el.textContent
     ) }
    ]
   ) }
  ]
 )

 ; to view.apply-column-change (
  -- Applies a confirmed column type/multiplicity/decimals/row-link change and coerces existing row values
  ; to { tbl col next-type next-multiple next-decimals } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; condition { propertyIs false is-ro } (
   ; to from-spec !parseColumnType $col
   ; to next-spec !parseColumnType $next-type $next-multiple $next-decimals
   ; set $next-spec.type col.type
   ; set $next-spec.multiple col.multiple
   [ match
    { [ propertyIs fixed next-spec.type ] : ; set $next-spec.decimals col.decimals }
    { true (
     [ match
      { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col decimals }
      { true : ; set undefined col.decimals }
     ]
    ) }
   ]
   [ match
    { [ propertyIs row next-spec.type ] (
     ; set $next-spec.refTableId col.refTableId
     ; set $next-spec.refColumnId col.refColumnId
     ; set $next-spec.refDisplayColumnId col.refDisplayColumnId
     [ match
      { $next-spec.refFilterColumnId : ; set $next-spec.refFilterColumnId col.refFilterColumnId }
      { true (
       [ match
        { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col refFilterColumnId }
        { true : ; set undefined col.refFilterColumnId }
       ]
      ) }
     ]
     [ match
      { $next-spec.filterByColumnId : ; set $next-spec.filterByColumnId col.filterByColumnId }
      { true (
       [ match
        { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col filterByColumnId }
        { true : ; set undefined col.filterByColumnId }
       ]
      ) }
     ]
    ) }
    { true (
     [ match
      { $window.Reflect.deleteProperty (
       !window.Reflect.deleteProperty $col refTableId
       !window.Reflect.deleteProperty $col refColumnId
       !window.Reflect.deleteProperty $col refDisplayColumnId
       !window.Reflect.deleteProperty $col refDisplayTemplate
       !window.Reflect.deleteProperty $col refFilterColumnId
       !window.Reflect.deleteProperty $col filterByColumnId
      ) }
      { true (
       ; set undefined col.refTableId
       ; set undefined col.refColumnId
       ; set undefined col.refDisplayColumnId
       ; set undefined col.refDisplayTemplate
       ; set undefined col.refFilterColumnId
       ; set undefined col.filterByColumnId
      ) }
     ]
    ) }
   ]
   ; to preserved-constraints [ match
    { [ propertyIs $from-spec.type next-spec.type ] : $next-spec.constraints }
    { $next-spec.constraints (
     ; to filtered-c {}
     ; each $next-spec.constraints (
      ; to { nc } $argv
      [ match
       { [ propertyIs workflow nc.type ] : null }
       { true : !filtered-c.push $nc }
      ]
     )
     $filtered-c
    ) }
    { true : {} }
   ]
   !view.set-col-constraints $col $preserved-constraints
   ; each $tbl.rows (
    ; to { row } $argv
    ; to cur [ get row.values $col.id ]
    ; to coerced !coerceDataValue $cur $next-spec $next-spec.multiple $from-spec $view.tables
    ; to row.values $col.id $coerced
   )
   [ match
    { [ and { [ propertyIs lane col.type ] } { $lane-control.load-catalog } ] : !lane-control.load-catalog }
   ]
   !view.sanitize-views-for-table $tbl true
   !view.sync-view-ui
   !view.render-schema
   !view.render-grid
   !view.save-schema-and-rows $tbl
  )
 )

 ; to view.request-column-change (
  -- Validates column type/multiple/decimals/row-link change and confirms when existing row data would be altered or truncated
  ; to { tbl col next-type next-multiple next-decimals on-revert } $argv
  ; to is-ro !view.is-readonly-table $tbl
  [ match
   { $is-ro (
    [ match
     { $on-revert : !$on-revert }
    ]
   ) }
   { true (
    ; to impact !checkColumnChangeImpact $tbl $col.id $next-type $next-multiple $next-decimals $view.tables
    [ match
     { $impact.destructive (
      ; to col-label !view.display-col-name $col
      ; to prev-fmt !formatColumnType $col undefined undefined $view.tables
      ; to next-fmt !formatColumnType $next-type $next-multiple $next-decimals $view.tables
      ; to msg ; add 'Change column "' ; add $col-label ; add '" from ' ; add $prev-fmt ; add ' to ' ; add $next-fmt ; add '? ' $impact.reason
      ; to opts [ object
       { title 'Change Column Type' }
       { message $msg }
       { confirm-label 'Apply change' }
       { on-confirm : !view.apply-column-change $tbl $col $next-type $next-multiple $next-decimals }
       { on-cancel (
        [ match
         { $on-revert : !$on-revert }
        ]
       ) }
      ]
      !view.confirm $opts
     ) }
     { true : !view.apply-column-change $tbl $col $next-type $next-multiple $next-decimals }
    ]
   ) }
  ]
 )

 ; to view.request-delete-column (
  -- Prompts for confirmation before deleting a schema column and stripping its data from all rows
  ; to { tbl col-idx } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; condition { propertyIs false is-ro } (
   ; to col [ get tbl.columns $col-idx ]
   [ match
    { $col (
     ; to col-label !view.display-col-name $col
     ; to fmt-type !formatColumnType $col undefined undefined $view.tables
     ; to row-count $tbl.rows.length
     ; to row-note [ match
      { [ propertyIs 1 row-count ] : ' This will permanently delete its value from 1 row.' }
      { [ propertyIsGreaterThan 1 row-count ] : ; add ' This will permanently delete its values from all ' ; add $row-count ' rows.' }
      { true : ' This will remove the column from the table schema.' }
     ]
     ; to msg ; add 'Delete column "' ; add $col-label ; add '" (' ; add $fmt-type ; add ')?' $row-note
     ; to opts [ object
      { title 'Delete Column' }
      { message $msg }
      { confirm-label 'Delete column' }
      { on-confirm (
       !tbl.columns.splice $col-idx 1
       ; each $tbl.rows (
        ; to { row } $argv
        ; to next-vals ; object
        ; each $tbl.columns (
         ; to { keep-col } $argv
         ; to keep-val [ get row.values $keep-col.id ]
         ; to next-vals $keep-col.id $keep-val
        )
        ; set $next-vals row.values
       )
       !view.sanitize-views-for-table $tbl true
       !view.sync-view-ui
       !view.render-schema
       !view.render-grid
       !view.save-schema-and-rows $tbl
      ) }
     ]
     !view.confirm $opts
    ) }
   ]
  )
 )

 ; to view.request-delete-row (
  -- Prompts for confirmation before deleting a row from the active table
  ; to { tbl row-idx } $argv
  ; to is-ro !view.is-readonly-table $tbl
  ; condition { propertyIs false is-ro } (
   ; to row-num ; add $row-idx 1
   ; to tbl-idx !view.tables.indexOf $tbl
   ; to tbl-label !view.display-table-name $tbl $tbl-idx
   ; to msg ; add 'Delete row #' ; add $row-num ; add ' from "' ; add $tbl-label '"?'
   ; to opts [ object
    { title 'Delete Row' }
    { message $msg }
    { confirm-label 'Delete row' }
    { on-confirm (
     ; to removed [ get tbl.rows $row-idx ]
     !tbl.rows.splice $row-idx 1
     [ match
      { $removed : !view.unpin-row-id $tbl.id $removed.id }
     ]
     !view.render-grid
     !view.update-table-tabs-text
     ; to row-ids !collect-ids $tbl.rows
     [ match
      { $removed : !deleteTableRow $data $view.lane.data $view.lane.id $tbl $removed.id $row-ids }
      { true : !view.save-schema-and-rows $tbl }
     ]
     !view.notify-record-change $tbl $removed delete-row
    ) }
   ]
   !view.confirm $opts
  )
 )

 ; to view.request-clear-rows (
  -- Prompts for confirmation with explicit checkbox agreement before clearing all rows from the active table
  !view.close-table-menu
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to is-ro !view.is-readonly-table $tbl
    ; condition { propertyIs false is-ro } (
     ; to row-count $tbl.rows.length
     ; to col-count $tbl.columns.length
     ; to tbl-idx !view.tables.indexOf $tbl
     ; to tbl-label !view.display-table-name $tbl $tbl-idx
     ; to row-phrase [ match
      { [ propertyIs 1 row-count ] : '1 row' }
      { [ propertyIsGreaterThan 1 row-count ] : ; add 'all ' ; add $row-count ' rows' }
      { true : ; add $row-count ' rows' }
     ]
     ; to col-keep-msg [ match
      { [ propertyIs 0 col-count ] : 'The table schema will be kept.' }
      { [ propertyIs 1 col-count ] : 'The table column will be kept.' }
      { true : 'The table columns will be kept.' }
     ]
     ; to msg ; add 'Delete ' ; add $row-phrase ; add ' from "' ; add $tbl-label ; add '"? This action cannot be undone. ' $col-keep-msg
     ; to agree-msg ; add 'I understand and agree to permanently delete ' ; add $row-phrase ; add ' from "' ; add $tbl-label '".'
     ; to opts [ object
      { title 'Clear Rows' }
      { message $msg }
      { require-agreement true }
      { agreement-label $agree-msg }
      { confirm-label 'Clear rows' }
      { on-confirm (
       ; to removed-ids !collect-ids $tbl.rows
       ; set 0 tbl.rows.length
       !view.clear-pinned-rows $tbl.id
       !view.render-grid
       !view.update-table-tabs-text
       !clearTableRows $data $view.lane.data $view.lane.id $tbl $removed-ids
       !view.notify-record-change $tbl null clear-rows
      ) }
     ]
     !view.confirm $opts
    )
   ) }
  ]
 )

 ; to view.request-delete-table (
  -- Prompts for confirmation before unlinking an imported table or deleting a local table
  !view.close-table-menu
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to tbl-idx !view.tables.indexOf $tbl
    ; to tbl-label !view.display-table-name $tbl $tbl-idx
    ; to is-rem !view.is-remote-table $tbl
    ; to on-confirm-remove (
     ; to removed-name $tbl.name
     ; to removed-tid $tbl.id
     !edit-table-modal.close
     !view.close-view-menu
     !view.close-filter-menu
     !view.clear-pinned-rows $removed-tid
     [ match
      { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $view.table-views $removed-tid }
      { true : ; to view.table-views $removed-tid undefined }
     ]
     ; to cur-idx !view.tables.indexOf $tbl
     ; condition { propertyIsGreaterThanOrEqual 0 cur-idx } : !view.tables.splice $cur-idx 1
     ; to next-tbl [ match
      { [ propertyIsGreaterThan 0 view.tables.length ] (
       ; to clamp-idx [ match
        { [ propertyIsLessThan $view.tables.length cur-idx ] : $cur-idx }
        { true : ; subtract $view.tables.length 1 }
       ]
       [ get view.tables $clamp-idx ]
      ) }
      { true : null }
     ]
     ; set [ match { $next-tbl : $next-tbl.id } { true : '' } ] view.active-table-id
     ; set [ match { $next-tbl : $next-tbl.name } { true : '' } ] lane.subroute
     ; set [ !view.default-schema-open $next-tbl ] view.schema-open
     !view.sync-notebook-table-scope $removed-name
     !view.render
     [ match
      { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
     ]
     ; try (
      ; to table-ids !collect-ids $view.tables
      !deleteLaneTable $data $view.lane.data $view.lane.id $tbl $table-ids
      !view.sync-data-path
      [ match
       { $lane-control.update-url : !lane-control.update-url }
      ]
     ) : null
     [ match
      { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
     ]
    )
    [ match
     { $is-rem (
      ; to r-info !view.remote-origin-info $tbl
      ; to owner-label [ match { $r-info.lane-label : $r-info.lane-label } { true : $tbl.remote.laneId } ]
      ; to msg ; add 'Remove imported remote table "' ; add $tbl-label ; add '" from this lane? The original table in "' ; add $owner-label '" will not be deleted.'
      ; to opts [ object
       { title 'Remove Imported Table' }
       { message $msg }
       { require-agreement false }
       { confirm-label 'Remove import' }
       { on-confirm $on-confirm-remove }
      ]
      !view.confirm $opts
     ) }
     { true (
      ; to col-count $tbl.columns.length
      ; to row-count $tbl.rows.length
      ; to col-unit [ ternary [ propertyIs 1 col-count ] column columns ]
      ; to row-unit [ ternary [ propertyIs 1 row-count ] row rows ]
      ; to msg ; add 'Delete table "' ; add $tbl-label ; add '"? This will permanently remove its ' ; add $col-count ; add ' ' ; add $col-unit ; add ' and ' ; add $row-count ; add ' ' ; add $row-unit '. This action cannot be undone.'
      ; to agree-msg ; add 'I understand and agree to permanently delete table "' ; add $tbl-label ; add '" (' ; add $col-count ; add ' ' ; add $col-unit ; add ', ' ; add $row-count ; add ' ' ; add $row-unit ').'
      ; to opts [ object
       { title 'Delete Table' }
       { message $msg }
       { require-agreement true }
       { agreement-label $agree-msg }
       { confirm-label 'Delete table' }
       { on-confirm $on-confirm-remove }
      ]
      !view.confirm $opts
     ) }
    ]
   ) }
  ]
 )

 ; to view.render-schema (
  -- Renders the schema columns editor for the active table
  ; while { propertyIsGreaterThan 0 view.schema-rows.length } (
   ; to old !view.schema-rows.pop
   !old.el.remove
  )
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to is-ro !view.is-readonly-table $tbl
    ; to is-rem !view.is-remote-table $tbl
    ; to col-count $tbl.columns.length
    ; to arrow [ ternary $view.schema-open '▾' '▸' ]
    ; set [ add 'Schema (' ; add $col-count ; add ') ' $arrow ] schema-toggle-btn.textContent
    ; set [ ternary $view.schema-open false true ] schema-section.hidden
    ; to has-cols [ propertyIsGreaterThan 0 col-count ]
    ; set $has-cols schema-empty-el.hidden
    ; set [ match
     { [ propertyIs true tbl.remote.accessDenied ] : 'Owner lane package is locked.' }
     { [ propertyIs true tbl.remote.missing ] : 'Owner table was deleted.' }
     { $is-ro : 'Remote table has no columns defined.' }
     { true : 'No columns defined.' }
    ] schema-empty-el.textContent
    ; set $is-ro add-col-btn.hidden
    ; set $is-ro add-col-btn.disabled

    ; each $tbl.columns (
     ; to { col col-idx } $argv
     ; to tr !document.createElement tr
     ; set lane-data-schema-row tr.className

     ; to name-td !document.createElement td
     ; set lane-input-cell name-td.className
     ; to name-el !document.createElement input
     ; assign $name-el { type text } { className lane-input-name } { value $col.name } { placeholder column } { spellcheck false } { autocomplete off } { disabled $is-ro } { readOnly $is-ro }
     !name-td.appendChild $name-el

     ; to type-td !document.createElement td
     ; set lane-input-cell type-td.className
     ; to type-wrap !document.createElement div
     ; set lane-data-type-wrap type-wrap.className
     ; to type-el !document.createElement select
     ; assign $type-el { className lane-input-type } { disabled $is-ro }
     ; each $dataColumnTypes (
      ; to { type-name } $argv
      ; to opt !document.createElement option
      ; assign $opt { value $type-name } { textContent $type-name }
      !type-el.appendChild $opt
     )
     ; set $col.type type-el.value
     ; to is-fixed [ propertyIs fixed col.type ]
     ; to dec-val !normalizeFixedDecimals $col.decimals
     ; to decimals-wrap !document.createElement label
     ; assign $decimals-wrap { className lane-data-decimals-wrap } { hidden [ ternary $is-fixed false true ] } { title 'Decimal places (0–12)' }
     ; to decimals-label !document.createElement span
     ; assign $decimals-label { className lane-data-decimals-label } { textContent dp }
     ; to decimals-el !document.createElement input
     ; assign $decimals-el { type text } { className lane-data-decimals-input } { value [ add '' $dec-val ] } { title 'Decimal places (0–12)' } { spellcheck false } { autocomplete off } { disabled $is-ro } { readOnly $is-ro }
     !decimals-el.setAttribute inputmode numeric
     !decimals-el.setAttribute data-num-type integer
     !decimals-el.setAttribute aria-invalid 'false'
     !decimals-wrap.appendChild $decimals-label
     !decimals-wrap.appendChild $decimals-el

     ; to supported-constraints [ match
      { $getSupportedColumnConstraints : !getSupportedColumnConstraints $col.type }
      { true : {} }
     ]
     ; to cur-constraints [ match
      { $normalizeColumnConstraints : !normalizeColumnConstraints $col $col.type $col.decimals }
      { true : {} }
     ]
     ; to used-ctypes ; object
     ; each $cur-constraints (
      ; to { cc } $argv
      ; to used-ctypes $cc.type true
     )
     ; to remaining-constraints {}
     ; each $supported-constraints (
      ; to { sc } $argv
      ; to is-used [ match { [ get used-ctypes $sc.type ] : true } { true : false } ]
      ; condition { propertyIs false is-used } : !remaining-constraints.push $sc
     )
     ; to has-constraints [ propertyIsGreaterThan 0 cur-constraints.length ]
     ; to show-add-constraint [ match
      { $is-ro : false }
      { [ propertyIsGreaterThan 0 remaining-constraints.length ] : true }
      { true : false }
     ]
     ; to constraint-add-el !document.createElement select
     ; assign $constraint-add-el { className 'lane-input-type lane-data-constraint-add' } { hidden [ ternary $show-add-constraint false true ] } { disabled $is-ro } { title 'Add column constraint' }
     ; to constraint-add-placeholder !document.createElement option
     ; assign $constraint-add-placeholder { value '' } { textContent '+ constraint' }
     !constraint-add-el.appendChild $constraint-add-placeholder
     ; each $remaining-constraints (
      ; to { sc } $argv
      ; to opt-sc !document.createElement option
      ; assign $opt-sc { value $sc.type } { textContent $sc.label }
      !constraint-add-el.appendChild $opt-sc
     )
     ; set '' constraint-add-el.value

     !type-wrap.appendChild $type-el
     !type-wrap.appendChild $decimals-wrap
     !type-wrap.appendChild $constraint-add-el
     !type-td.appendChild $type-wrap

     ; to is-row [ propertyIs row col.type ]
     ; to row-config-wrap !document.createElement div
     ; assign $row-config-wrap { className lane-data-row-config } { hidden [ ternary $is-row false true ] }

     ; to ref-table-field !document.createElement label
     ; set lane-data-row-field ref-table-field.className
     ; to ref-table-label !document.createElement span
     ; assign $ref-table-label { className lane-data-row-label } { textContent Table }
     ; to ref-table-el !document.createElement select
     ; set 'lane-input-type lane-data-row-select' ref-table-el.className
     ; to ref-table-empty !document.createElement option
     ; assign $ref-table-empty { value '' } { textContent 'Select table…' }
     !ref-table-el.appendChild $ref-table-empty
     !ref-table-field.appendChild $ref-table-label
     !ref-table-field.appendChild $ref-table-el

     ; to ref-col-field !document.createElement label
     ; set lane-data-row-field ref-col-field.className
     ; to ref-col-label !document.createElement span
     ; assign $ref-col-label { className lane-data-row-label } { textContent Column }
     ; to ref-col-el !document.createElement select
     ; set 'lane-input-type lane-data-row-select' ref-col-el.className
     ; to ref-col-empty !document.createElement option
     ; assign $ref-col-empty { value '' } { textContent 'Select column…' }
     !ref-col-el.appendChild $ref-col-empty
     !ref-col-field.appendChild $ref-col-label
     !ref-col-field.appendChild $ref-col-el

     ; to ref-disp-field !document.createElement label
     ; set lane-data-row-field ref-disp-field.className
     ; to ref-disp-label !document.createElement span
     ; assign $ref-disp-label { className lane-data-row-label } { textContent Display }
     ; to ref-display-el !document.createElement select
     ; set 'lane-input-type lane-data-row-select' ref-display-el.className
     ; to ref-disp-empty !document.createElement option
     ; assign $ref-disp-empty { value '' } { textContent 'None (optional)' }
     !ref-display-el.appendChild $ref-disp-empty
     !ref-disp-field.appendChild $ref-disp-label
     !ref-disp-field.appendChild $ref-display-el

     ; to ref-tmpl-field !document.createElement label
     ; set 'lane-data-row-field lane-data-row-field--template' ref-tmpl-field.className
     ; to ref-tmpl-label !document.createElement span
     ; assign $ref-tmpl-label { className lane-data-row-label } { textContent Template }
     ; to ref-tmpl-el !document.createElement input
     ; assign $ref-tmpl-el { type text } { className 'lane-input-type lane-data-row-template' } { placeholder '; add $family \' \' $version' } { spellcheck false } { autocomplete off } { disabled $is-ro } { readOnly $is-ro }
     ; to ref-tmpl-tools !document.createElement div
     ; set lane-data-row-template-tools ref-tmpl-tools.className
     ; to ref-tmpl-preview !document.createElement span
     ; set lane-data-row-template-preview ref-tmpl-preview.className
     ; to ref-tmpl-error !document.createElement span
     ; set lane-data-row-template-error ref-tmpl-error.className
     !ref-tmpl-field.appendChild $ref-tmpl-label
     !ref-tmpl-field.appendChild $ref-tmpl-el
     !ref-tmpl-field.appendChild $ref-tmpl-tools
     !ref-tmpl-field.appendChild $ref-tmpl-preview
     !ref-tmpl-field.appendChild $ref-tmpl-error

     ; to ref-filter-field !document.createElement div
     ; set 'lane-data-row-field lane-data-row-field--filter' ref-filter-field.className
     ; to ref-filter-label !document.createElement span
     ; assign $ref-filter-label { className lane-data-row-label } { textContent Filter }
     ; to ref-filter-controls !document.createElement div
     ; set lane-data-row-filter ref-filter-controls.className
     ; to ref-filter-where !document.createElement span
     ; assign $ref-filter-where { className lane-data-row-filter-text } { textContent where }
     ; to ref-filter-col-el !document.createElement select
     ; assign $ref-filter-col-el { className 'lane-input-type lane-data-row-select lane-data-row-filter-select' } { title 'Filter column on linked table' }
     ; to ref-filter-col-empty !document.createElement option
     ; assign $ref-filter-col-empty { value '' } { textContent 'None (optional)' }
     !ref-filter-col-el.appendChild $ref-filter-col-empty
     ; to ref-filter-is !document.createElement span
     ; assign $ref-filter-is { className lane-data-row-filter-text } { textContent is }
     ; to filter-by-col-el !document.createElement select
     ; assign $filter-by-col-el { className 'lane-input-type lane-data-row-select lane-data-row-filter-select' } { title 'Matching column on this table' }
     ; to filter-by-col-empty !document.createElement option
     ; assign $filter-by-col-empty { value '' } { textContent 'None (optional)' }
     !filter-by-col-el.appendChild $filter-by-col-empty
     !ref-filter-controls.appendChild $ref-filter-where
     !ref-filter-controls.appendChild $ref-filter-col-el
     !ref-filter-controls.appendChild $ref-filter-is
     !ref-filter-controls.appendChild $filter-by-col-el
     !ref-filter-field.appendChild $ref-filter-label
     !ref-filter-field.appendChild $ref-filter-controls

     ; to row-hint-el !document.createElement div
     ; assign $row-hint-el { className lane-data-row-hint } { textContent '' }

     [ match
      { $is-row (
       ; to cur-ref-table-id [ match { $col.refTableId : $col.refTableId } { true : '' } ]
       ; to cur-ref-col-id [ match { $col.refColumnId : $col.refColumnId } { true : '' } ]
       ; to cur-ref-disp-id [ match { $col.refDisplayColumnId : $col.refDisplayColumnId } { true : '' } ]
       ; to cur-ref-filter-col-id [ match { $col.refFilterColumnId : $col.refFilterColumnId } { true : '' } ]
       ; to cur-filter-by-col-id [ match { $col.filterByColumnId : $col.filterByColumnId } { true : '' } ]

       ; to cur-tbl-idx !view.tables.indexOf $tbl
       ; to cur-tbl-name !view.display-table-name $tbl $cur-tbl-idx

       ; to sel-table-box ; object { table null } { name '' }
       ; each $view.tables (
        ; to { t t-idx } $argv
        ; to allow-t [ match
         { [ propertyIs false is-rem ] : true }
         { [ and { $t.remote } { [ propertyIs $tbl.remote.laneId t.remote.laneId ] } ] : true }
         { true : false }
        ]
        ; condition { propertyIs true allow-t } (
         ; to opt-val [ match { $is-rem : $t.remote.tableId } { true : $t.id } ]
         ; to t-disp !view.display-table-name $t $t-idx
         ; to opt-t !document.createElement option
         ; assign $opt-t { value $opt-val } { textContent $t-disp }
         !ref-table-el.appendChild $opt-t
         ; condition { propertyIs $cur-ref-table-id opt-val } (
          ; set $t sel-table-box.table
          ; set $t-disp sel-table-box.name
         )
        )
       )
       ; to sel-table $sel-table-box.table
       ; to sel-table-name $sel-table-box.name
       ; set $is-ro ref-table-el.disabled
       ; to sel-tbl-val [ match
        { [ propertyIs null sel-table ] : '' }
        { $is-rem : $sel-table.remote.tableId }
        { true : $sel-table.id }
       ]
       ; set $sel-tbl-val ref-table-el.value
       ; set [ ternary $sel-table 'lane-input-type lane-data-row-select' 'lane-input-type lane-data-row-select lane-data-row-select--required' ] ref-table-el.className

       ; to sel-col-box ; object { col null } { disp null } { filter-col null } { filter-by-col null }
       [ match
        { $sel-table (
         ; set $is-ro ref-col-el.disabled
         ; set $is-ro ref-display-el.disabled
         ; set $is-ro ref-filter-col-el.disabled
         ; set $is-ro filter-by-col-el.disabled
         ; each $sel-table.columns (
          ; to { tc } $argv
          ; to tc-name !view.display-col-name $tc
          ; to tc-type !formatColumnType $tc undefined undefined $view.tables
          ; to tc-label ; add $tc-name ; add ' (' ; add $tc-type ')'
          ; to tc-filter-label ; add $sel-table-name ; add '.' ; add $tc-name ; add ' (' ; add $tc-type ')'
          ; to opt-c !document.createElement option
          ; assign $opt-c { value $tc.id } { textContent $tc-label }
          !ref-col-el.appendChild $opt-c
          ; to opt-d !document.createElement option
          ; assign $opt-d { value $tc.id } { textContent $tc-label }
          !ref-display-el.appendChild $opt-d
          ; to opt-fc !document.createElement option
          ; assign $opt-fc { value $tc.id } { textContent $tc-filter-label }
          !ref-filter-col-el.appendChild $opt-fc
          ; condition { propertyIs $cur-ref-col-id tc.id } : ; set $tc sel-col-box.col
          ; condition { propertyIs $cur-ref-disp-id tc.id } : ; set $tc sel-col-box.disp
          ; condition { propertyIs $cur-ref-filter-col-id tc.id } : ; set $tc sel-col-box.filter-col
         )
        ) }
        { true (
         ; set true ref-col-el.disabled
         ; set true ref-display-el.disabled
         ; set true ref-filter-col-el.disabled
         ; set true filter-by-col-el.disabled
        ) }
       ]
       ; each $tbl.columns (
        ; to { oc } $argv
        [ match
         { [ propertyIs $col.id oc.id ] : null }
         { true (
          ; to oc-name !view.display-col-name $oc
          ; to oc-type !formatColumnType $oc undefined undefined $view.tables
          ; to oc-filter-label ; add $cur-tbl-name ; add '.' ; add $oc-name ; add ' (' ; add $oc-type ')'
          ; to opt-fb !document.createElement option
          ; assign $opt-fb { value $oc.id } { textContent $oc-filter-label }
          !filter-by-col-el.appendChild $opt-fb
          ; condition { propertyIs $cur-filter-by-col-id oc.id } : ; set $oc sel-col-box.filter-by-col
         ) }
        ]
       )
       ; to sel-col $sel-col-box.col
       ; to sel-disp $sel-col-box.disp
       ; to sel-filter-col $sel-col-box.filter-col
       ; to sel-filter-by $sel-col-box.filter-by-col
       ; to filter-op-word [ match { $sel-filter-col.multiple : contains } { true : is } ]
       ; set $filter-op-word ref-filter-is.textContent
       ; set [ match { $sel-col : $sel-col.id } { true : '' } ] ref-col-el.value
       ; set [ match { $sel-disp : $sel-disp.id } { true : '' } ] ref-display-el.value
       ; set [ match { $col.refDisplayTemplate : $col.refDisplayTemplate } { true : '' } ] ref-tmpl-el.value
       ; to refresh-tmpl-preview (
        ; to pv !view.preview-display-template $tbl $col $ref-tmpl-el.value
        ; set $pv.text ref-tmpl-preview.textContent
        ; set [ match { [ propertyIs true pv.ok ] : '' } { true : $pv.error } ] ref-tmpl-error.textContent
        ; set [ match { [ propertyIs true pv.ok ] : 'lane-data-row-template-preview' } { true : 'lane-data-row-template-preview lane-data-row-template-preview--error' } ] ref-tmpl-preview.className
       )
       ; to apply-tmpl-change (
        ; to parsed !parseDisplayTemplate $ref-tmpl-el.value
        [ match
         { [ propertyIs false parsed.ok ] (
          !refresh-tmpl-preview
         ) }
         { true (
          [ match
           { [ propertyIs '' parsed.text ] (
            [ match
             { $window.Reflect.deleteProperty (
              !window.Reflect.deleteProperty $col refDisplayTemplate
             ) }
             { true : ; set undefined col.refDisplayTemplate }
            ]
           ) }
           { true : ; set $parsed.text col.refDisplayTemplate }
          ]
          !view.render-schema
          !view.render-grid
          !view.save-schema $tbl
         ) }
        ]
       )
       !ref-tmpl-el.addEventListener input : !refresh-tmpl-preview
       !ref-tmpl-el.addEventListener change : !apply-tmpl-change
       ; match
        { $sel-table (
         ; each $sel-table.columns (
          ; to { tc } $argv
          ; to tc-name !view.display-col-name $tc
          ; to token !view.display-template-token $tc
          ; to chip !document.createElement button
          ; assign $chip { type button } { className lane-data-row-template-chip } { textContent $token } { title [ ; add 'Insert ' ; add $tc-name ' column' ] } { disabled $is-ro }
          !chip.addEventListener click (
           ; to start $ref-tmpl-el.selectionStart
           ; to end $ref-tmpl-el.selectionEnd
           ; to before !ref-tmpl-el.value.slice 0 $start
           ; to after !ref-tmpl-el.value.slice $end
           ; set [ ; add $before ; add $token $after ] ref-tmpl-el.value
           ; to caret [ ; add $start $token.length ]
           !ref-tmpl-el.focus
           !ref-tmpl-el.setSelectionRange $caret $caret
           !apply-tmpl-change
          )
          !ref-tmpl-tools.appendChild $chip
         )
        ) }
        { true : null }
       !refresh-tmpl-preview
       ; set [ match { $sel-filter-col : $sel-filter-col.id } { true : '' } ] ref-filter-col-el.value
       ; set [ match { $sel-filter-by : $sel-filter-by.id } { true : '' } ] filter-by-col-el.value
       ; set [ ternary $sel-col 'lane-input-type lane-data-row-select' 'lane-input-type lane-data-row-select lane-data-row-select--required' ] ref-col-el.className
       ; to need-ref-filter [ match { $sel-filter-by : [ ternary $sel-filter-col false true ] } { true : false } ]
       ; to need-filter-by [ match { $sel-filter-col : [ ternary $sel-filter-by false true ] } { true : false } ]
       ; set [ ternary $need-ref-filter 'lane-input-type lane-data-row-select lane-data-row-filter-select lane-data-row-select--required' 'lane-input-type lane-data-row-select lane-data-row-filter-select' ] ref-filter-col-el.className
       ; set [ ternary $need-filter-by 'lane-input-type lane-data-row-select lane-data-row-filter-select lane-data-row-select--required' 'lane-input-type lane-data-row-select lane-data-row-filter-select' ] filter-by-col-el.className

       ; to hint-text [ match
        { [ propertyIs null sel-table ] : 'Select table and link column (required)' }
        { [ propertyIs null sel-col ] : 'Select link column (sets literal data type)' }
        { true (
         ; to val-spec !resolveRowValueSpec $view.tables $col
         [ match
          { $val-spec (
           ; to lit-fmt !formatColumnType $val-spec
           ; to base-hint ; add 'Stores ' $lit-fmt
           ; to with-disp [ match
            { $sel-disp [ match
             { [ propertyIs $sel-col.id sel-disp.id ] : ; add $base-hint ' · same as link column' }
             { true (
              ; to disp-name !view.display-col-name $sel-disp
              ; add $base-hint ; add ' · displays ' $disp-name
             ) }
            ] }
            { true : $base-hint }
           ]
           [ match
            { $sel-filter-col [ match
             { $sel-filter-by (
              ; to fc-name !view.display-col-name $sel-filter-col
              ; to fb-name !view.display-col-name $sel-filter-by
              ; add $with-disp ; add ' · filter where ' ; add $sel-table-name ; add '.' ; add $fc-name ; add ' ' ; add $filter-op-word ; add ' ' ; add $cur-tbl-name ; add '.' $fb-name
             ) }
             { true : ; add $with-disp ' · select matching filter column' }
            ] }
            { $sel-filter-by : ; add $with-disp ' · select linked table filter column' }
            { true : $with-disp }
           ]
          ) }
          { true : 'Linked column forms a cycle or is invalid' }
         ]
        ) }
       ]
       ; match
        { $col.refDisplayTemplate (
         ; set [ ; add $hint-text ; add ' · template ' $col.refDisplayTemplate ] hint-text
        ) }
        { true : null }
       ; set $hint-text row-hint-el.textContent
      ) }
     ]

     !row-config-wrap.appendChild $ref-table-field
     !row-config-wrap.appendChild $ref-col-field
     !row-config-wrap.appendChild $ref-disp-field
     !row-config-wrap.appendChild $ref-tmpl-field
     !row-config-wrap.appendChild $ref-filter-field
     !row-config-wrap.appendChild $row-hint-el
     !type-td.appendChild $row-config-wrap

     ; to constraints-list-el !document.createElement div
     ; assign $constraints-list-el { className lane-data-constraints-list } { hidden [ ternary $has-constraints false true ] }
     ; to constraint-cards {}
     ; to single-col-spec [ match
      { [ propertyIs fixed col.type ] : ; object { type fixed } { multiple false } { decimals !normalizeFixedDecimals $col.decimals } }
      { true : ; object { type $col.type } { multiple false } }
     ]
     ; to make-constraint-field (
      ; to { lbl-txt ctrl-el } $argv
      ; to fld !document.createElement label
      ; set lane-data-row-field fld.className
      ; to lbl !document.createElement span
      ; assign $lbl { className lane-data-row-label } { textContent $lbl-txt }
      !fld.appendChild $lbl
      !fld.appendChild $ctrl-el
      $fld
     )
     ; to read-latest-constraint (
      ; to { idx fallback } $argv
      ; to latest-all !normalizeColumnConstraints $col $col.type $col.decimals
      ; to found [ get latest-all $idx ]
      [ match { $found : $found } { true : $fallback } ]
     )
     ; to update-constraint-at (
      ; to { target-idx next-c-obj do-rerender chint-el } $argv
      ; to latest-all !normalizeColumnConstraints $col $col.type $col.decimals
      ; to next-all {}
      ; each $latest-all (
       ; to { lc lidx } $argv
       [ match
        { [ propertyIs $target-idx lidx ] : !next-all.push $next-c-obj }
        { true : !next-all.push $lc }
       ]
      )
      ; to norm-all !view.set-col-constraints $col $next-all
      [ match
       { $do-rerender (
        !view.render-schema
        !view.render-grid
        !view.save-schema $tbl
       ) }
       { true (
        ; to updated-c [ get norm-all $target-idx ]
        ; to ref-c [ match { $updated-c : $updated-c } { true : $next-c-obj } ]
        ; to copts !view.get-clock-display-opts
        ; to hint-txt [ match
         { $describeColumnConstraint : !describeColumnConstraint $ref-c $col $view.tables $copts }
         { true : '' }
        ]
        [ match { $chint-el : ; set $hint-txt chint-el.textContent } ]
        !view.render-grid
        !view.save-schema $tbl
       ) }
      ]
     )

     ; each $cur-constraints (
      ; to { c-item c-idx } $argv
      ; to card-wrap !document.createElement div
      ; assign $card-wrap { className lane-data-constraint-config } { hidden false }

      ; to card-header !document.createElement div
      ; set lane-data-constraint-header card-header.className
      ; to card-title !document.createElement span
      ; assign $card-title { className lane-data-constraint-title } { textContent Constraint }
      ; to card-remove-btn !document.createElement button
      ; assign $card-remove-btn { type button } { className lane-data-constraint-remove } { textContent '×' } { title 'Remove constraint' } { hidden $is-ro } { disabled $is-ro }
      !card-header.appendChild $card-title
      !card-header.appendChild $card-remove-btn

      ; to ctype-el !document.createElement select
      ; assign $ctype-el { className 'lane-input-type lane-data-row-select lane-data-constraint-type' } { disabled $is-ro }
      ; each $supported-constraints (
       ; to { sc } $argv
       ; to is-cur-type [ propertyIs $c-item.type sc.type ]
       ; to is-other-used [ match { [ get used-ctypes $sc.type ] : true } { true : false } ]
       ; to allow-ctype [ match
        { $is-cur-type : true }
        { [ propertyIs false is-other-used ] : true }
        { true : false }
       ]
       ; condition { propertyIs true allow-ctype } (
        ; to opt-ct !document.createElement option
        ; assign $opt-ct { value $sc.type } { textContent $sc.label }
        !ctype-el.appendChild $opt-ct
       )
      )
      ; set $c-item.type ctype-el.value
      ; to ctype-field !make-constraint-field Type $ctype-el

      ; to chint-el !document.createElement div
      ; assign $chint-el { className lane-data-row-hint } { textContent '' }

      !card-wrap.appendChild $card-header
      !card-wrap.appendChild $ctype-field

      ; to card-refs ; object { table-el null } { from-el null } { to-el null } { min-el null } { max-el null } { step-el null } { text-el null } { preset-past-btn null } { preset-future-btn null } { preset-true-btn null } { preset-false-btn null } { preset-object-btn null } { preset-array-btn null }

      [ match
       { [ propertyIs workflow c-item.type ] (
        ; to ctable-el !document.createElement select
        ; assign $ctable-el { className 'lane-input-type lane-data-row-select lane-data-constraint-table' } { disabled $is-ro }
        ; to ctable-empty !document.createElement option
        ; assign $ctable-empty { value '' } { textContent 'Select table…' }
        !ctable-el.appendChild $ctable-empty
        ; to ctable-field !make-constraint-field Table $ctable-el

        ; to cfrom-el !document.createElement select
        ; set 'lane-input-type lane-data-row-select lane-data-constraint-from' cfrom-el.className
        ; to cfrom-empty !document.createElement option
        ; assign $cfrom-empty { value '' } { textContent 'Select column…' }
        !cfrom-el.appendChild $cfrom-empty
        ; to cfrom-field !make-constraint-field From $cfrom-el

        ; to cto-el !document.createElement select
        ; set 'lane-input-type lane-data-row-select lane-data-constraint-to' cto-el.className
        ; to cto-empty !document.createElement option
        ; assign $cto-empty { value '' } { textContent 'Select column…' }
        !cto-el.appendChild $cto-empty
        ; to cto-field !make-constraint-field To $cto-el

        ; set $ctable-el card-refs.table-el
        ; set $cfrom-el card-refs.from-el
        ; set $cto-el card-refs.to-el

        ; to cur-wf-table-id $c-item.tableId
        ; to cur-wf-from-id $c-item.fromColumnId
        ; to cur-wf-to-id $c-item.toColumnId

        ; to sel-wf-table-box ; object { table null } { name '' }
        ; each $view.tables (
         ; to { t t-idx } $argv
         ; to allow-wt [ match
          { [ propertyIs false is-rem ] : true }
          { [ and { $t.remote } { [ propertyIs $tbl.remote.laneId t.remote.laneId ] } ] : true }
          { true : false }
         ]
         ; condition { propertyIs true allow-wt } (
          ; to opt-wval [ match { $is-rem : $t.remote.tableId } { true : $t.id } ]
          ; to wname !view.display-table-name $t $t-idx
          ; to opt-wt !document.createElement option
          ; assign $opt-wt { value $opt-wval } { textContent $wname }
          !ctable-el.appendChild $opt-wt
          ; condition { propertyIs $cur-wf-table-id opt-wval } (
           ; set $t sel-wf-table-box.table
           ; set $wname sel-wf-table-box.name
          )
         )
        )
        ; to sel-wf-table $sel-wf-table-box.table
        ; to sel-wf-val [ match
         { [ propertyIs null sel-wf-table ] : '' }
         { $is-rem : $sel-wf-table.remote.tableId }
         { true : $sel-wf-table.id }
        ]
        ; set $sel-wf-val ctable-el.value
        ; set [ ternary $sel-wf-table 'lane-input-type lane-data-row-select lane-data-constraint-table' 'lane-input-type lane-data-row-select lane-data-constraint-table lane-data-row-select--required' ] ctable-el.className

        ; to sel-wf-col-box ; object { from-col null } { to-col null } { match-count 0 }
        [ match
         { $sel-wf-table (
          ; set $is-ro cfrom-el.disabled
          ; set $is-ro cto-el.disabled
          ; each $sel-wf-table.columns (
           ; to { tc } $argv
           ; to tc-matches [ ternary [ and { [ propertyIs false tc.multiple ] } { [ propertyIs $col.type tc.type ] } ] true false ]
           ; condition { propertyIs true tc-matches } (
            ; set [ add $sel-wf-col-box.match-count 1 ] sel-wf-col-box.match-count
            ; to tc-name !view.display-col-name $tc
            ; to tc-type !formatColumnType $tc undefined undefined $view.tables
            ; to tc-label ; add $tc-name ; add ' (' ; add $tc-type ')'
            ; to opt-f !document.createElement option
            ; assign $opt-f { value $tc.id } { textContent $tc-label }
            !cfrom-el.appendChild $opt-f
            ; to opt-t2 !document.createElement option
            ; assign $opt-t2 { value $tc.id } { textContent $tc-label }
            !cto-el.appendChild $opt-t2
            ; condition { propertyIs $cur-wf-from-id tc.id } : ; set $tc sel-wf-col-box.from-col
            ; condition { propertyIs $cur-wf-to-id tc.id } : ; set $tc sel-wf-col-box.to-col
           )
          )
         ) }
         { true (
          ; set true cfrom-el.disabled
          ; set true cto-el.disabled
         ) }
        ]
        ; to sel-wf-from $sel-wf-col-box.from-col
        ; to sel-wf-to $sel-wf-col-box.to-col
        ; set [ match { $sel-wf-from : $sel-wf-from.id } { true : '' } ] cfrom-el.value
        ; set [ match { $sel-wf-to : $sel-wf-to.id } { true : '' } ] cto-el.value
        ; set [ ternary $sel-wf-from 'lane-input-type lane-data-row-select lane-data-constraint-from' 'lane-input-type lane-data-row-select lane-data-constraint-from lane-data-row-select--required' ] cfrom-el.className
        ; set [ ternary $sel-wf-to 'lane-input-type lane-data-row-select lane-data-constraint-to' 'lane-input-type lane-data-row-select lane-data-constraint-to lane-data-row-select--required' ] cto-el.className

        ; to wf-hint-text [ match
         { [ propertyIs null sel-wf-table ] : 'Select workflow table (required)' }
         { [ propertyIs 0 sel-wf-col-box.match-count ] : ; add 'No ' ; add $col.type ; add ' columns in ' ; add $sel-wf-table-box.name ; add ' — From and To must be ' $col.type }
         { [ propertyIs null sel-wf-from ] [ match
          { [ propertyIs null sel-wf-to ] : ; add 'Select ' ; add $col.type ' From and To columns (required)' }
          { true : ; add 'Select ' ; add $col.type ' From column (required)' }
         ] }
         { [ propertyIs null sel-wf-to ] : ; add 'Select ' ; add $col.type ' To column (required)' }
         { true (
          ; to wf-info !resolveWorkflowTarget $view.tables $col
          ; to unit [ ternary [ propertyIs 1 wf-info.transitionCount ] transition transitions ]
          ; add $wf-info.tableName ; add ' (' ; add $wf-info.fromColName ; add ' → ' ; add $wf-info.toColName ; add ') · ' ; add $wf-info.transitionCount ; add ' ' $unit
         ) }
        ]
        ; set $wf-hint-text chint-el.textContent

        !ctable-el.addEventListener change (
         ; condition { propertyIs false is-ro } (
          ; to next-tbl-id $ctable-el.value
          ; to found-tbl ; object { table null }
          ; each $view.tables (
           ; to { cand } $argv
           ; to match-cand [ match
            { $is-rem : [ ternary [ and { $cand.remote } { [ propertyIs $tbl.remote.laneId cand.remote.laneId ] } { [ propertyIs $next-tbl-id cand.remote.tableId ] } ] true false ] }
            { true : [ propertyIs $next-tbl-id cand.id ] }
           ]
           ; condition { propertyIs true match-cand } : ; set $cand found-tbl.table
          )
          ; to defaults !findWorkflowDefaultColumns $found-tbl.table $col.type
          ; to next-c [ object
           { type workflow }
           { tableId $next-tbl-id }
           { fromColumnId $defaults.fromColumnId }
           { toColumnId $defaults.toColumnId }
          ]
          !update-constraint-at $c-idx $next-c true $chint-el
         )
        )
        !cfrom-el.addEventListener change (
         ; condition { propertyIs false is-ro } (
          ; to cur-c !read-latest-constraint $c-idx $c-item
          ; to next-c [ object
           { type workflow }
           { tableId $cur-c.tableId }
           { fromColumnId $cfrom-el.value }
           { toColumnId $cur-c.toColumnId }
          ]
          !update-constraint-at $c-idx $next-c true $chint-el
         )
        )
        !cto-el.addEventListener change (
         ; condition { propertyIs false is-ro } (
          ; to cur-c !read-latest-constraint $c-idx $c-item
          ; to next-c [ object
           { type workflow }
           { tableId $cur-c.tableId }
           { fromColumnId $cur-c.fromColumnId }
           { toColumnId $cto-el.value }
          ]
          !update-constraint-at $c-idx $next-c true $chint-el
         )
        )

        !card-wrap.appendChild $ctable-field
        !card-wrap.appendChild $cfrom-field
        !card-wrap.appendChild $cto-field
       ) }
       { [ propertyIs date_range c-item.type ] (
        ; to is-date-col [ propertyIs date col.type ]
        ; to past-val [ ternary $is-date-col today_or_past past ]
        ; to future-val [ ternary $is-date-col today_or_future future ]
        ; to past-lbl [ ternary $is-date-col 'Must be today or past' 'Must be in the past' ]
        ; to future-lbl [ ternary $is-date-col 'Must be today or future' 'Must be in the future' ]
        ; to is-past [ propertyIs $past-val c-item.relative ]
        ; to is-future [ propertyIs $future-val c-item.relative ]

        ; to presets-wrap !document.createElement div
        ; set lane-data-constraint-presets presets-wrap.className
        ; to cpast-btn !document.createElement button
        ; assign $cpast-btn { type button } { className [ ternary $is-past 'lane-data-constraint-preset lane-data-constraint-preset--active' lane-data-constraint-preset ] } { textContent $past-lbl } { disabled $is-ro }
        !cpast-btn.setAttribute aria-pressed [ ternary $is-past 'true' 'false' ]
        ; to cfuture-btn !document.createElement button
        ; assign $cfuture-btn { type button } { className [ ternary $is-future 'lane-data-constraint-preset lane-data-constraint-preset--active' lane-data-constraint-preset ] } { textContent $future-lbl } { disabled $is-ro }
        !cfuture-btn.setAttribute aria-pressed [ ternary $is-future 'true' 'false' ]
        !presets-wrap.appendChild $cpast-btn
        !presets-wrap.appendChild $cfuture-btn
        ; set $cpast-btn card-refs.preset-past-btn
        ; set $cfuture-btn card-refs.preset-future-btn

        !cpast-btn.addEventListener click (
         ; condition { propertyIs false is-ro } (
          ; to cur-c !read-latest-constraint $c-idx $c-item
          ; to next-rel [ ternary [ propertyIs $past-val cur-c.relative ] '' $past-val ]
          ; to next-c [ object { type date_range } { relative $next-rel } { min $cur-c.min } { max $cur-c.max } ]
          !update-constraint-at $c-idx $next-c true $chint-el
         )
        )
        !cfuture-btn.addEventListener click (
         ; condition { propertyIs false is-ro } (
          ; to cur-c !read-latest-constraint $c-idx $c-item
          ; to next-rel [ ternary [ propertyIs $future-val cur-c.relative ] '' $future-val ]
          ; to next-c [ object { type date_range } { relative $next-rel } { min $cur-c.min } { max $cur-c.max } ]
          !update-constraint-at $c-idx $next-c true $chint-el
         )
        )
        !card-wrap.appendChild $presets-wrap

        ; to make-date-bound (
         ; to { bound-key raw-init } $argv
         ; to inp !document.createElement input
         ; to copts !view.get-clock-display-opts
         [ match
          { $is-date-col (
           ; assign $inp { type date } { className 'lane-data-cell-input lane-data-constraint-input' } { value $raw-init } { spellcheck false } { autocomplete off } { disabled $is-ro } { readOnly $is-ro }
          ) }
          { true (
           ; to init-fmt [ match
            { [ propertyIs '' raw-init ] : '' }
            { true : !formatCellInputValue $raw-init datetime undefined $view.tables $copts }
           ]
           ; to ph [ match { $formatDatetimePlaceholder : !formatDatetimePlaceholder $copts } { true : 'YYYY-MM-DD HH:mm' } ]
           ; assign $inp { type text } { className 'lane-data-cell-input lane-data-constraint-input' } { value $init-fmt } { placeholder $ph } { spellcheck false } { autocomplete off } { disabled $is-ro } { readOnly $is-ro }
          ) }
         ]
         ; to on-bound-change (
          ; condition { propertyIs false is-ro } (
           ; to cur-copts !view.get-clock-display-opts
           ; to parsed [ match
            { $is-date-col : !parseCellValue $inp.value date }
            { true : !parseCellValue $inp.value datetime undefined $view.tables $cur-copts }
           ]
           [ match
            { $parsed.ok (
             ; set 'lane-data-cell-input lane-data-constraint-input' inp.className
             ; set '' inp.title
             !inp.setAttribute aria-invalid 'false'
             ; to cur-c !read-latest-constraint $c-idx $c-item
             ; to next-min [ match { [ propertyIs min bound-key ] : $parsed.value } { true : $cur-c.min } ]
             ; to next-max [ match { [ propertyIs max bound-key ] : $parsed.value } { true : $cur-c.max } ]
             ; to next-c [ object { type date_range } { relative $cur-c.relative } { min $next-min } { max $next-max } ]
             !update-constraint-at $c-idx $next-c false $chint-el
            ) }
            { true (
             ; set 'lane-data-cell-input lane-data-constraint-input lane-data-cell-input--invalid' inp.className
             ; set $parsed.error inp.title
             !inp.setAttribute aria-invalid 'true'
            ) }
           ]
          )
         )
         !inp.addEventListener input $on-bound-change
         !inp.addEventListener change $on-bound-change
         $inp
        )
        ; to cmin-el !make-date-bound min $c-item.min
        ; to cmax-el !make-date-bound max $c-item.max
        ; set $cmin-el card-refs.min-el
        ; set $cmax-el card-refs.max-el
        !card-wrap.appendChild [ !make-constraint-field Min $cmin-el ]
        !card-wrap.appendChild [ !make-constraint-field Max $cmax-el ]
        ; to dr-copts !view.get-clock-display-opts
        ; set [ !describeColumnConstraint $c-item $col $view.tables $dr-copts ] chint-el.textContent
       ) }
       { [ match { [ propertyIs min c-item.type ] : true } { [ propertyIs max c-item.type ] : true } { [ propertyIs range c-item.type ] : true } { true : false } ] (
        ; to make-num-bound (
         ; to { bound-key cur-val } $argv
         ; to inp !document.createElement input
         ; to ph [ match { [ propertyIs fixed col.type ] : !formatCellInputValue 0 $col } { true : '' } ]
         ; to fmt-val [ match
          { [ propertyIs null cur-val ] : '' }
          { [ propertyIs undefined cur-val ] : '' }
          { true : ; add '' !formatCellInputValue $cur-val $single-col-spec }
         ]
         ; assign $inp { type text } { className 'lane-data-cell-input lane-data-constraint-input' } { value $fmt-val } { placeholder $ph } { spellcheck false } { autocomplete off } { disabled $is-ro } { readOnly $is-ro }
         !inp.setAttribute inputmode [ ternary [ propertyIs integer col.type ] numeric decimal ]
         !inp.setAttribute data-num-type $col.type
         !inp.setAttribute aria-invalid 'false'
         ; to parse-num-bound (
          [ match
           { $parseNumericCellInput : !parseNumericCellInput $inp.value $single-col-spec }
           { true : !parseCellValue $inp.value $single-col-spec }
          ]
         )
         !inp.addEventListener input (
          ; condition { propertyIs false is-ro } (
           ; to parsed !parse-num-bound
           [ match
            { $parsed.ok (
             ; set 'lane-data-cell-input lane-data-constraint-input' inp.className
             ; set '' inp.title
             !inp.setAttribute aria-invalid 'false'
             ; to cur-c !read-latest-constraint $c-idx $c-item
             ; to next-c [ match
              { [ propertyIs min c-item.type ] : ; object { type min } { min $parsed.value } }
              { [ propertyIs max c-item.type ] : ; object { type max } { max $parsed.value } }
              { true (
               ; to next-min [ match { [ propertyIs min bound-key ] : $parsed.value } { true : $cur-c.min } ]
               ; to next-max [ match { [ propertyIs max bound-key ] : $parsed.value } { true : $cur-c.max } ]
               ; object { type range } { min $next-min } { max $next-max }
              ) }
             ]
             !update-constraint-at $c-idx $next-c false $chint-el
            ) }
            { true (
             ; set 'lane-data-cell-input lane-data-constraint-input lane-data-cell-input--invalid' inp.className
             ; set $parsed.error inp.title
             !inp.setAttribute aria-invalid 'true'
            ) }
           ]
          )
         )
         ; to normalize-num-bound (
          ; condition { propertyIs false is-ro } (
           ; to parsed !parse-num-bound
           ; condition { propertyIs true parsed.ok } (
            ; to norm-s [ match
             { [ propertyIs null parsed.value ] : '' }
             { true : ; add '' !formatCellInputValue $parsed.value $single-col-spec }
            ]
            ; set $norm-s inp.value
           )
          )
         )
         !inp.addEventListener change $normalize-num-bound
         !inp.addEventListener blur $normalize-num-bound
         $inp
        )
        [ match
         { [ propertyIs min c-item.type ] (
          ; to cmin-el !make-num-bound min $c-item.min
          ; set $cmin-el card-refs.min-el
          !card-wrap.appendChild [ !make-constraint-field Min $cmin-el ]
         ) }
         { [ propertyIs max c-item.type ] (
          ; to cmax-el !make-num-bound max $c-item.max
          ; set $cmax-el card-refs.max-el
          !card-wrap.appendChild [ !make-constraint-field Max $cmax-el ]
         ) }
         { true (
          ; to cmin-el !make-num-bound min $c-item.min
          ; to cmax-el !make-num-bound max $c-item.max
          ; set $cmin-el card-refs.min-el
          ; set $cmax-el card-refs.max-el
          !card-wrap.appendChild [ !make-constraint-field Min $cmin-el ]
          !card-wrap.appendChild [ !make-constraint-field Max $cmax-el ]
         ) }
        ]
        ; set [ !describeColumnConstraint $c-item $col $view.tables null ] chint-el.textContent
       ) }
       { [ match { [ propertyIs step c-item.type ] : true } { [ propertyIs min_length c-item.type ] : true } { [ propertyIs max_length c-item.type ] : true } { true : false } ] (
        ; to is-step [ propertyIs step c-item.type ]
        ; to is-minl [ propertyIs min_length c-item.type ]
        ; to min-allowed [ ternary $is-step 1 0 ]
        ; to cur-num [ match
         { $is-step : $c-item.step }
         { $is-minl : $c-item.min }
         { true : $c-item.max }
        ]
        ; to init-num [ match
         { [ propertyIs null cur-num ] : '' }
         { [ propertyIs undefined cur-num ] : '' }
         { true : ; add '' $cur-num }
        ]
        ; to num-inp !document.createElement input
        ; assign $num-inp { type text } { className 'lane-data-cell-input lane-data-constraint-input' } { value $init-num } { spellcheck false } { autocomplete off } { disabled $is-ro } { readOnly $is-ro }
        !num-inp.setAttribute inputmode numeric
        !num-inp.setAttribute data-num-type integer
        !num-inp.setAttribute aria-invalid 'false'
        [ match
         { $is-step : ; set $num-inp card-refs.step-el }
         { $is-minl : ; set $num-inp card-refs.min-el }
         { true : ; set $num-inp card-refs.max-el }
        ]
        ; to validate-step-len (
         ; to parsed [ match
          { $parseNumericCellInput : !parseNumericCellInput $num-inp.value integer }
          { true : !parseCellValue $num-inp.value integer }
         ]
         ; to val-ok [ match
          { [ propertyIs false parsed.ok ] : false }
          { [ propertyIs null parsed.value ] : true }
          { [ propertyIsLessThan $min-allowed parsed.value ] : false }
          { true : true }
         ]
         ; object { parsed $parsed } { ok $val-ok }
        )
        !num-inp.addEventListener input (
         ; condition { propertyIs false is-ro } (
          ; to res !validate-step-len
          [ match
           { $res.ok (
            ; set 'lane-data-cell-input lane-data-constraint-input' num-inp.className
            ; set '' num-inp.title
            !num-inp.setAttribute aria-invalid 'false'
            ; to next-c [ match
             { $is-step : ; object { type step } { step $res.parsed.value } }
             { $is-minl : ; object { type min_length } { min $res.parsed.value } }
             { true : ; object { type max_length } { max $res.parsed.value } }
            ]
            !update-constraint-at $c-idx $next-c false $chint-el
           ) }
           { true (
            ; set 'lane-data-cell-input lane-data-constraint-input lane-data-cell-input--invalid' num-inp.className
            ; to err-t [ match { $res.parsed.error : $res.parsed.error } { true : ; add 'Must be at least ' $min-allowed } ]
            ; set $err-t num-inp.title
            !num-inp.setAttribute aria-invalid 'true'
           ) }
          ]
         )
        )
        ; to normalize-step-len (
         ; condition { propertyIs false is-ro } (
          ; to res !validate-step-len
          ; condition { propertyIs true res.ok } (
           ; to norm-s [ match
            { [ propertyIs null res.parsed.value ] : '' }
            { true : ; add '' $res.parsed.value }
           ]
           ; set $norm-s num-inp.value
          )
         )
        )
        !num-inp.addEventListener change $normalize-step-len
        !num-inp.addEventListener blur $normalize-step-len
        ; to fld-lbl [ match { $is-step : Step } { $is-minl : Min } { true : Max } ]
        !card-wrap.appendChild [ !make-constraint-field $fld-lbl $num-inp ]
        ; set [ !describeColumnConstraint $c-item $col $view.tables null ] chint-el.textContent
       ) }
       { [ match { [ propertyIs pattern c-item.type ] : true } { [ propertyIs one_of c-item.type ] : true } { [ propertyIs domain c-item.type ] : true } { [ propertyIs required_keys c-item.type ] : true } { true : false } ] (
        ; to init-txt [ match
         { [ propertyIs pattern c-item.type ] : $c-item.pattern }
         { [ propertyIs one_of c-item.type ] : !c-item.values.join ', ' }
         { [ propertyIs domain c-item.type ] : !c-item.domains.join ', ' }
         { true : !c-item.keys.join ', ' }
        ]
        ; to txt-lbl [ match
         { [ propertyIs pattern c-item.type ] : Regex }
         { [ propertyIs one_of c-item.type ] : Values }
         { [ propertyIs domain c-item.type ] : Domains }
         { true : Keys }
        ]
        ; to txt-ph [ match
         { [ propertyIs pattern c-item.type ] : '/^[a-z0-9-]+$/i' }
         { [ propertyIs one_of c-item.type ] : 'a, b, c' }
         { [ propertyIs domain c-item.type ] : 'example.com' }
         { true : 'id, name' }
        ]
        ; to txt-inp !document.createElement input
        ; assign $txt-inp { type text } { className 'lane-data-cell-input lane-data-constraint-input' } { value $init-txt } { placeholder $txt-ph } { spellcheck false } { autocomplete off } { disabled $is-ro } { readOnly $is-ro }
        ; set $txt-inp card-refs.text-el
        !txt-inp.addEventListener input (
         ; condition { propertyIs false is-ro } (
          ; to raw-v $txt-inp.value
          ; to next-c [ match
           { [ propertyIs pattern c-item.type ] : ; object { type pattern } { pattern $raw-v } }
           { [ propertyIs one_of c-item.type ] : ; object { type one_of } { values $raw-v } }
           { [ propertyIs domain c-item.type ] : ; object { type domain } { domains $raw-v } }
           { true : ; object { type required_keys } { keys $raw-v } }
          ]
          !update-constraint-at $c-idx $next-c false $chint-el
         )
        )
        !card-wrap.appendChild [ !make-constraint-field $txt-lbl $txt-inp ]
        ; set [ !describeColumnConstraint $c-item $col $view.tables null ] chint-el.textContent
       ) }
       { [ propertyIs boolean_value c-item.type ] (
        ; to is-exp-true [ propertyIs true c-item.expected ]
        ; to is-exp-false [ propertyIs false c-item.expected ]
        ; to presets-wrap !document.createElement div
        ; set lane-data-constraint-presets presets-wrap.className
        ; to ctrue-btn !document.createElement button
        ; assign $ctrue-btn { type button } { className [ ternary $is-exp-true 'lane-data-constraint-preset lane-data-constraint-preset--active' lane-data-constraint-preset ] } { textContent 'Must be true' } { disabled $is-ro }
        !ctrue-btn.setAttribute aria-pressed [ ternary $is-exp-true 'true' 'false' ]
        ; to cfalse-btn !document.createElement button
        ; assign $cfalse-btn { type button } { className [ ternary $is-exp-false 'lane-data-constraint-preset lane-data-constraint-preset--active' lane-data-constraint-preset ] } { textContent 'Must be false' } { disabled $is-ro }
        !cfalse-btn.setAttribute aria-pressed [ ternary $is-exp-false 'true' 'false' ]
        !presets-wrap.appendChild $ctrue-btn
        !presets-wrap.appendChild $cfalse-btn
        ; set $ctrue-btn card-refs.preset-true-btn
        ; set $cfalse-btn card-refs.preset-false-btn
        !ctrue-btn.addEventListener click (
         ; condition { propertyIs false is-ro } (
          ; to cur-c !read-latest-constraint $c-idx $c-item
          ; to next-exp [ ternary [ propertyIs true cur-c.expected ] null true ]
          !update-constraint-at $c-idx [ object { type boolean_value } { expected $next-exp } ] true $chint-el
         )
        )
        !cfalse-btn.addEventListener click (
         ; condition { propertyIs false is-ro } (
          ; to cur-c !read-latest-constraint $c-idx $c-item
          ; to next-exp [ ternary [ propertyIs false cur-c.expected ] null false ]
          !update-constraint-at $c-idx [ object { type boolean_value } { expected $next-exp } ] true $chint-el
         )
        )
        !card-wrap.appendChild $presets-wrap
        ; set [ !describeColumnConstraint $c-item $col $view.tables null ] chint-el.textContent
       ) }
       { [ propertyIs json_type c-item.type ] (
        ; to is-obj [ propertyIs object c-item.expected ]
        ; to is-arr [ propertyIs array c-item.expected ]
        ; to presets-wrap !document.createElement div
        ; set lane-data-constraint-presets presets-wrap.className
        ; to cobj-btn !document.createElement button
        ; assign $cobj-btn { type button } { className [ ternary $is-obj 'lane-data-constraint-preset lane-data-constraint-preset--active' lane-data-constraint-preset ] } { textContent 'Must be object' } { disabled $is-ro }
        !cobj-btn.setAttribute aria-pressed [ ternary $is-obj 'true' 'false' ]
        ; to carr-btn !document.createElement button
        ; assign $carr-btn { type button } { className [ ternary $is-arr 'lane-data-constraint-preset lane-data-constraint-preset--active' lane-data-constraint-preset ] } { textContent 'Must be array' } { disabled $is-ro }
        !carr-btn.setAttribute aria-pressed [ ternary $is-arr 'true' 'false' ]
        !presets-wrap.appendChild $cobj-btn
        !presets-wrap.appendChild $carr-btn
        ; set $cobj-btn card-refs.preset-object-btn
        ; set $carr-btn card-refs.preset-array-btn
        !cobj-btn.addEventListener click (
         ; condition { propertyIs false is-ro } (
          ; to cur-c !read-latest-constraint $c-idx $c-item
          ; to next-exp [ ternary [ propertyIs object cur-c.expected ] '' object ]
          !update-constraint-at $c-idx [ object { type json_type } { expected $next-exp } ] true $chint-el
         )
        )
        !carr-btn.addEventListener click (
         ; condition { propertyIs false is-ro } (
          ; to cur-c !read-latest-constraint $c-idx $c-item
          ; to next-exp [ ternary [ propertyIs array cur-c.expected ] '' array ]
          !update-constraint-at $c-idx [ object { type json_type } { expected $next-exp } ] true $chint-el
         )
        )
        !card-wrap.appendChild $presets-wrap
        ; set [ !describeColumnConstraint $c-item $col $view.tables null ] chint-el.textContent
       ) }
       { true (
        ; set [ !describeColumnConstraint $c-item $col $view.tables null ] chint-el.textContent
       ) }
      ]

      !card-remove-btn.addEventListener click (
       ; condition { propertyIs false is-ro } (
        ; to latest-all !normalizeColumnConstraints $col $col.type $col.decimals
        ; to next-all {}
        ; each $latest-all (
         ; to { lc lidx } $argv
         ; to same-cidx [ propertyIs $c-idx lidx ]
         ; condition { propertyIs false same-cidx } : !next-all.push $lc
        )
        !view.set-col-constraints $col $next-all
        !view.render-schema
        !view.render-grid
        !view.save-schema $tbl
       )
      )
      !ctype-el.addEventListener change (
       ; condition { propertyIs false is-ro } (
        ; to next-ctype $ctype-el.value
        ; to cur-c !read-latest-constraint $c-idx $c-item
        ; to next-c [ match
         { [ and { [ propertyIs workflow next-ctype ] } { [ propertyIs workflow cur-c.type ] } ] : $cur-c }
         { [ and { [ propertyIs range next-ctype ] } { [ propertyIs min cur-c.type ] } ] : ; object { type range } { min $cur-c.min } { max null } }
         { [ and { [ propertyIs range next-ctype ] } { [ propertyIs max cur-c.type ] } ] : ; object { type range } { min null } { max $cur-c.max } }
         { [ and { [ propertyIs min next-ctype ] } { [ propertyIs range cur-c.type ] } ] : ; object { type min } { min $cur-c.min } }
         { [ and { [ propertyIs max next-ctype ] } { [ propertyIs range cur-c.type ] } ] : ; object { type max } { max $cur-c.max } }
         { true : !createDefaultColumnConstraint $next-ctype $col.type }
        ]
        [ match
         { $next-c : !update-constraint-at $c-idx $next-c true $chint-el }
        ]
       )
      )

      !card-wrap.appendChild $chint-el
      !constraints-list-el.appendChild $card-wrap
      !constraint-cards.push [ object
       { type $c-item.type }
       { index $c-idx }
       { wrap-el $card-wrap }
       { remove-btn $card-remove-btn }
       { type-el $ctype-el }
       { table-el $card-refs.table-el }
       { from-el $card-refs.from-el }
       { to-el $card-refs.to-el }
       { min-el $card-refs.min-el }
       { max-el $card-refs.max-el }
       { step-el $card-refs.step-el }
       { text-el $card-refs.text-el }
       { preset-past-btn $card-refs.preset-past-btn }
       { preset-future-btn $card-refs.preset-future-btn }
       { preset-true-btn $card-refs.preset-true-btn }
       { preset-false-btn $card-refs.preset-false-btn }
       { preset-object-btn $card-refs.preset-object-btn }
       { preset-array-btn $card-refs.preset-array-btn }
       { hint-el $chint-el }
      ]
     )
     !type-td.appendChild $constraints-list-el
     ; to first-card [ match
      { [ propertyIsGreaterThan 0 constraint-cards.length ] : [ get constraint-cards 0 ] }
      { true : null }
     ]
     ; to compat-config-wrap [ match { $first-card : $first-card.wrap-el } { true : $constraints-list-el } ]
     ; to compat-remove-btn [ match { $first-card : $first-card.remove-btn } { true : null } ]
     ; to compat-type-el [ match { $first-card : $first-card.type-el } { true : null } ]
     ; to compat-table-el [ match { $first-card : $first-card.table-el } { true : null } ]
     ; to compat-from-el [ match { $first-card : $first-card.from-el } { true : null } ]
     ; to compat-to-el [ match { $first-card : $first-card.to-el } { true : null } ]
     ; to compat-hint-el [ match { $first-card : $first-card.hint-el } { true : null } ]

     ; to multi-td !document.createElement td
     ; set 'lane-input-cell lane-data-cell--multi' multi-td.className
     ; to multi-btn !document.createElement button
     ; to is-multi [ ternary $col.multiple true false ]
     ; to multi-cls [ ternary $is-multi 'lane-data-multi-toggle lane-data-multi-toggle--active' lane-data-multi-toggle ]
     ; to fmt-title ; add 'Multiple values: ' !formatColumnType $col $is-multi undefined $view.tables
     ; assign $multi-btn { type button } { className $multi-cls } { textContent '[]' } { title $fmt-title } { disabled $is-ro }
     !multi-btn.setAttribute aria-pressed [ ternary $is-multi 'true' 'false' ]
     !multi-td.appendChild $multi-btn

     ; to req-td !document.createElement td
     ; set 'lane-input-cell lane-data-cell--req' req-td.className
     ; to req-btn !document.createElement button
     ; to is-req [ ternary $col.required true false ]
     ; to req-cls [ ternary $is-req 'lane-data-req-toggle lane-data-req-toggle--active' lane-data-req-toggle ]
     ; to req-title [ ternary $is-req 'Required: yes' 'Required: no' ]
     ; assign $req-btn { type button } { className $req-cls } { textContent '*' } { title $req-title } { disabled $is-ro }
     !req-btn.setAttribute aria-pressed [ ternary $is-req 'true' 'false' ]
     !req-td.appendChild $req-btn

     ; to act-td !document.createElement td
     ; set 'lane-input-cell lane-input-cell--actions' act-td.className
     ; to rm-btn !document.createElement button
     ; assign $rm-btn { type button } { className lane-input-remove } { textContent '×' } { title 'Delete column' } { hidden $is-ro } { disabled $is-ro }
     !act-td.appendChild $rm-btn

     !tr.appendChild $name-td
     !tr.appendChild $type-td
     !tr.appendChild $multi-td
     !tr.appendChild $req-td
     !tr.appendChild $act-td

     ; to srow [ object
      { col $col }
      { el $tr }
      { name-el $name-el }
      { type-el $type-el }
      { decimals-wrap $decimals-wrap }
      { decimals-el $decimals-el }
      { constraint-add-el $constraint-add-el }
      { constraints-list-el $constraints-list-el }
      { constraint-cards $constraint-cards }
      { constraint-config-wrap $compat-config-wrap }
      { constraint-remove-btn $compat-remove-btn }
      { constraint-type-el $compat-type-el }
      { constraint-table-el $compat-table-el }
      { constraint-from-el $compat-from-el }
      { constraint-to-el $compat-to-el }
      { constraint-hint-el $compat-hint-el }
      { row-config-wrap $row-config-wrap }
      { ref-table-el $ref-table-el }
      { ref-col-el $ref-col-el }
      { ref-display-el $ref-display-el }
      { ref-tmpl-field $ref-tmpl-field }
      { ref-tmpl-el $ref-tmpl-el }
      { ref-tmpl-tools $ref-tmpl-tools }
      { ref-tmpl-preview $ref-tmpl-preview }
      { ref-tmpl-error $ref-tmpl-error }
      { ref-filter-field $ref-filter-field }
      { ref-filter-controls $ref-filter-controls }
      { ref-filter-col-el $ref-filter-col-el }
      { ref-filter-is $ref-filter-is }
      { filter-by-col-el $filter-by-col-el }
      { row-hint-el $row-hint-el }
      { multi-btn $multi-btn }
      { req-btn $req-btn }
      { required-btn $req-btn }
      { remove-btn $rm-btn }
      { index $col-idx }
     ]

     !name-el.addEventListener input (
      ; condition { propertyIs false is-ro } (
       ; set $name-el.value col.name
       ; to col-head-offset [ match
        { [ propertyIsGreaterThan 0 view.grid-head-cells.length ] (
         ; to first-h [ get view.grid-head-cells 0 ]
         [ ternary [ propertyIs subtoggle first-h.kind ] 2 1 ]
        ) }
        { true : 1 }
       ]
       ; to h-idx ; add $srow.index $col-head-offset
       ; to h-cell [ get view.grid-head-cells $h-idx ]
       [ match
        { $h-cell.name-el : ; set [ !view.display-col-name $col ] h-cell.name-el.textContent }
       ]
       ; condition { propertyIs row col.type } : !view.refresh-row-column-triggers $srow.index
       !view.save-schema $tbl
      )
     )
     !name-el.addEventListener keydown (
      ; condition { propertyIs false is-ro } (
       ; to { ev } $argv
       ; condition { propertyIs Enter ev.key } (
        [ match
         { $ev.preventDefault : !ev.preventDefault }
        ]
        !view.add-column '' text false
       )
      )
     )
     !type-el.addEventListener change (
      ; condition { propertyIs false is-ro } (
       ; to next-type !normalizeDataColumnType $type-el.value
       ; to next-spec [ match
        { [ propertyIs fixed next-type ] [ object
         { type fixed }
         { multiple $col.multiple }
         { decimals !normalizeFixedDecimals $col.decimals }
         { constraint $col.constraint }
         { constraints $col.constraints }
        ] }
        { [ propertyIs row next-type ] [ object
         { type row }
         { multiple $col.multiple }
         { refTableId [ match { $col.refTableId : $col.refTableId } { true : '' } ] }
         { refColumnId [ match { $col.refColumnId : $col.refColumnId } { true : '' } ] }
         { refDisplayColumnId [ match { $col.refDisplayColumnId : $col.refDisplayColumnId } { true : '' } ] }
         { refFilterColumnId [ match { $col.refFilterColumnId : $col.refFilterColumnId } { true : '' } ] }
         { filterByColumnId [ match { $col.filterByColumnId : $col.filterByColumnId } { true : '' } ] }
         { constraint $col.constraint }
         { constraints $col.constraints }
        ] }
        { true [ object
         { type $next-type }
         { multiple $col.multiple }
         { constraint $col.constraint }
         { constraints $col.constraints }
        ] }
       ]
       ; to on-revert (
        ; set $col.type type-el.value
       )
       !view.request-column-change $tbl $col $next-spec $col.multiple $next-spec.decimals $on-revert
      )
     )
     !ref-table-el.addEventListener change (
      ; condition { propertyIs false is-ro } (
       ; to prev-table-id [ match { $col.refTableId : $col.refTableId } { true : '' } ]
       ; to next-table-id $ref-table-el.value
       [ match
        { [ propertyIs $prev-table-id next-table-id ] : null }
        { true (
         ; to next-spec [ object
          { type row }
          { multiple $col.multiple }
          { refTableId $next-table-id }
          { refColumnId '' }
          { refDisplayColumnId '' }
         ]
         ; to on-revert (
          ; set $prev-table-id ref-table-el.value
         )
         !view.request-column-change $tbl $col $next-spec $col.multiple undefined $on-revert
        ) }
       ]
      )
     )
     !ref-col-el.addEventListener change (
      ; condition { propertyIs false is-ro } (
       ; to prev-col-id [ match { $col.refColumnId : $col.refColumnId } { true : '' } ]
       ; to next-col-id $ref-col-el.value
       [ match
        { [ propertyIs $prev-col-id next-col-id ] : null }
        { true (
         ; to cur-tbl-id [ match { $col.refTableId : $col.refTableId } { true : '' } ]
         ; to cur-disp-id [ match { $col.refDisplayColumnId : $col.refDisplayColumnId } { true : '' } ]
         ; to cur-ref-filter-id [ match { $col.refFilterColumnId : $col.refFilterColumnId } { true : '' } ]
         ; to cur-filter-by-id [ match { $col.filterByColumnId : $col.filterByColumnId } { true : '' } ]
         ; to next-spec [ object
          { type row }
          { multiple $col.multiple }
          { refTableId $cur-tbl-id }
          { refColumnId $next-col-id }
          { refDisplayColumnId $cur-disp-id }
          { refFilterColumnId $cur-ref-filter-id }
          { filterByColumnId $cur-filter-by-id }
         ]
         ; to on-revert (
          ; set $prev-col-id ref-col-el.value
         )
         !view.request-column-change $tbl $col $next-spec $col.multiple undefined $on-revert
        ) }
       ]
      )
     )
     !ref-display-el.addEventListener change (
      ; condition { propertyIs false is-ro } (
       ; set $ref-display-el.value col.refDisplayColumnId
       !view.render-schema
       !view.render-grid
       !view.save-schema $tbl
      )
     )
     !ref-filter-col-el.addEventListener change (
      ; condition { propertyIs false is-ro } (
       ; to next-fc-id $ref-filter-col-el.value
       [ match
        { [ propertyIs '' next-fc-id ] (
         [ match
          { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col refFilterColumnId }
          { true : ; set undefined col.refFilterColumnId }
         ]
        ) }
        { true : ; set $next-fc-id col.refFilterColumnId }
       ]
       !view.render-schema
       !view.render-grid
       !view.save-schema $tbl
      )
     )
     !filter-by-col-el.addEventListener change (
      ; condition { propertyIs false is-ro } (
       ; to next-fb-id $filter-by-col-el.value
       [ match
        { [ propertyIs '' next-fb-id ] (
         [ match
          { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col filterByColumnId }
          { true : ; set undefined col.filterByColumnId }
         ]
        ) }
        { true : ; set $next-fb-id col.filterByColumnId }
       ]
       !view.render-schema
       !view.render-grid
       !view.save-schema $tbl
      )
     )
     ; to parse-decimals-val (
      [ match
       { $parseFixedDecimalsInput : !parseFixedDecimalsInput $decimals-el.value }
       { true (
        ; to p !parseCellValue $decimals-el.value integer
        ; to has-int [ match
         { [ propertyIs null p.value ] : false }
         { [ propertyIs undefined p.value ] : false }
         { true : $p.ok }
        ]
        [ match
         { [ and { propertyIs true has-int } { propertyIsGreaterThanOrEqual 0 p.value } { propertyIsLessThanOrEqual 12 p.value } ] : ; object { ok true } { value $p.value } { error null } }
         { true : ; object { ok false } { value null } { error 'Decimal places must be a whole integer from 0 to 12' } }
        ]
       ) }
      ]
     )
     ; to apply-decimals-state (
      ; to { parsed } $argv
      [ match
       { $parsed.ok (
        ; set lane-data-decimals-input decimals-el.className
        ; set 'Decimal places (0–12)' decimals-el.title
        !decimals-el.setAttribute aria-invalid 'false'
       ) }
       { true (
        ; set 'lane-data-decimals-input lane-data-decimals-input--invalid' decimals-el.className
        ; set [ match { $parsed.error : $parsed.error } { true : 'Decimal places must be a whole integer from 0 to 12' } ] decimals-el.title
        !decimals-el.setAttribute aria-invalid 'true'
       ) }
      ]
     )
     !decimals-el.addEventListener input (
      ; condition { propertyIs false is-ro } (
       ; to parsed !parse-decimals-val
       !apply-decimals-state $parsed
      )
     )
     !decimals-el.addEventListener change (
      ; condition { propertyIs false is-ro } (
       ; to parsed !parse-decimals-val
       !apply-decimals-state $parsed
       [ match
        { $parsed.ok (
         ; to next-decimals $parsed.value
         ; to cur-decimals !normalizeFixedDecimals $col.decimals
         [ match
          { [ propertyIs $cur-decimals next-decimals ] : ; set [ add '' $cur-decimals ] decimals-el.value }
          { true (
           ; to on-revert (
            ; set [ add '' $cur-decimals ] decimals-el.value
            ; set lane-data-decimals-input decimals-el.className
            ; set 'Decimal places (0–12)' decimals-el.title
            !decimals-el.setAttribute aria-invalid 'false'
           )
           !view.request-column-change $tbl $col $col.type $col.multiple $next-decimals $on-revert
          ) }
         ]
        ) }
       ]
      )
     )
     !constraint-add-el.addEventListener change (
      ; condition { propertyIs false is-ro } (
       ; to picked $constraint-add-el.value
       ; set '' constraint-add-el.value
       ; to new-c [ match
        { $createDefaultColumnConstraint : !createDefaultColumnConstraint $picked $col.type }
        { true : null }
       ]
       [ match
        { $new-c (
         ; to latest-all !normalizeColumnConstraints $col $col.type $col.decimals
         !latest-all.push $new-c
         !view.set-col-constraints $col $latest-all
         !view.render-schema
         !view.render-grid
         !view.save-schema $tbl
        ) }
       ]
      )
     )
     !multi-btn.addEventListener click (
      ; condition { propertyIs false is-ro } (
       ; to next-multi [ ternary $col.multiple false true ]
       !view.request-column-change $tbl $col $col $next-multi $col.decimals null
      )
     )
     !req-btn.addEventListener click (
      ; condition { propertyIs false is-ro } (
       ; to next-req [ ternary $col.required false true ]
       [ match
        { $next-req : ; set true col.required }
        { true (
         [ match
          { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col required }
          { true : ; set false col.required }
         ]
        ) }
       ]
       !view.render-schema
       !view.render-grid
       !view.save-schema $tbl
      )
     )
     !rm-btn.addEventListener click : !view.request-delete-column $tbl $srow.index

     !schema-tbody.appendChild $tr
     !view.schema-rows.push $srow
    )
   ) }
  ]
 )

 ; to view.render (
  -- Re-renders table tabs, remote origin banner, active table header, schema columns, and editable rows grid
  !view.close-table-menu
  !view.render-table-tabs
  ; set [ ternary $view.is-loading false true ] loading-el.hidden
  [ match
   { [ propertyIs true view.is-loading ] (
    ; set true empty-el.hidden
    ; set true active-el.hidden
   ) }
   { true (
    ; set false add-table-btn.disabled
    ; set false import-table-btn.disabled
    ; to tbl !view.get-active-table
    [ match
     { $tbl (
      ; set true empty-el.hidden
      ; set false active-el.hidden
      !view.render-remote-bar
      !view.ensure-table-views-state $tbl
      !view.sync-view-ui
      !view.render-schema
      !view.render-updates
      !view.render-grid
     ) }
     { true (
      ; set false empty-el.hidden
      ; set true active-el.hidden
      ; set false view.editing-view-name
      !edit-table-modal.close
      !view.close-view-menu
      !view.close-filter-menu
      !view.sync-view-ui
      !view.render-remote-bar
      !view.render-schema
      !view.render-updates
      !view.render-grid
     ) }
    ]
   ) }
  ]
 )

 ; to view.sync-data-path (
  -- Updates the lane's remembered path when currently on the Data tab
  [ match
   { [ propertyIs data lane.tab ] (
    [ match
     { $lane-control.remember-path : !lane-control.remember-path $lane }
    ]
   ) }
  ]
 )

 ; to view.find-table-by-name (
  -- Finds a table by exact name, or returns null when not found
  ; to { name } $argv
  ; to found ; object { table null }
  [ match
   { $name (
    ; each $view.tables (
     ; to { tbl } $argv
     [ match
      { $found.table : null }
      { [ propertyIs $name tbl.name ] : ; set $tbl found.table }
     ]
    )
   ) }
  ]
  $found.table
 )

 ; to view.select-table (
  -- Selects a table by ID, applies default schema visibility (collapsed when rows exist), renders, and updates lane URL
  ; to { id skip-url } $argv
  ; set false view.editing-view-name
  !edit-table-modal.close
  !view.close-view-menu
  !view.close-filter-menu
  !view.clear-pinned-rows $id
  ; set $id view.active-table-id
  ; to tbl !view.get-active-table
  ; set [ match { $tbl : $tbl.name } { true : '' } ] lane.subroute
  ; set [ !view.default-schema-open $tbl ] view.schema-open
  !view.render
  [ match
   { $skip-url : null }
   { true (
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
     !view.sync-data-path
     [ match
      { $lane-control.update-url : !lane-control.update-url }
     ]
    ) : null
    [ match
     { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
    ]
   ) }
  ]
 )

 ; to view.select-table-by-name (
  -- Selects a table by name if known, otherwise falls back to the first table
  ; to { name skip-url } $argv
  ; to matched !view.find-table-by-name $name
  ; to target [ match
   { $matched : $matched }
   { [ propertyIsGreaterThan 0 view.tables.length ] : [ get view.tables 0 ] }
   { true : null }
  ]
  [ match
   { $target : !view.select-table $target.id $skip-url }
   { true (
    ; set '' view.active-table-id
    ; set '' lane.subroute
    !view.render
   ) }
  ]
 )

 ; to view.add-table (
  -- Creates a new table, selects it, renders, focuses its name input, and saves
  ; to { name } $argv
  [ match
   { [ propertyIs true view.is-loading ] : null }
   { true (
    ; to next-num ; add $view.tables.length 1
    ; to clean-name [ match
     { [ propertyIs undefined name ] : ; add 'table_' $next-num }
     { [ propertyIs null name ] : ; add 'table_' $next-num }
     { true : ; add '' $name }
    ]
    ; to tbl [ object
     { id !view.next-id tbl }
     { name $clean-name }
     { columns {} }
     { rows {} }
    ]
    !view.tables.push $tbl
    ; set false view.editing-view-name
    !edit-table-modal.close
    !view.close-view-menu
    !view.close-filter-menu
    !view.ensure-table-views-state $tbl
    ; set $tbl.id view.active-table-id
    ; set $tbl.name lane.subroute
    ; set true view.schema-open
    !view.render
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
     ; to table-ids !collect-ids $view.tables
     !addLaneTable $data $view.lane.data $view.lane.id $tbl $table-ids
     !view.sync-data-path
     [ match
      { $lane-control.update-url : !lane-control.update-url }
     ]
    ) : null
    [ match
     { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
    ]
    $tbl
   ) }
  ]
 )

 ; to view.add-column (
  -- Adds a new column to the active table, seeds default values on existing rows, renders, and saves
  ; to { name type multiple decimals required } $argv
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to is-ro !view.is-readonly-table $tbl
    ; condition { propertyIs false is-ro } (
     ; to clean-name [ match
      { [ propertyIs undefined name ] : '' }
      { [ propertyIs null name ] : '' }
      { true : ; add '' $name }
     ]
     ; to parsed !parseColumnType $type $multiple $decimals
     ; to col [ match
      { [ propertyIs fixed parsed.type ] [ object
       { id !view.next-id col }
       { name $clean-name }
       { type $parsed.type }
       { multiple $parsed.multiple }
       { decimals $parsed.decimals }
      ] }
      { [ propertyIs row parsed.type ] (
       ; to row-col [ object
        { id !view.next-id col }
        { name $clean-name }
        { type $parsed.type }
        { multiple $parsed.multiple }
        { refTableId $parsed.refTableId }
        { refColumnId $parsed.refColumnId }
        { refDisplayColumnId $parsed.refDisplayColumnId }
       ]
       [ match
        { $parsed.refFilterColumnId : ; set $parsed.refFilterColumnId row-col.refFilterColumnId }
       ]
       [ match
        { $parsed.filterByColumnId : ; set $parsed.filterByColumnId row-col.filterByColumnId }
       ]
       $row-col
      ) }
      { true [ object
       { id !view.next-id col }
       { name $clean-name }
       { type $parsed.type }
       { multiple $parsed.multiple }
      ] }
     ]
     ; condition { and { $parsed.constraints } { [ propertyIsGreaterThan 0 parsed.constraints.length ] } } : !view.set-col-constraints $col $parsed.constraints
     ; condition { propertyIs true required } : ; set true col.required
     !tbl.columns.push $col
     ; each $tbl.rows (
      ; to { row } $argv
      ; to def-val !defaultDataValue $col
      ; to row.values $col.id $def-val
     )
     [ match
      { [ and { [ propertyIs lane col.type ] } { $lane-control.load-catalog } ] : !lane-control.load-catalog }
     ]
     ; set true view.schema-open
     !view.sync-view-ui
     !view.render-schema
     !view.render-grid
     ; to last-idx ; subtract $view.schema-rows.length 1
     ; to last-srow [ get view.schema-rows $last-idx ]
     [ match
      { $last-srow.name-el.focus : !last-srow.name-el.focus }
     ]
     !view.save-schema-and-rows $tbl
     $col
    )
   ) }
  ]
 )

 ; to view.add-row (
  -- Appends a new editable row with default typed values for every column in the active table
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to is-ro !view.is-readonly-table $tbl
    ; condition { and { [ propertyIs false is-ro ] } { [ propertyIsGreaterThan 0 tbl.columns.length ] } } (
     ; to values ; object
     ; each $tbl.columns (
      ; to { col } $argv
      ; to def-val !defaultDataValue $col
      ; to values $col.id $def-val
     )
     ; to row [ object
      { id !view.next-id row }
      { values $values }
     ]
     !tbl.rows.push $row
     !view.pin-row-id $tbl.id $row.id
     !view.render-grid
     !view.update-table-tabs-text
     [ match
      { [ propertyIsGreaterThan 0 view.grid-rows.length ] (
       ; to last-idx ; subtract $view.grid-rows.length 1
       ; to last-grow [ get view.grid-rows $last-idx ]
       ; to first-cell [ get last-grow.cells 0 ]
       [ match
        { $first-cell.input-el.focus : !first-cell.input-el.focus }
        { $first-cell.add-btn.focus : !first-cell.add-btn.focus }
       ]
      ) }
     ]
     ; to row-ids !collect-ids $tbl.rows
     !addTableRow $data $view.lane.data $view.lane.id $tbl $row $row-ids
     !view.notify-record-change $tbl $row add-row
     $row
    )
   ) }
  ]
 )

 !add-table-btn.addEventListener click : !view.add-table
 !import-table-btn.addEventListener click : !view.open-import-modal
 !remote-jump-btn.addEventListener click : !view.jump-to-owner-table
 !remote-edit-btn.addEventListener click : !view.open-edit-import null
 !jump-owner-btn.addEventListener click : !view.jump-to-owner-table
 !edit-import-btn.addEventListener click : !view.open-edit-import null
 !edit-table-btn.addEventListener click (
  ; to { ev } $argv
  [ match { $ev.stopPropagation : !ev.stopPropagation } ]
  !view.open-edit-table-modal
 )
 !edit-table-close-btn.addEventListener click $edit-table-modal.close
 !edit-table-cancel-btn.addEventListener click $edit-table-modal.close
 !edit-table-save-btn.addEventListener click $edit-table-modal.save
 !edit-table-form.addEventListener submit (
  ; to { ev } $argv
  [ match { $ev.preventDefault : !ev.preventDefault } ]
  !edit-table-modal.save
 )
 !edit-table-backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $edit-table-backdrop ev.target } : !edit-table-modal.close
 )
 !edit-table-name-input.addEventListener input (
  ; set '' edit-table-error-el.textContent
  ; set true edit-table-error-el.hidden
 )
 !edit-table-name-input.addEventListener keydown (
  ; to { ev } $argv
  [ match
   { [ propertyIs Enter ev.key ] (
    [ match { $ev.preventDefault : !ev.preventDefault } ]
    [ match { $ev.stopPropagation : !ev.stopPropagation } ]
    !edit-table-modal.save
   ) }
   { [ propertyIs Escape ev.key ] (
    [ match { $ev.preventDefault : !ev.preventDefault } ]
    [ match { $ev.stopPropagation : !ev.stopPropagation } ]
    !edit-table-modal.close
   ) }
  ]
 )
 !view-btn.addEventListener click (
  ; to { ev } $argv
  [ match { $ev.stopPropagation : !ev.stopPropagation } ]
  !view.toggle-view-menu
 )
 !view-menu.addEventListener click (
  ; to { ev } $argv
  [ match { $ev.stopPropagation : !ev.stopPropagation } ]
 )
 !view-title-btn.addEventListener click (
  ; to { ev } $argv
  [ match { $ev.stopPropagation : !ev.stopPropagation } ]
  !view.open-edit-view-name
 )
 !view-save-btn.addEventListener click : !view.save-active-view
 !view-fork-btn.addEventListener click : !view.fork-active-view
 !view-abandon-btn.addEventListener click : !view.abandon-view-changes
 !view-new-btn.addEventListener click : !view.create-new-view
 !view-duplicate-btn.addEventListener click : !view.duplicate-active-view
 !view-reset-btn.addEventListener click : !view.reset-active-view
 !view-delete-btn.addEventListener click : !view.request-delete-view
 !view-rename-btn.addEventListener click : !view.rename-active-view
 !view-rename-cancel-btn.addEventListener click (
  ; to { ev } $argv
  [ match { $ev.stopPropagation : !ev.stopPropagation } ]
  !view.cancel-edit-view-name
 )
 !view-rename-input.addEventListener keydown (
  ; to { ev } $argv
  [ match
   { [ propertyIs Enter ev.key ] (
    [ match { $ev.preventDefault : !ev.preventDefault } ]
    !view.rename-active-view
   ) }
   { [ propertyIs Escape ev.key ] (
    [ match { $ev.stopPropagation : !ev.stopPropagation } ]
    !view.cancel-edit-view-name
   ) }
  ]
 )
 !filter-menu.addEventListener click (
  ; to { ev } $argv
  [ match { $ev.stopPropagation : !ev.stopPropagation } ]
 )
 !filter-op-select.addEventListener change (
  ; to tbl !view.get-active-table
  ; to col-box ; object { col null }
  [ match
   { $tbl (
    ; each $tbl.columns (
     ; to { candidate } $argv
     ; condition { propertyIs $view.filter-editor.column-id candidate.id } : ; set $candidate col-box.col
    )
   ) }
  ]
  ; to col $col-box.col
  [ match
   { [ and { $tbl } { $col } ] (
    ; to next-op $filter-op-select.value
    ; to prev-kind $view.filter-editor.input-kind
    ; to ops [ match
     { $getFilterOperatorsForColumn : !getFilterOperatorsForColumn $col $view.tables }
     { true : {} }
    ]
    ; to desc-box ; object { desc null }
    ; each $ops (
     ; to { item } $argv
     ; condition { propertyIs $next-op item.op } : ; set $item desc-box.desc
    )
    ; to next-desc $desc-box.desc
    ; to same-kind [ match
     { [ and { $next-desc } { [ propertyIs $prev-kind next-desc.inputKind ] } ] : true }
     { true : false }
    ]
    ; to keep1 [ match
     { [ and { [ propertyIs true same-kind ] } { $view.filter-val-el } ] : $view.filter-val-el.value }
     { true : '' }
    ]
    ; to keep2 [ match
     { [ and { [ propertyIs true same-kind ] } { $view.filter-val-to-el } ] : $view.filter-val-to-el.value }
     { true : '' }
    ]
    !view.render-filter-value-inputs $tbl $col $next-op $keep1 $keep2
    [ match
     { [ and { $view.filter-val-el } { $view.filter-val-el.focus } ] : !view.filter-val-el.focus }
    ]
   ) }
  ]
 )
 !filter-apply-btn.addEventListener click : !view.apply-filter-editor
 !filter-cancel-btn.addEventListener click : !view.close-filter-menu
 !filter-delete-btn.addEventListener click : !view.delete-editing-filter
 !schema-toggle-btn.addEventListener click (
  !view.close-table-menu
  ; set [ ternary $view.schema-open false true ] view.schema-open
  !view.render-schema
 )
 !table-menu-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !view.toggle-table-menu
 )
 !add-col-btn.addEventListener click : !view.add-column '' text false
 !add-row-btn.addEventListener click $view.add-row
 !clear-rows-btn.addEventListener click $view.request-clear-rows
 !delete-table-btn.addEventListener click $view.request-delete-table
 [ match
  { $document.addEventListener (
   !document.addEventListener click (
    ; to { ev } $argv
    ; to target [ match { $ev.target : $ev.target } { true : null } ]
    ; condition { propertyIs true view.table-menu-open } (
     ; to inside-tmenu [ match
      { [ propertyIs null target ] : false }
      { [ propertyIs $table-menu-wrap target ] : true }
      { [ propertyIs $table-menu-btn target ] : true }
      { [ propertyIs $table-menu target ] : true }
      { [ propertyIs $edit-table-btn target ] : true }
      { [ propertyIs $jump-owner-btn target ] : true }
      { [ propertyIs $edit-import-btn target ] : true }
      { [ propertyIs $clear-rows-btn target ] : true }
      { [ propertyIs $delete-table-btn target ] : true }
      { $table-menu-wrap.contains : !table-menu-wrap.contains $target }
      { true : false }
     ]
     ; condition { propertyIs false inside-tmenu } : !view.close-table-menu
    )
    ; condition { propertyIs true view.view-menu-open } (
     ; to inside-vmenu [ match
      { [ propertyIs null target ] : false }
      { [ propertyIs $view-wrap target ] : true }
      { [ propertyIs $view-btn target ] : true }
      { [ propertyIs $view-menu target ] : true }
      { [ propertyIs $view-title-btn target ] : true }
      { [ propertyIs $view-title-text target ] : true }
      { [ propertyIs $view-title-hint target ] : true }
      { [ propertyIs $view-rename-input target ] : true }
      { [ propertyIs $view-rename-btn target ] : true }
      { [ propertyIs $view-rename-cancel-btn target ] : true }
      { [ propertyIs $view-save-btn target ] : true }
      { [ propertyIs $view-fork-btn target ] : true }
      { [ propertyIs $view-abandon-btn target ] : true }
      { [ propertyIs $view-new-btn target ] : true }
      { [ propertyIs $view-duplicate-btn target ] : true }
      { [ propertyIs $view-reset-btn target ] : true }
      { [ propertyIs $view-delete-btn target ] : true }
      { $view-wrap.contains : !view-wrap.contains $target }
      { true : false }
     ]
     ; condition { propertyIs false inside-vmenu } : !view.close-view-menu
    )
    ; condition { propertyIs true view.filter-editor.open } (
     ; to inside-fmenu [ match
      { [ propertyIs null target ] : false }
      { [ propertyIs $filter-menu target ] : true }
      { [ propertyIs $filter-op-select target ] : true }
      { [ propertyIs $filter-apply-btn target ] : true }
      { [ propertyIs $filter-cancel-btn target ] : true }
      { [ propertyIs $filter-delete-btn target ] : true }
      { $filter-menu.contains : !filter-menu.contains $target }
      { true : false }
     ]
     ; condition { propertyIs false inside-fmenu } : !view.close-filter-menu
    )
   )
  ) }
 ]
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs Escape ev.key } (
     [ match
      { [ propertyIs true edit-table-modal.is-open ] : !edit-table-modal.close }
      { [ propertyIs true view.filter-editor.open ] : !view.close-filter-menu }
      { [ propertyIs true view.view-menu-open ] [ match
       { [ propertyIs true view.editing-view-name ] : !view.cancel-edit-view-name }
       { true : !view.close-view-menu }
      ] }
      { [ propertyIs true view.table-menu-open ] : !view.close-table-menu }
     ]
    )
   )
  ) }
 ]

 ; try (
  ; to load-opts [ match
   { $lane-control.open-package-ids : [ object { openPackageIds $lane-control.open-package-ids } ] }
   { true : ; object }
  ]
  ; to initial-tables !loadLaneTables $data $lane.data $lane.id $load-opts
  ; to needs-catalog ; object { hit false }
  ; each $initial-tables (
   ; to { tbl } $argv
   ; to view.used-ids $tbl.id true
   ; to is-rem !view.is-remote-table $tbl
   ; condition { propertyIs true is-rem } : ; set true needs-catalog.hit
   ; each $tbl.columns (
    ; to { col } $argv
    ; to view.used-ids $col.id true
    ; condition { propertyIs lane col.type } : ; set true needs-catalog.hit
   )
   ; each $tbl.rows (
    ; to { row } $argv
    ; to view.used-ids $row.id true
   )
   [ match
    { $loadTableUpdates (
     ; to loaded-upds !loadTableUpdates $data $lane.data $lane.id $tbl.id
     ; to view.table-updates $tbl.id $loaded-upds
    ) }
   ]
   [ match
    { $loadTableViews (
     ; to loaded-views !loadTableViews $data $lane.data $lane.id $tbl.id $tbl.columns $initial-tables
     ; to active-box ; object { v null }
     ; each $loaded-views.views (
      ; to { lv } $argv
      ; condition { propertyIs $loaded-views.activeViewId lv.id } : ; set $lv active-box.v
     )
     [ match
      { [ and { [ propertyIs null active-box.v ] } { [ propertyIsGreaterThan 0 loaded-views.views.length ] } ] : ; set [ get loaded-views.views 0 ] active-box.v }
     ]
     ; to wf !clone-plain-data [ match { $active-box.v.filters : $active-box.v.filters } { true : {} } ] {}
     ; to view-st [ object
      { activeViewId $loaded-views.activeViewId }
      { views $loaded-views.views }
      { workingFilters $wf }
     ]
     !view.register-views-used-ids $view-st
     ; to view.table-views $tbl.id $view-st
    ) }
   ]
   !view.tables.push $tbl
  )
  [ match
   { $needs-catalog.hit [ match
    { $lane-control.load-catalog : !lane-control.load-catalog }
   ] }
  ]
  ; condition { propertyIsGreaterThan 0 view.tables.length } (
   ; to matched-tbl !view.find-table-by-name $lane.subroute
   ; to initial-tbl [ match
    { $matched-tbl : $matched-tbl }
    { true : [ get view.tables 0 ] }
   ]
   ; set $initial-tbl.id view.active-table-id
   ; set $initial-tbl.name lane.subroute
   ; set [ !view.default-schema-open $initial-tbl ] view.schema-open
  )
 ) : null
 ; set false view.is-loading
 ; set false add-table-btn.disabled
 ; set false import-table-btn.disabled
 !view.render
 $view
)
$scope
