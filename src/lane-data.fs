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
  { active-table-id '' }
  { schema-open true }
  { table-menu-open false }
  { id-seq 0 }
  { used-ids ; object }
  { table-tabs {} }
  { schema-rows {} }
  { grid-head-cells {} }
  { grid-rows {} }
  { display-options-btns {} }
  { subtable-group-collapsed ; object }
  { table-updates ; object }
  { update-rows {} }
  { on-record-change null }
 ]

 ; to bar-el !document.createElement div
 ; set lane-data-bar bar-el.className
 ; to tabs-el !document.createElement div
 ; set lane-data-table-tabs tabs-el.className
 ; to add-table-btn !document.createElement button
 ; assign $add-table-btn { type button } { className lane-data-add-table } { textContent '+ Table' } { title 'Create a new table' }
 !bar-el.appendChild $tabs-el
 !bar-el.appendChild $add-table-btn

 ; to empty-el !document.createElement div
 ; assign $empty-el { className lane-data-empty } { textContent 'No tables yet. Create a table to define columns and add rows.' }

 ; to active-el !document.createElement div
 ; set lane-data-active active-el.className
 ; set true active-el.hidden

 ; to table-header-el !document.createElement div
 ; set lane-data-table-header table-header-el.className
 ; to table-name-input !document.createElement input
 ; assign $table-name-input { type text } { className lane-data-table-name } { placeholder 'table_name' } { spellcheck false } { autocomplete off }
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
 ; to clear-rows-btn !document.createElement button
 ; assign $clear-rows-btn { type button } { className 'lane-data-table-menu-item lane-data-clear-rows' } { textContent 'Clear rows' } { title 'Delete all rows in this table' }
 !clear-rows-btn.setAttribute role menuitem
 ; to delete-table-btn !document.createElement button
 ; assign $delete-table-btn { type button } { className 'lane-data-table-menu-item lane-data-delete-table' } { textContent 'Delete table' } { title 'Delete this table' }
 !delete-table-btn.setAttribute role menuitem
 !table-menu.appendChild $clear-rows-btn
 !table-menu.appendChild $delete-table-btn
 !table-menu-wrap.appendChild $table-menu-btn
 !table-menu-wrap.appendChild $table-menu
 !header-actions-el.appendChild $schema-toggle-btn
 !header-actions-el.appendChild $table-menu-wrap
 !table-header-el.appendChild $table-name-input
 !table-header-el.appendChild $header-actions-el

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
 !grid-thead.appendChild $grid-hrow
 ; to grid-tbody !document.createElement tbody
 ; set lane-data-grid-body grid-tbody.className
 !grid-table.appendChild $grid-thead
 !grid-table.appendChild $grid-tbody
 !grid-wrap.appendChild $display-options-el
 !grid-wrap.appendChild $grid-table

 ; to rows-empty-el !document.createElement div
 ; assign $rows-empty-el { className lane-data-subempty } { textContent 'Add at least one column to start entering rows.' }

 !rows-section.appendChild $rows-header
 !rows-section.appendChild $grid-wrap
 !rows-section.appendChild $rows-empty-el

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

 !active-el.appendChild $table-header-el
 !active-el.appendChild $schema-section
 !active-el.appendChild $updates-section
 !active-el.appendChild $rows-section

 !root-el.appendChild $bar-el
 !root-el.appendChild $empty-el
 !root-el.appendChild $active-el
 !container.appendChild $root-el

 ; assign $view { element $root-el } { bar-el $bar-el } { tabs-el $tabs-el } { add-table-btn $add-table-btn } { empty-el $empty-el } { active-el $active-el } { table-name-input $table-name-input } { header-actions-el $header-actions-el } { schema-toggle-btn $schema-toggle-btn } { table-menu-wrap $table-menu-wrap } { table-menu-btn $table-menu-btn } { table-menu $table-menu } { clear-rows-btn $clear-rows-btn } { delete-table-btn $delete-table-btn } { schema-section $schema-section } { schema-tbody $schema-tbody } { schema-empty-el $schema-empty-el } { add-col-btn $add-col-btn } { updates-section $updates-section } { updates-header $updates-header } { updates-title-wrap $updates-title-wrap } { updates-title $updates-title } { updates-count-badge $updates-count-badge } { updates-status-badge $updates-status-badge } { updates-caption $updates-caption } { updates-list $updates-list } { rows-section $rows-section } { rows-title $rows-title } { add-row-btn $add-row-btn } { grid-wrap $grid-wrap } { display-options-el $display-options-el } { display-options-label $display-options-label } { display-options-list $display-options-list } { grid-hrow $grid-hrow } { grid-tbody $grid-tbody } { rows-empty-el $rows-empty-el }

 ; to view.close-table-menu (
  -- Closes the "..." table actions dropdown menu
  ; set false view.table-menu-open
  ; set true table-menu.hidden
  ; set 'lane-data-btn lane-data-table-menu-btn' table-menu-btn.className
  !table-menu-btn.setAttribute aria-expanded 'false'
 )

 ; to view.open-table-menu (
  -- Opens the "..." table actions dropdown menu
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

 ; to view.save (
  -- Persists all tables (schemas and rows) across split per-table and per-row KV keys
  !saveLaneTables $data $view.lane.data $view.lane.id $view.tables
 )

 ; to view.notify-record-change (
  -- Notifies the owning notebook when a record in a table is added, updated, deleted, or cleared
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
  -- Persists a single table row to its own KV key and notifies listeners of the record change
  ; to { tbl row } $argv
  !saveTableRow $data $view.lane.data $view.lane.id $tbl.id $row
  !view.notify-record-change $tbl $row update-row
 )

 ; to view.save-schema (
  -- Persists a single table schema (name and columns) to its own KV key
  ; to { tbl } $argv
  !saveTableSchema $data $view.lane.data $view.lane.id $tbl
 )

 ; to view.save-schema-and-rows (
  -- Persists a single table schema and its rows after a structural column change
  ; to { tbl } $argv
  !saveTableSchemaAndRows $data $view.lane.data $view.lane.id $tbl
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
  -- Updates pill labels and row count badges without full re-render
  ; each $view.tables (
   ; to { tbl idx } $argv
   ; to tab [ get view.table-tabs $idx ]
   [ match
    { $tab (
     ; to label !view.display-table-name $tbl $idx
     ; set $label tab.label-el.textContent
     ; set $tbl.rows.length tab.count-el.textContent
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
   ; to btn !document.createElement button
   ; to cls [ ternary $is-active 'lane-data-table-tab lane-data-table-tab--active' lane-data-table-tab ]
   ; assign $btn { type button } { className $cls }
   !btn.setAttribute aria-selected [ ternary $is-active 'true' 'false' ]
   ; to label-el !document.createElement span
   ; assign $label-el { className lane-data-table-tab-label } { textContent !view.display-table-name $tbl $idx }
   ; to count-el !document.createElement span
   ; assign $count-el { className lane-data-table-tab-count } { textContent $tbl.rows.length }
   !btn.appendChild $label-el
   !btn.appendChild $count-el
   !btn.addEventListener click : !view.select-table $tbl.id
   !tabs-el.appendChild $btn
   ; to tab-rec ; object { id $tbl.id } { el $btn } { label-el $label-el } { count-el $count-el }
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

 ; to view.refresh-row-cells (
  -- Re-evaluates row-type cell triggers in a row when any column value in that row changes
  ; to { row } $argv
  [ match
   { $row (
    ; to refresh-cells-in-grow (
     ; to { target-tbl grow } $argv
     ; condition { propertyIs $row.id grow.row.id } (
      ; each $grow.cells (
       ; to { cell } $argv
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
          !view.apply-multi-filter $target-tbl $grow.row $cell.col $cell
         ) }
         { $cell.update-trigger : !cell.update-trigger $val }
        ]
       )
      )
     )
    )
    ; to active-tbl !view.get-active-table
    ; each $view.grid-rows (
     ; to { grow } $argv
     !refresh-cells-in-grow $active-tbl $grow
     [ match
      { $grow.subtable-groups (
       ; each $grow.subtable-groups (
        ; to { sgrp } $argv
        ; each $sgrp.rows (
         ; to { sgrow } $argv
         !refresh-cells-in-grow $sgrp.table $sgrow
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
  -- Re-renders lane cell trigger labels across the active table grid after a lane rename or reload
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
  ; to { col initial-val on-valid on-enter owner-tbl owner-row on-open-picker } $argv
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
    )
    !update-trigger $initial-val

    !trigger-btn.addEventListener click (
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
         { on-create-row (
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
          !addTableRow $data $view.lane.data $view.lane.id $target.table.id $new-row $row-ids
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
         ) }
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
     ; to trig-disabled [ ternary $has-picker false true ]
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
    )
    !update-trigger $initial-val

    !trigger-btn.addEventListener click (
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
   { [ propertyIs boolean col.type ] (
    ; to wrap !document.createElement label
    ; set lane-data-bool-wrap wrap.className
    ; to cb !document.createElement input
    ; assign $cb { type checkbox } { className lane-data-bool-input }
    ; to bool-val !formatCellInputValue $initial-val boolean
    ; set $bool-val cb.checked
    ; to txt !document.createElement span
    ; assign $txt { className lane-data-bool-label } { textContent [ ternary $bool-val 'true' 'false' ] }
    !wrap.appendChild $cb
    !wrap.appendChild $txt
    !cb.addEventListener change (
     ; to next-bool [ ternary $cb.checked true false ]
     ; set [ ternary $next-bool 'true' 'false' ] txt.textContent
     !$on-valid $next-bool
    )
    ; object { el $wrap } { input-el $cb } { label-el $txt }
   ) }
   { [ match { [ propertyIs text col.type ] : !normalizeColumnConstraint $col.constraint } { true : null } ] (
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
    )
    !render-options $initial-val
    !select-el.addEventListener change (
     ; to next-val $select-el.value
     !render-options $next-val
     !$on-valid $next-val
    )
    ; object { el $select-el } { input-el $select-el } { select-el $select-el } { option-els $ctrl-state.option-els } { render-options $render-options }
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

    ; to update-datetime (
     ; to { next-val } $argv
     ; set $next-val ctrl-state.value
     ; set true ctrl-state.valid
     ; to copts !view.get-clock-display-opts
     ; to next-ph !resolve-placeholder $copts
     ; set $next-ph input-el.placeholder
     !sync-picker-title $copts
     ; to is-focused [ match
      { $document.activeElement : [ propertyIs $input-el document.activeElement ] }
      { true : false }
     ]
     ; to aria-inv [ match
      { $input-el.getAttribute : !input-el.getAttribute aria-invalid }
      { true : 'false' }
     ]
     ; to keep-editing [ and { propertyIs true is-focused } { propertyIs 'true' aria-inv } ]
     [ match
      { $keep-editing : null }
      { true (
       ; to next-fmt !formatCellInputValue $next-val $col undefined $view.tables $copts
       ; set $next-fmt input-el.value
       !apply-input-state true $next-val ''
      ) }
     ]
    )
    ; to handle-edit (
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
    !native-picker.addEventListener change (
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
    ; to input-type [ match
     { [ propertyIs integer col.type ] : number }
     { [ propertyIs decimal col.type ] : number }
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
     { [ propertyIs integer col.type ] : !input-el.setAttribute step '1' }
     { [ propertyIs decimal col.type ] : !input-el.setAttribute step any }
     { [ propertyIs fixed col.type ] : !input-el.setAttribute inputmode decimal }
    ]
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
      { true (
       ; set '' input-el.title
       !input-el.setAttribute aria-invalid 'false'
      ) }
     ]
     ; set $cls input-el.className
    )
    !apply-input-state true $initial-val ''
    ; to handle-edit (
     ; to parsed !parseCellValue $input-el.value $col
     [ match
      { $parsed.ok (
       !apply-input-state true $parsed.value ''
       !$on-valid $parsed.value
      ) }
      { true (
       !apply-input-state false null $parsed.error
      ) }
     ]
    )
    !input-el.addEventListener input $handle-edit
    [ match
     { [ propertyIs date col.type ] : !input-el.addEventListener change $handle-edit }
     { [ propertyIs datetime col.type ] : !input-el.addEventListener change $handle-edit }
     { [ propertyIs fixed col.type ] (
      !input-el.addEventListener blur (
       ; to parsed !parseCellValue $input-el.value $col
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
    ; object { el $input-el } { input-el $input-el }
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
   { [ match { [ propertyIs text col.type ] : !normalizeColumnConstraint $col.constraint } { true : null } ] (
    ; to wf-target !resolveWorkflowTarget $view.tables $col
    [ match
     { $wf-target.valid : ; object { selectable true } { ready true } { reason '' } }
     { $wf-target.configured : ; object { selectable true } { ready false } { reason 'Workflow table or columns not found' } }
     { true : ; object { selectable true } { ready false } { reason 'Configure workflow table, From, and To columns in Schema' } }
    ]
   ) }
   { true : ; object { selectable false } { ready true } { reason '' } }
  ]
 )

 ; to view.sync-multi-add-btn (
  -- Updates the + button enabled state and tooltip on a multiple ([]) cell
  ; to { tbl col add-btn } $argv
  [ match
   { $add-btn (
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
 )

 ; to view.open-multi-select (
  -- Opens a multiselect modal (with Apply / Cancel) for a selectable multiple ([]) cell (lane[], row[], or text(workflow)[])
  ; to { tbl row row-idx col cell-rec on-row-edited } $argv
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
      { on-create-row (
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
       !addTableRow $data $view.lane.data $view.lane.id $target.table.id $new-row $row-ids
       !view.notify-record-change $target.table $new-row add-row
       ; to chosen-val [ get values $target.linkCol.id ]
       ; to after-select (
        !view.render-grid
       )
       ; object { ok true } { row $new-row } { value $chosen-val } { after-select $after-select }
      ) }
      { on-select $apply-multi-values }
     ]
     !view.row-picker.open $pick-opts
    )
   ) }
   { [ match { [ propertyIs text col.type ] : !normalizeColumnConstraint $col.constraint } { true : null } ] (
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
        !state-items.push [ object { value $fv } { valueText $fv } { displayText $fv } { hasSeparateDisplay false } { label $fv } ]
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
        !state-items.push [ object { value $tv } { valueText $tv } { displayText $tv } { hasSeparateDisplay false } { label $tv } ]
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
       ; to st-txt [ match
        { [ propertyIs undefined val ] : '' }
        { [ propertyIs null val ] : '' }
        { true : ; add '' $val }
       ]
       ; to wf-st !getWorkflowCellState $view.tables $col $st-txt
       ; object { isEmpty [ propertyIs '' st-txt ] } { valueText $st-txt } { displayText $st-txt } { hasSeparateDisplay false } { label $st-txt } { filterMatched $wf-st.isValueValid }
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

 ; to view.render-multi-cell (
  -- Renders a multiple-value ([]) cell editor with typed item inputs, confirmed removal, and + item button
  ; to { tbl row row-idx col cell-rec focus-idx } $argv
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
   ; to ctrl !view.create-typed-control $col $item-val $on-item-valid $on-item-enter $tbl $row $multi-picker-cb
   ; to rm-btn !document.createElement button
   ; assign $rm-btn { type button } { className lane-data-multi-remove } { textContent '×' } { title 'Remove item' }
   !rm-btn.addEventListener click : !view.request-remove-multi-item $tbl $row $row-idx $col $cell-rec $item-idx
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
  -- Renders the editable table headers, display options bar, and rows (plus any visible inbound subtable groups) for the active table
  ; while { propertyIsGreaterThan 0 view.grid-head-cells.length } (
   ; to old-h !view.grid-head-cells.pop
   !old-h.el.remove
  )
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
    ; to col-count $tbl.columns.length
    ; to row-count $tbl.rows.length
    ; set [ add 'Rows (' ; add $row-count ')' ] rows-title.textContent
    ; to has-cols [ propertyIsGreaterThan 0 col-count ]
    ; to has-rows [ propertyIsGreaterThan 0 row-count ]
    ; set [ ternary $has-cols false true ] add-row-btn.disabled
    ; set [ ternary $has-rows false true ] clear-rows-btn.disabled
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
        { [ propertyIs text col.type ] (
         ; to wf-target !resolveWorkflowTarget $view.tables $col
         [ match
          { [ propertyIs false wf-target.active ] : null }
          { $wf-target.valid (
           ; to wf-title ; add 'Workflow: ' ; add $wf-target.tableName ; add ' (' ; add $wf-target.fromColName ; add ' → ' ; add $wf-target.toColName ')'
           ; set $wf-title type-span.title
          ) }
          { true : ; set 'Workflow constraint not configured' type-span.title }
         ]
        ) }
        { [ propertyIs lane col.type ] : ; set 'Stores a selected lane ID' type-span.title }
       ]
       ; to resizer-el !document.createElement div
       ; assign $resizer-el { className lane-data-col-resizer } { title 'Drag to resize column (double-click to reset)' }
       !resizer-el.setAttribute role separator
       !resizer-el.setAttribute aria-orientation vertical
       !resizer-el.addEventListener mousedown (
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
       !resizer-el.addEventListener dblclick (
        [ match
         { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col width }
         { true : ; set undefined col.width }
        ]
        !view.apply-column-width $col-idx null
        !view.save-schema $tbl
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

      ; to span-col-count ; add $col-count 1
      ; each $tbl.rows (
       ; to { row row-idx } $argv
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
       ; to row-num ; add $row-idx 1
       ; to num-td !document.createElement td
       ; assign $num-td { className 'lane-data-td lane-data-td--num' } { textContent $row-num }
       !tr.appendChild $num-td

       ; to cells !view.build-row-cells $tbl $row $row-idx $tr null

       ; to act-td !document.createElement td
       ; set 'lane-data-td lane-data-td--actions' act-td.className
       ; to rm-row-btn !document.createElement button
       ; assign $rm-row-btn { type button } { className lane-data-row-remove } { textContent '×' } { title 'Delete row' }
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
            ; to s-rm-btn !document.createElement button
            ; assign $s-rm-btn { type button } { className lane-data-row-remove } { textContent '×' } { title 'Delete row' }
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

      ; set $has-rows rows-empty-el.hidden
      ; set 'No rows yet. Click + Row to add data.' rows-empty-el.textContent
     ) }
     { true (
      ; set false rows-empty-el.hidden
      ; set 'Add at least one column to start entering rows.' rows-empty-el.textContent
     ) }
    ]
   ) }
  ]
 )

 ; to view.apply-column-change (
  -- Applies a confirmed column type/multiplicity/decimals/row-link change and coerces existing row values
  ; to { tbl col next-type next-multiple next-decimals } $argv
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
      !window.Reflect.deleteProperty $col refFilterColumnId
      !window.Reflect.deleteProperty $col filterByColumnId
     ) }
     { true (
      ; set undefined col.refTableId
      ; set undefined col.refColumnId
      ; set undefined col.refDisplayColumnId
      ; set undefined col.refFilterColumnId
      ; set undefined col.filterByColumnId
     ) }
    ]
   ) }
  ]
  [ match
   { [ propertyIs text next-spec.type ] [ match
    { $next-spec.constraint : ; set $next-spec.constraint col.constraint }
    { true (
     [ match
      { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col constraint }
      { true : ; set undefined col.constraint }
     ]
    ) }
   ] }
   { true (
    [ match
     { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col constraint }
     { true : ; set undefined col.constraint }
    ]
   ) }
  ]
  ; each $tbl.rows (
   ; to { row } $argv
   ; to cur [ get row.values $col.id ]
   ; to coerced !coerceDataValue $cur $next-spec $next-spec.multiple $from-spec $view.tables
   ; to row.values $col.id $coerced
  )
  !view.render-schema
  !view.render-grid
  !view.save-schema-and-rows $tbl
 )

 ; to view.request-column-change (
  -- Validates column type/multiple/decimals/row-link change and confirms when existing row data would be altered or truncated
  ; to { tbl col next-type next-multiple next-decimals on-revert } $argv
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
 )

 ; to view.request-delete-column (
  -- Prompts for confirmation before deleting a schema column and stripping its data from all rows
  ; to { tbl col-idx } $argv
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
      !view.render-schema
      !view.render-grid
      !view.save-schema-and-rows $tbl
     ) }
    ]
    !view.confirm $opts
   ) }
  ]
 )

 ; to view.request-delete-row (
  -- Prompts for confirmation before deleting a row from the active table
  ; to { tbl row-idx } $argv
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
    !view.render-grid
    !view.update-table-tabs-text
    ; to row-ids !collect-ids $tbl.rows
    [ match
     { $removed : !deleteTableRow $data $view.lane.data $view.lane.id $tbl.id $removed.id $row-ids }
     { true : !view.save-schema-and-rows $tbl }
    ]
    !view.notify-record-change $tbl $removed delete-row
   ) }
  ]
  !view.confirm $opts
 )

 ; to view.request-clear-rows (
  -- Prompts for confirmation with explicit checkbox agreement before clearing all rows from the active table
  !view.close-table-menu
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
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
      !view.render-grid
      !view.update-table-tabs-text
      !clearTableRows $data $view.lane.data $view.lane.id $tbl.id $removed-ids
      !view.notify-record-change $tbl null clear-rows
     ) }
    ]
    !view.confirm $opts
   ) }
  ]
 )

 ; to view.request-delete-table (
  -- Prompts for confirmation with explicit checkbox agreement before deleting the active table
  !view.close-table-menu
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to tbl-idx !view.tables.indexOf $tbl
    ; to tbl-label !view.display-table-name $tbl $tbl-idx
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
     { on-confirm (
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
     ) }
    ]
    !view.confirm $opts
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
    ; to col-count $tbl.columns.length
    ; to arrow [ ternary $view.schema-open '▾' '▸' ]
    ; set [ add 'Schema (' ; add $col-count ; add ') ' $arrow ] schema-toggle-btn.textContent
    ; set [ ternary $view.schema-open false true ] schema-section.hidden
    ; to has-cols [ propertyIsGreaterThan 0 col-count ]
    ; set $has-cols schema-empty-el.hidden

    ; each $tbl.columns (
     ; to { col col-idx } $argv
     ; to tr !document.createElement tr
     ; set lane-data-schema-row tr.className

     ; to name-td !document.createElement td
     ; set lane-input-cell name-td.className
     ; to name-el !document.createElement input
     ; assign $name-el { type text } { className lane-input-name } { value $col.name } { placeholder column } { spellcheck false } { autocomplete off }
     !name-td.appendChild $name-el

     ; to type-td !document.createElement td
     ; set lane-input-cell type-td.className
     ; to type-wrap !document.createElement div
     ; set lane-data-type-wrap type-wrap.className
     ; to type-el !document.createElement select
     ; set lane-input-type type-el.className
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
     ; assign $decimals-el { type number } { className lane-data-decimals-input } { value [ add '' $dec-val ] } { title 'Decimal places (0–12)' } { spellcheck false } { autocomplete off }
     !decimals-el.setAttribute min '0'
     !decimals-el.setAttribute max '12'
     !decimals-el.setAttribute step '1'
     !decimals-wrap.appendChild $decimals-label
     !decimals-wrap.appendChild $decimals-el

     ; to is-text [ propertyIs text col.type ]
     ; to cur-constraint [ match
      { $is-text : !normalizeColumnConstraint $col.constraint }
      { true : null }
     ]
     ; to has-constraint [ match { $cur-constraint : true } { true : false } ]
     ; to show-add-constraint [ match
      { $is-text : [ ternary $has-constraint false true ] }
      { true : false }
     ]
     ; to constraint-add-el !document.createElement select
     ; assign $constraint-add-el { className 'lane-input-type lane-data-constraint-add' } { hidden [ ternary $show-add-constraint false true ] } { title 'Add column constraint' }
     ; to constraint-add-placeholder !document.createElement option
     ; assign $constraint-add-placeholder { value '' } { textContent '+ constraint' }
     !constraint-add-el.appendChild $constraint-add-placeholder
     ; to constraint-add-wf !document.createElement option
     ; assign $constraint-add-wf { value workflow } { textContent Workflow }
     !constraint-add-el.appendChild $constraint-add-wf
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
        ; to t-disp !view.display-table-name $t $t-idx
        ; to opt-t !document.createElement option
        ; assign $opt-t { value $t.id } { textContent $t-disp }
        !ref-table-el.appendChild $opt-t
        ; condition { propertyIs $cur-ref-table-id t.id } (
         ; set $t sel-table-box.table
         ; set $t-disp sel-table-box.name
        )
       )
       ; to sel-table $sel-table-box.table
       ; to sel-table-name $sel-table-box.name
       ; set [ match { $sel-table : $sel-table.id } { true : '' } ] ref-table-el.value
       ; set [ ternary $sel-table 'lane-input-type lane-data-row-select' 'lane-input-type lane-data-row-select lane-data-row-select--required' ] ref-table-el.className

       ; to sel-col-box ; object { col null } { disp null } { filter-col null } { filter-by-col null }
       [ match
        { $sel-table (
         ; set false ref-col-el.disabled
         ; set false ref-display-el.disabled
         ; set false ref-filter-col-el.disabled
         ; set false filter-by-col-el.disabled
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
       ; set $hint-text row-hint-el.textContent
      ) }
     ]

     !row-config-wrap.appendChild $ref-table-field
     !row-config-wrap.appendChild $ref-col-field
     !row-config-wrap.appendChild $ref-disp-field
     !row-config-wrap.appendChild $ref-filter-field
     !row-config-wrap.appendChild $row-hint-el
     !type-td.appendChild $row-config-wrap

     ; to constraint-config-wrap !document.createElement div
     ; assign $constraint-config-wrap { className lane-data-constraint-config } { hidden [ ternary $has-constraint false true ] }

     ; to constraint-header !document.createElement div
     ; set lane-data-constraint-header constraint-header.className
     ; to constraint-title !document.createElement span
     ; assign $constraint-title { className lane-data-constraint-title } { textContent Constraint }
     ; to constraint-remove-btn !document.createElement button
     ; assign $constraint-remove-btn { type button } { className lane-data-constraint-remove } { textContent '×' } { title 'Remove constraint' }
     !constraint-header.appendChild $constraint-title
     !constraint-header.appendChild $constraint-remove-btn

     ; to constraint-type-field !document.createElement label
     ; set lane-data-row-field constraint-type-field.className
     ; to constraint-type-label !document.createElement span
     ; assign $constraint-type-label { className lane-data-row-label } { textContent Type }
     ; to constraint-type-el !document.createElement select
     ; set 'lane-input-type lane-data-row-select lane-data-constraint-type' constraint-type-el.className
     ; to constraint-type-wf !document.createElement option
     ; assign $constraint-type-wf { value workflow } { textContent Workflow }
     !constraint-type-el.appendChild $constraint-type-wf
     !constraint-type-field.appendChild $constraint-type-label
     !constraint-type-field.appendChild $constraint-type-el

     ; to constraint-table-field !document.createElement label
     ; set lane-data-row-field constraint-table-field.className
     ; to constraint-table-label !document.createElement span
     ; assign $constraint-table-label { className lane-data-row-label } { textContent Table }
     ; to constraint-table-el !document.createElement select
     ; set 'lane-input-type lane-data-row-select lane-data-constraint-table' constraint-table-el.className
     ; to constraint-table-empty !document.createElement option
     ; assign $constraint-table-empty { value '' } { textContent 'Select table…' }
     !constraint-table-el.appendChild $constraint-table-empty
     !constraint-table-field.appendChild $constraint-table-label
     !constraint-table-field.appendChild $constraint-table-el

     ; to constraint-from-field !document.createElement label
     ; set lane-data-row-field constraint-from-field.className
     ; to constraint-from-label !document.createElement span
     ; assign $constraint-from-label { className lane-data-row-label } { textContent From }
     ; to constraint-from-el !document.createElement select
     ; set 'lane-input-type lane-data-row-select lane-data-constraint-from' constraint-from-el.className
     ; to constraint-from-empty !document.createElement option
     ; assign $constraint-from-empty { value '' } { textContent 'Select column…' }
     !constraint-from-el.appendChild $constraint-from-empty
     !constraint-from-field.appendChild $constraint-from-label
     !constraint-from-field.appendChild $constraint-from-el

     ; to constraint-to-field !document.createElement label
     ; set lane-data-row-field constraint-to-field.className
     ; to constraint-to-label !document.createElement span
     ; assign $constraint-to-label { className lane-data-row-label } { textContent To }
     ; to constraint-to-el !document.createElement select
     ; set 'lane-input-type lane-data-row-select lane-data-constraint-to' constraint-to-el.className
     ; to constraint-to-empty !document.createElement option
     ; assign $constraint-to-empty { value '' } { textContent 'Select column…' }
     !constraint-to-el.appendChild $constraint-to-empty
     !constraint-to-field.appendChild $constraint-to-label
     !constraint-to-field.appendChild $constraint-to-el

     ; to constraint-hint-el !document.createElement div
     ; assign $constraint-hint-el { className lane-data-row-hint } { textContent '' }

     [ match
      { $has-constraint (
       ; set $cur-constraint.type constraint-type-el.value
       ; to cur-wf-table-id $cur-constraint.tableId
       ; to cur-wf-from-id $cur-constraint.fromColumnId
       ; to cur-wf-to-id $cur-constraint.toColumnId

       ; to sel-wf-table-box ; object { table null }
       ; each $view.tables (
        ; to { t t-idx } $argv
        ; to opt-wt !document.createElement option
        ; assign $opt-wt { value $t.id } { textContent !view.display-table-name $t $t-idx }
        !constraint-table-el.appendChild $opt-wt
        ; condition { propertyIs $cur-wf-table-id t.id } : ; set $t sel-wf-table-box.table
       )
       ; to sel-wf-table $sel-wf-table-box.table
       ; set [ match { $sel-wf-table : $sel-wf-table.id } { true : '' } ] constraint-table-el.value
       ; set [ ternary $sel-wf-table 'lane-input-type lane-data-row-select lane-data-constraint-table' 'lane-input-type lane-data-row-select lane-data-constraint-table lane-data-row-select--required' ] constraint-table-el.className

       ; to sel-wf-col-box ; object { from-col null } { to-col null }
       [ match
        { $sel-wf-table (
         ; set false constraint-from-el.disabled
         ; set false constraint-to-el.disabled
         ; each $sel-wf-table.columns (
          ; to { tc } $argv
          ; to tc-name !view.display-col-name $tc
          ; to tc-type !formatColumnType $tc undefined undefined $view.tables
          ; to tc-label ; add $tc-name ; add ' (' ; add $tc-type ')'
          ; to opt-f !document.createElement option
          ; assign $opt-f { value $tc.id } { textContent $tc-label }
          !constraint-from-el.appendChild $opt-f
          ; to opt-t2 !document.createElement option
          ; assign $opt-t2 { value $tc.id } { textContent $tc-label }
          !constraint-to-el.appendChild $opt-t2
          ; condition { propertyIs $cur-wf-from-id tc.id } : ; set $tc sel-wf-col-box.from-col
          ; condition { propertyIs $cur-wf-to-id tc.id } : ; set $tc sel-wf-col-box.to-col
         )
        ) }
        { true (
         ; set true constraint-from-el.disabled
         ; set true constraint-to-el.disabled
        ) }
       ]
       ; to sel-wf-from $sel-wf-col-box.from-col
       ; to sel-wf-to $sel-wf-col-box.to-col
       ; set [ match { $sel-wf-from : $sel-wf-from.id } { true : '' } ] constraint-from-el.value
       ; set [ match { $sel-wf-to : $sel-wf-to.id } { true : '' } ] constraint-to-el.value
       ; set [ ternary $sel-wf-from 'lane-input-type lane-data-row-select lane-data-constraint-from' 'lane-input-type lane-data-row-select lane-data-constraint-from lane-data-row-select--required' ] constraint-from-el.className
       ; set [ ternary $sel-wf-to 'lane-input-type lane-data-row-select lane-data-constraint-to' 'lane-input-type lane-data-row-select lane-data-constraint-to lane-data-row-select--required' ] constraint-to-el.className

       ; to wf-hint-text [ match
        { [ propertyIs null sel-wf-table ] : 'Select workflow table (required)' }
        { [ propertyIs null sel-wf-from ] [ match
         { [ propertyIs null sel-wf-to ] : 'Select From and To columns (required)' }
         { true : 'Select From column (required)' }
        ] }
        { [ propertyIs null sel-wf-to ] : 'Select To column (required)' }
        { true (
         ; to wf-info !resolveWorkflowTarget $view.tables $col
         ; to unit [ ternary [ propertyIs 1 wf-info.transitionCount ] transition transitions ]
         ; add $wf-info.tableName ; add ' (' ; add $wf-info.fromColName ; add ' → ' ; add $wf-info.toColName ; add ') · ' ; add $wf-info.transitionCount ; add ' ' $unit
        ) }
       ]
       ; set $wf-hint-text constraint-hint-el.textContent
      ) }
     ]

     !constraint-config-wrap.appendChild $constraint-header
     !constraint-config-wrap.appendChild $constraint-type-field
     !constraint-config-wrap.appendChild $constraint-table-field
     !constraint-config-wrap.appendChild $constraint-from-field
     !constraint-config-wrap.appendChild $constraint-to-field
     !constraint-config-wrap.appendChild $constraint-hint-el
     !type-td.appendChild $constraint-config-wrap

     ; to multi-td !document.createElement td
     ; set 'lane-input-cell lane-data-cell--multi' multi-td.className
     ; to multi-btn !document.createElement button
     ; to is-multi [ ternary $col.multiple true false ]
     ; to multi-cls [ ternary $is-multi 'lane-data-multi-toggle lane-data-multi-toggle--active' lane-data-multi-toggle ]
     ; to fmt-title ; add 'Multiple values: ' !formatColumnType $col $is-multi undefined $view.tables
     ; assign $multi-btn { type button } { className $multi-cls } { textContent '[]' } { title $fmt-title }
     !multi-btn.setAttribute aria-pressed [ ternary $is-multi 'true' 'false' ]
     !multi-td.appendChild $multi-btn

     ; to req-td !document.createElement td
     ; set 'lane-input-cell lane-data-cell--req' req-td.className
     ; to req-btn !document.createElement button
     ; to is-req [ ternary $col.required true false ]
     ; to req-cls [ ternary $is-req 'lane-data-req-toggle lane-data-req-toggle--active' lane-data-req-toggle ]
     ; to req-title [ ternary $is-req 'Required: yes' 'Required: no' ]
     ; assign $req-btn { type button } { className $req-cls } { textContent '*' } { title $req-title }
     !req-btn.setAttribute aria-pressed [ ternary $is-req 'true' 'false' ]
     !req-td.appendChild $req-btn

     ; to act-td !document.createElement td
     ; set 'lane-input-cell lane-input-cell--actions' act-td.className
     ; to rm-btn !document.createElement button
     ; assign $rm-btn { type button } { className lane-input-remove } { textContent '×' } { title 'Delete column' }
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
      { constraint-config-wrap $constraint-config-wrap }
      { constraint-remove-btn $constraint-remove-btn }
      { constraint-type-el $constraint-type-el }
      { constraint-table-el $constraint-table-el }
      { constraint-from-el $constraint-from-el }
      { constraint-to-el $constraint-to-el }
      { constraint-hint-el $constraint-hint-el }
      { row-config-wrap $row-config-wrap }
      { ref-table-el $ref-table-el }
      { ref-col-el $ref-col-el }
      { ref-display-el $ref-display-el }
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
     !name-el.addEventListener keydown (
      ; to { ev } $argv
      ; condition { propertyIs Enter ev.key } (
       [ match
        { $ev.preventDefault : !ev.preventDefault }
       ]
       !view.add-column '' text false
      )
     )
     !type-el.addEventListener change (
      ; to next-type !normalizeDataColumnType $type-el.value
      ; to next-spec [ match
       { [ propertyIs fixed next-type ] [ object
        { type fixed }
        { multiple $col.multiple }
        { decimals !normalizeFixedDecimals $col.decimals }
       ] }
       { [ propertyIs row next-type ] [ object
        { type row }
        { multiple $col.multiple }
        { refTableId [ match { $col.refTableId : $col.refTableId } { true : '' } ] }
        { refColumnId [ match { $col.refColumnId : $col.refColumnId } { true : '' } ] }
        { refDisplayColumnId [ match { $col.refDisplayColumnId : $col.refDisplayColumnId } { true : '' } ] }
        { refFilterColumnId [ match { $col.refFilterColumnId : $col.refFilterColumnId } { true : '' } ] }
        { filterByColumnId [ match { $col.filterByColumnId : $col.filterByColumnId } { true : '' } ] }
       ] }
       { true [ object
        { type $next-type }
        { multiple $col.multiple }
       ] }
      ]
      ; to on-revert (
       ; set $col.type type-el.value
      )
      !view.request-column-change $tbl $col $next-spec $col.multiple $next-spec.decimals $on-revert
     )
     !ref-table-el.addEventListener change (
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
     !ref-col-el.addEventListener change (
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
     !ref-display-el.addEventListener change (
      ; set $ref-display-el.value col.refDisplayColumnId
      !view.render-schema
      !view.render-grid
      !view.save-schema $tbl
     )
     !ref-filter-col-el.addEventListener change (
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
     !filter-by-col-el.addEventListener change (
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
     !decimals-el.addEventListener change (
      ; to next-decimals !normalizeFixedDecimals $decimals-el.value
      ; to cur-decimals !normalizeFixedDecimals $col.decimals
      [ match
       { [ propertyIs $cur-decimals next-decimals ] : ; set [ add '' $cur-decimals ] decimals-el.value }
       { true (
        ; to on-revert (
         ; set [ add '' $cur-decimals ] decimals-el.value
        )
        !view.request-column-change $tbl $col $col.type $col.multiple $next-decimals $on-revert
       ) }
      ]
     )
     !constraint-add-el.addEventListener change (
      ; to picked $constraint-add-el.value
      ; set '' constraint-add-el.value
      [ match
       { [ propertyIs workflow picked ] (
        ; to next-constraint [ object
         { type workflow }
         { tableId '' }
         { fromColumnId '' }
         { toColumnId '' }
        ]
        ; set $next-constraint col.constraint
        !view.render-schema
        !view.render-grid
        !view.save-schema $tbl
       ) }
      ]
     )
     !constraint-remove-btn.addEventListener click (
      [ match
       { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $col constraint }
       { true : ; set undefined col.constraint }
      ]
      !view.render-schema
      !view.render-grid
      !view.save-schema $tbl
     )
     !constraint-type-el.addEventListener change (
      ; to next-ctype $constraint-type-el.value
      [ match
       { [ propertyIs workflow next-ctype ] (
        ; to existing !normalizeColumnConstraint $col.constraint
        ; to next-constraint [ object
         { type workflow }
         { tableId [ match { $existing : $existing.tableId } { true : '' } ] }
         { fromColumnId [ match { $existing : $existing.fromColumnId } { true : '' } ] }
         { toColumnId [ match { $existing : $existing.toColumnId } { true : '' } ] }
        ]
        ; set $next-constraint col.constraint
        !view.render-schema
        !view.render-grid
        !view.save-schema $tbl
       ) }
      ]
     )
     !constraint-table-el.addEventListener change (
      ; to next-tbl-id $constraint-table-el.value
      ; to found-tbl ; object { table null }
      ; each $view.tables (
       ; to { cand } $argv
       ; condition { propertyIs $next-tbl-id cand.id } : ; set $cand found-tbl.table
      )
      ; to defaults !findWorkflowDefaultColumns $found-tbl.table
      ; to next-constraint [ object
       { type workflow }
       { tableId $next-tbl-id }
       { fromColumnId $defaults.fromColumnId }
       { toColumnId $defaults.toColumnId }
      ]
      ; set $next-constraint col.constraint
      !view.render-schema
      !view.render-grid
      !view.save-schema $tbl
     )
     !constraint-from-el.addEventListener change (
      ; to existing !normalizeColumnConstraint $col.constraint
      [ match
       { $existing (
        ; to next-constraint [ object
         { type $existing.type }
         { tableId $existing.tableId }
         { fromColumnId $constraint-from-el.value }
         { toColumnId $existing.toColumnId }
        ]
        ; set $next-constraint col.constraint
        !view.render-schema
        !view.render-grid
        !view.save-schema $tbl
       ) }
      ]
     )
     !constraint-to-el.addEventListener change (
      ; to existing !normalizeColumnConstraint $col.constraint
      [ match
       { $existing (
        ; to next-constraint [ object
         { type $existing.type }
         { tableId $existing.tableId }
         { fromColumnId $existing.fromColumnId }
         { toColumnId $constraint-to-el.value }
        ]
        ; set $next-constraint col.constraint
        !view.render-schema
        !view.render-grid
        !view.save-schema $tbl
       ) }
      ]
     )
     !multi-btn.addEventListener click (
      ; to next-multi [ ternary $col.multiple false true ]
      !view.request-column-change $tbl $col $col $next-multi $col.decimals null
     )
     !req-btn.addEventListener click (
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
     !rm-btn.addEventListener click : !view.request-delete-column $tbl $srow.index

     !schema-tbody.appendChild $tr
     !view.schema-rows.push $srow
    )
   ) }
  ]
 )

 ; to view.render (
  -- Re-renders table tabs, active table header, schema columns, and editable rows grid
  !view.close-table-menu
  !view.render-table-tabs
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; set true empty-el.hidden
    ; set false active-el.hidden
    ; set $tbl.name table-name-input.value
    !view.render-schema
    !view.render-updates
    !view.render-grid
   ) }
   { true (
    ; set false empty-el.hidden
    ; set true active-el.hidden
    !view.render-schema
    !view.render-updates
    !view.render-grid
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
  ; set $tbl.id view.active-table-id
  ; set $tbl.name lane.subroute
  ; set true view.schema-open
  !view.render
  [ match
   { $table-name-input.focus : !table-name-input.focus }
  ]
  [ match
   { $table-name-input.select : !table-name-input.select }
  ]
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
 )

 ; to view.add-column (
  -- Adds a new column to the active table, seeds default values on existing rows, renders, and saves
  ; to { name type multiple decimals required } $argv
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
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
     { $parsed.constraint [ object
      { id !view.next-id col }
      { name $clean-name }
      { type $parsed.type }
      { multiple $parsed.multiple }
      { constraint $parsed.constraint }
     ] }
     { true [ object
      { id !view.next-id col }
      { name $clean-name }
      { type $parsed.type }
      { multiple $parsed.multiple }
     ] }
    ]
    ; condition { propertyIs true required } : ; set true col.required
    !tbl.columns.push $col
    ; each $tbl.rows (
     ; to { row } $argv
     ; to def-val !defaultDataValue $col
     ; to row.values $col.id $def-val
    )
    ; set true view.schema-open
    !view.render-schema
    !view.render-grid
    ; to last-idx ; subtract $view.schema-rows.length 1
    ; to last-srow [ get view.schema-rows $last-idx ]
    [ match
     { $last-srow.name-el.focus : !last-srow.name-el.focus }
    ]
    !view.save-schema-and-rows $tbl
    $col
   ) }
  ]
 )

 ; to view.add-row (
  -- Appends a new editable row with default typed values for every column in the active table
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; condition { propertyIsGreaterThan 0 tbl.columns.length } (
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
     !view.render-grid
     !view.update-table-tabs-text
     ; to last-idx ; subtract $view.grid-rows.length 1
     ; to last-grow [ get view.grid-rows $last-idx ]
     ; to first-cell [ get last-grow.cells 0 ]
     [ match
      { $first-cell.input-el.focus : !first-cell.input-el.focus }
      { $first-cell.add-btn.focus : !first-cell.add-btn.focus }
     ]
     ; to row-ids !collect-ids $tbl.rows
     !addTableRow $data $view.lane.data $view.lane.id $tbl.id $row $row-ids
     !view.notify-record-change $tbl $row add-row
     $row
    )
   ) }
  ]
 )

 !add-table-btn.addEventListener click : !view.add-table
 !table-name-input.addEventListener input (
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; set $table-name-input.value tbl.name
    ; set $tbl.name lane.subroute
    !view.update-table-tabs-text
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
     !view.save-schema $tbl
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
    ; condition { propertyIs true view.table-menu-open } (
     ; to target [ match { $ev.target : $ev.target } { true : null } ]
     ; to inside [ match
      { [ propertyIs null target ] : false }
      { [ propertyIs $table-menu-wrap target ] : true }
      { [ propertyIs $table-menu-btn target ] : true }
      { [ propertyIs $table-menu target ] : true }
      { [ propertyIs $clear-rows-btn target ] : true }
      { [ propertyIs $delete-table-btn target ] : true }
      { $table-menu-wrap.contains : !table-menu-wrap.contains $target }
      { true : false }
     ]
     ; condition { propertyIs false inside } : !view.close-table-menu
    )
   )
  ) }
 ]
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs true view.table-menu-open } : ; condition { propertyIs Escape ev.key } : !view.close-table-menu
   )
  ) }
 ]

 ; to initial-tables !loadLaneTables $data $lane.data $lane.id
 ; to needs-catalog ; object { hit false }
 ; each $initial-tables (
  ; to { tbl } $argv
  ; to view.used-ids $tbl.id true
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
 !view.render
 $view
)
$scope
