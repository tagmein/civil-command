-- file lane-data.fs
; to confirm-modal-mod ; load /src/confirm-modal.fs
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

 ; to view [ object
  { lane $lane }
  { container $container }
  { lane-control $lane-control }
  { confirm-modal $modal }
  { tables {} }
  { active-table-id '' }
  { schema-open true }
  { id-seq 0 }
  { used-ids ; object }
  { table-tabs {} }
  { schema-rows {} }
  { grid-head-cells {} }
  { grid-rows {} }
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
 ; to clear-rows-btn !document.createElement button
 ; assign $clear-rows-btn { type button } { className 'lane-data-btn lane-data-clear-rows' } { textContent 'Clear rows' } { title 'Delete all rows in this table' }
 ; to delete-table-btn !document.createElement button
 ; assign $delete-table-btn { type button } { className 'lane-data-btn lane-data-delete-table' } { textContent 'Delete table' } { title 'Delete this table' }
 !header-actions-el.appendChild $schema-toggle-btn
 !header-actions-el.appendChild $clear-rows-btn
 !header-actions-el.appendChild $delete-table-btn
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
 ; to col-act-th !document.createElement th
 ; assign $col-act-th { className 'lane-inputs-th lane-inputs-th--actions' } { textContent '' }
 !schema-hrow.appendChild $col-name-th
 !schema-hrow.appendChild $col-type-th
 !schema-hrow.appendChild $col-multi-th
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
 ; to grid-table !document.createElement table
 ; set lane-data-grid grid-table.className
 ; to grid-thead !document.createElement thead
 ; to grid-hrow !document.createElement tr
 !grid-thead.appendChild $grid-hrow
 ; to grid-tbody !document.createElement tbody
 ; set lane-data-grid-body grid-tbody.className
 !grid-table.appendChild $grid-thead
 !grid-table.appendChild $grid-tbody
 !grid-wrap.appendChild $grid-table

 ; to rows-empty-el !document.createElement div
 ; assign $rows-empty-el { className lane-data-subempty } { textContent 'Add at least one column to start entering rows.' }

 !rows-section.appendChild $rows-header
 !rows-section.appendChild $grid-wrap
 !rows-section.appendChild $rows-empty-el

 !active-el.appendChild $table-header-el
 !active-el.appendChild $schema-section
 !active-el.appendChild $rows-section

 !root-el.appendChild $bar-el
 !root-el.appendChild $empty-el
 !root-el.appendChild $active-el
 !container.appendChild $root-el

 ; assign $view { element $root-el } { bar-el $bar-el } { tabs-el $tabs-el } { add-table-btn $add-table-btn } { empty-el $empty-el } { active-el $active-el } { table-name-input $table-name-input } { schema-toggle-btn $schema-toggle-btn } { clear-rows-btn $clear-rows-btn } { delete-table-btn $delete-table-btn } { schema-section $schema-section } { schema-tbody $schema-tbody } { schema-empty-el $schema-empty-el } { add-col-btn $add-col-btn } { rows-title $rows-title } { add-row-btn $add-row-btn } { grid-wrap $grid-wrap } { grid-hrow $grid-hrow } { grid-tbody $grid-tbody } { rows-empty-el $rows-empty-el }

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

 ; to view.save (
  -- Persists all tables (schemas and rows) to the lane KV namespace
  ; to serialized !window.JSON.stringify $view.tables
  !view.lane.data.set tables $serialized
 )

 ; to view.seed-env (
  -- Seeds named tables as typed row-object arrays into the lane execution environment
  ; to { env } $argv
  ; to scoped !buildTablesScope $view.tables
  ; assign $env $scoped
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

 ; to view.confirm (
  -- Opens the confirmation modal for a destructive action
  ; to { opts } $argv
  !view.confirm-modal.open $opts
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

 ; to view.create-typed-control (
  -- Builds an editable typed input or checkbox for a single value of col.type
  ; to { col initial-val on-valid on-enter } $argv
  [ match
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
    ; to formatted !formatCellInputValue $initial-val $col
    ; assign $input-el { type $input-type } { className $base-cls } { value $formatted } { placeholder $placeholder } { spellcheck false } { autocomplete off }
    [ match
     { [ propertyIs integer col.type ] : !input-el.setAttribute step '1' }
     { [ propertyIs decimal col.type ] : !input-el.setAttribute step any }
     { [ propertyIs fixed col.type ] : !input-el.setAttribute inputmode decimal }
    ]
    ; to handle-edit (
     ; to parsed !parseCellValue $input-el.value $col
     [ match
      { $parsed.ok (
       ; set $base-cls input-el.className
       ; set '' input-el.title
       !$on-valid $parsed.value
      ) }
      { true (
       ; to err-cls ; add $base-cls ' lane-data-cell-input--invalid'
       ; set $err-cls input-el.className
       ; set $parsed.error input-el.title
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

 ; to view.render-multi-cell (
  -- Renders a multiple-value ([]) cell editor with typed item inputs, confirmed removal, and + item button
  ; to { tbl row row-idx col cell-rec focus-idx } $argv
  ; to items-el $cell-rec.items-el
  ; while { propertyIsGreaterThan 0 cell-rec.items.length } (
   ; to old !cell-rec.items.pop
   !old.el.remove
  )
  ; to raw-val [ get row.values $col.id ]
  ; to arr [ match
   { [ !window.Array.isArray $raw-val ] : $raw-val }
   { true (
    ; to coerced !coerceDataValue $raw-val $col true
    ; to row.values $col.id $coerced
    $coerced
   ) }
  ]
  ; each $arr (
   ; to { item-val item-idx } $argv
   ; to item-el !document.createElement div
   ; set lane-data-multi-item item-el.className
   ; to on-item-valid (
    ; to { next-val } $argv
    ; to arr $item-idx $next-val
    !view.save
   )
   ; to on-item-enter (
    ; to next-idx ; add $item-idx 1
    ; to def-item !defaultDataValue $col false
    !arr.splice $next-idx 0 $def-item
    !view.render-multi-cell $tbl $row $row-idx $col $cell-rec $next-idx
    !view.save
   )
   ; to ctrl !view.create-typed-control $col $item-val $on-item-valid $on-item-enter
   ; to rm-btn !document.createElement button
   ; assign $rm-btn { type button } { className lane-data-multi-remove } { textContent '×' } { title 'Remove item' }
   !rm-btn.addEventListener click : !view.request-remove-multi-item $tbl $row $row-idx $col $cell-rec $item-idx
   !item-el.appendChild $ctrl.el
   !item-el.appendChild $rm-btn
   !items-el.appendChild $item-el
   ; to item-rec ; object { el $item-el } { input-el $ctrl.input-el } { remove-btn $rm-btn } { index $item-idx }
   !cell-rec.items.push $item-rec
  )
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
  ; to val-str !formatCellInputValue $item-val $col
  ; to msg ; add 'Remove item #' ; add $item-num ; add ' ("' ; add $val-str ; add '") from "' ; add $col-label ; add '" in row #' ; add $row-num '?'
  ; to opts [ object
   { title 'Remove Item' }
   { message $msg }
   { confirm-label 'Remove item' }
   { on-confirm (
    !arr.splice $item-idx 1
    !view.render-multi-cell $tbl $row $row-idx $col $cell-rec -1
    !view.save
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
  -- Builds the CSS class string for a data cell based on alignment and explicit column width
  ; to { col has-width } $argv
  ; to is-right !view.is-right-aligned-col $col
  ; to base [ ternary $is-right 'lane-data-td lane-data-td--right' lane-data-td ]
  [ ternary $has-width [ add $base ' lane-data-td--sized' ] $base ]
 )

 ; to view.apply-column-width (
  -- Applies or clears an explicit pixel width across a column header and all cells in that column
  ; to { col-idx raw-width } $argv
  ; to w !normalizeColumnWidth $raw-width
  ; to has-w [ match { $w : true } { true : false } ]
  ; to px [ match { $w : ; add $w px } { true : '' } ]
  ; to h-idx ; add $col-idx 1
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
     ; set [ !view.td-class-for-col $cell.col $has-w ] cell.td.className
    ) }
   ]
  )
 )

 ; to view.render-grid (
  -- Renders the editable table headers and rows for the active table
  ; while { propertyIsGreaterThan 0 view.grid-head-cells.length } (
   ; to old-h !view.grid-head-cells.pop
   !old-h.el.remove
  )
  ; while { propertyIsGreaterThan 0 view.grid-rows.length } (
   ; to old-r !view.grid-rows.pop
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
    ; set [ ternary $has-rows false true ] clear-rows-btn.hidden
    ; set [ ternary $has-cols false true ] grid-wrap.hidden

    [ match
     { $has-cols (
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
       ; to type-span !document.createElement span
       ; assign $type-span { className lane-data-th-type } { textContent !formatColumnType $col }
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
          { $drag.moved : !view.save }
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
        !view.save
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

      ; each $tbl.rows (
       ; to { row row-idx } $argv
       ; to tr !document.createElement tr
       ; set lane-data-row tr.className
       ; to row-num ; add $row-idx 1
       ; to num-td !document.createElement td
       ; assign $num-td { className 'lane-data-td lane-data-td--num' } { textContent $row-num }
       !tr.appendChild $num-td

       ; to cells {}
       ; each $tbl.columns (
        ; to { col } $argv
        ; to td !document.createElement td
        ; set [ !view.td-class-for-col $col false ] td.className
        ; to cur-val [ get row.values $col.id ]
        [ match
         { $col.multiple (
          ; to multi-wrap !document.createElement div
          ; set lane-data-multi multi-wrap.className
          ; to items-el !document.createElement div
          ; set lane-data-multi-items items-el.className
          ; to add-item-btn !document.createElement button
          ; assign $add-item-btn { type button } { className lane-data-multi-add } { textContent '+' } { title 'Add item' }
          !multi-wrap.appendChild $items-el
          !multi-wrap.appendChild $add-item-btn
          !td.appendChild $multi-wrap
          ; to cell-rec [ object
           { col $col }
           { td $td }
           { multi true }
           { items-el $items-el }
           { add-btn $add-item-btn }
           { items {} }
          ]
          !add-item-btn.addEventListener click (
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
           !view.save
          )
          !view.render-multi-cell $tbl $row $row-idx $col $cell-rec -1
          !cells.push $cell-rec
         ) }
         { true (
          ; to on-valid (
           ; to { next-val } $argv
           ; to row.values $col.id $next-val
           !view.save
          )
          ; to ctrl !view.create-typed-control $col $cur-val $on-valid null
          !td.appendChild $ctrl.el
          ; to cell-rec ; object { col $col } { td $td } { multi false } { input-el $ctrl.input-el }
          !cells.push $cell-rec
         ) }
        ]
        !tr.appendChild $td
       )

       ; to act-td !document.createElement td
       ; set 'lane-data-td lane-data-td--actions' act-td.className
       ; to rm-row-btn !document.createElement button
       ; assign $rm-row-btn { type button } { className lane-data-row-remove } { textContent '×' } { title 'Delete row' }
       !rm-row-btn.addEventListener click : !view.request-delete-row $tbl $row-idx
       !act-td.appendChild $rm-row-btn
       !tr.appendChild $act-td

       !grid-tbody.appendChild $tr
       !view.grid-rows.push ; object { row $row } { el $tr } { num-el $num-td } { cells $cells } { remove-btn $rm-row-btn } { index $row-idx }
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
  -- Applies a confirmed column type/multiplicity/decimals change and coerces existing row values
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
  ; each $tbl.rows (
   ; to { row } $argv
   ; to cur [ get row.values $col.id ]
   ; to coerced !coerceDataValue $cur $next-spec $next-spec.multiple $from-spec
   ; to row.values $col.id $coerced
  )
  !view.render-schema
  !view.render-grid
  !view.save
 )

 ; to view.request-column-change (
  -- Validates column type/multiple/decimals change and confirms when existing row data would be altered or truncated
  ; to { tbl col next-type next-multiple next-decimals on-revert } $argv
  ; to impact !checkColumnChangeImpact $tbl $col.id $next-type $next-multiple $next-decimals
  [ match
   { $impact.destructive (
    ; to col-label !view.display-col-name $col
    ; to prev-fmt !formatColumnType $col
    ; to next-fmt !formatColumnType $next-type $next-multiple $next-decimals
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
    ; to fmt-type !formatColumnType $col
    ; to row-count $tbl.rows.length
    ; to row-note [ match
     { [ propertyIsGreaterThan 0 row-count ] (
      ; to unit [ ternary [ propertyIs 1 row-count ] 'row.' 'rows.' ]
      ; add ' This will permanently delete its values from ' ; add $row-count ; add ' ' $unit
     ) }
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
      !view.save
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
    !tbl.rows.splice $row-idx 1
    !view.render-grid
    !view.update-table-tabs-text
    !view.save
   ) }
  ]
  !view.confirm $opts
 )

 ; to view.request-clear-rows (
  -- Prompts for confirmation before clearing all rows from the active table
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to row-count $tbl.rows.length
    ; condition { propertyIsGreaterThan 0 row-count } (
     ; to tbl-idx !view.tables.indexOf $tbl
     ; to tbl-label !view.display-table-name $tbl $tbl-idx
     ; to unit [ ternary [ propertyIs 1 row-count ] row rows ]
     ; to msg ; add 'Delete all ' ; add $row-count ; add ' ' ; add $unit ; add ' from "' ; add $tbl-label '"? The table columns will be kept.'
     ; to opts [ object
      { title 'Clear All Rows' }
      { message $msg }
      { confirm-label 'Clear rows' }
      { on-confirm (
       ; set 0 tbl.rows.length
       !view.render-grid
       !view.update-table-tabs-text
       !view.save
      ) }
     ]
     !view.confirm $opts
    )
   ) }
  ]
 )

 ; to view.request-delete-table (
  -- Prompts for confirmation before deleting the active table
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; to tbl-idx !view.tables.indexOf $tbl
    ; to tbl-label !view.display-table-name $tbl $tbl-idx
    ; to col-count $tbl.columns.length
    ; to row-count $tbl.rows.length
    ; to col-unit [ ternary [ propertyIs 1 col-count ] column columns ]
    ; to row-unit [ ternary [ propertyIs 1 row-count ] row rows ]
    ; to msg ; add 'Delete table "' ; add $tbl-label ; add '"? This will permanently remove its ' ; add $col-count ; add ' ' ; add $col-unit ; add ' and ' ; add $row-count ; add ' ' ; add $row-unit '.'
    ; to opts [ object
     { title 'Delete Table' }
     { message $msg }
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
      ; set [ !view.default-schema-open $next-tbl ] view.schema-open
      !view.render
      !view.save
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
     !type-wrap.appendChild $type-el
     !type-wrap.appendChild $decimals-wrap
     !type-td.appendChild $type-wrap

     ; to multi-td !document.createElement td
     ; set 'lane-input-cell lane-data-cell--multi' multi-td.className
     ; to multi-btn !document.createElement button
     ; to is-multi [ ternary $col.multiple true false ]
     ; to multi-cls [ ternary $is-multi 'lane-data-multi-toggle lane-data-multi-toggle--active' lane-data-multi-toggle ]
     ; to fmt-title ; add 'Multiple values: ' !formatColumnType $col $is-multi
     ; assign $multi-btn { type button } { className $multi-cls } { textContent '[]' } { title $fmt-title }
     !multi-btn.setAttribute aria-pressed [ ternary $is-multi 'true' 'false' ]
     !multi-td.appendChild $multi-btn

     ; to act-td !document.createElement td
     ; set 'lane-input-cell lane-input-cell--actions' act-td.className
     ; to rm-btn !document.createElement button
     ; assign $rm-btn { type button } { className lane-input-remove } { textContent '×' } { title 'Delete column' }
     !act-td.appendChild $rm-btn

     !tr.appendChild $name-td
     !tr.appendChild $type-td
     !tr.appendChild $multi-td
     !tr.appendChild $act-td

     ; to srow [ object
      { col $col }
      { el $tr }
      { name-el $name-el }
      { type-el $type-el }
      { decimals-wrap $decimals-wrap }
      { decimals-el $decimals-el }
      { multi-btn $multi-btn }
      { remove-btn $rm-btn }
      { index $col-idx }
     ]

     !name-el.addEventListener input (
      ; set $name-el.value col.name
      ; to h-idx ; add $srow.index 1
      ; to h-cell [ get view.grid-head-cells $h-idx ]
      [ match
       { $h-cell.name-el : ; set [ !view.display-col-name $col ] h-cell.name-el.textContent }
      ]
      !view.save
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
      ; to next-decimals [ match
       { [ propertyIs fixed next-type ] : !normalizeFixedDecimals $col.decimals }
       { true : undefined }
      ]
      ; to on-revert (
       ; set $col.type type-el.value
      )
      !view.request-column-change $tbl $col $next-type $col.multiple $next-decimals $on-revert
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
     !multi-btn.addEventListener click (
      ; to next-multi [ ternary $col.multiple false true ]
      !view.request-column-change $tbl $col $col.type $next-multi $col.decimals null
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
  !view.render-table-tabs
  ; to tbl !view.get-active-table
  [ match
   { $tbl (
    ; set true empty-el.hidden
    ; set false active-el.hidden
    ; set $tbl.name table-name-input.value
    !view.render-schema
    !view.render-grid
   ) }
   { true (
    ; set false empty-el.hidden
    ; set true active-el.hidden
    !view.render-schema
    !view.render-grid
   ) }
  ]
 )

 ; to view.select-table (
  -- Selects a table by ID, applies default schema visibility (collapsed when rows exist), and renders
  ; to { id } $argv
  ; set $id view.active-table-id
  ; to tbl !view.get-active-table
  ; set [ !view.default-schema-open $tbl ] view.schema-open
  !view.render
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
  ; set true view.schema-open
  !view.render
  [ match
   { $table-name-input.focus : !table-name-input.focus }
  ]
  [ match
   { $table-name-input.select : !table-name-input.select }
  ]
  !view.save
  $tbl
 )

 ; to view.add-column (
  -- Adds a new column to the active table, seeds default values on existing rows, renders, and saves
  ; to { name type multiple decimals } $argv
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
     { true [ object
      { id !view.next-id col }
      { name $clean-name }
      { type $parsed.type }
      { multiple $parsed.multiple }
     ] }
    ]
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
    !view.save
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
     !view.save
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
    !view.update-table-tabs-text
    !view.save
   ) }
  ]
 )
 !schema-toggle-btn.addEventListener click (
  ; set [ ternary $view.schema-open false true ] view.schema-open
  !view.render-schema
 )
 !add-col-btn.addEventListener click : !view.add-column '' text false
 !add-row-btn.addEventListener click $view.add-row
 !clear-rows-btn.addEventListener click $view.request-clear-rows
 !delete-table-btn.addEventListener click $view.request-delete-table

 ; to stored !lane.data.get tables
 ; to initial-tables !parseStoredTables $stored
 ; each $initial-tables (
  ; to { tbl } $argv
  ; to view.used-ids $tbl.id true
  ; each $tbl.columns (
   ; to { col } $argv
   ; to view.used-ids $col.id true
  )
  ; each $tbl.rows (
   ; to { row } $argv
   ; to view.used-ids $row.id true
  )
  !view.tables.push $tbl
 )
 ; condition { propertyIsGreaterThan 0 view.tables.length } (
  ; to first-tbl [ get view.tables 0 ]
  ; set $first-tbl.id view.active-table-id
  ; set [ !view.default-schema-open $first-tbl ] view.schema-open
 )
 !view.render
 $view
)
$scope
