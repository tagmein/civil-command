-- file lane-row-picker-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a searchable, async paginated modal picker for linked Data table rows
 ; to { host-or-control maybe-control } $argv
 ; to lane-control [ match
  { $maybe-control : $maybe-control }
  { $host-or-control.by-id : $host-or-control }
  { $host-or-control.mount-lane-modal : $host-or-control }
  { true : null }
 ]
 ; to host [ match
  { $host-or-control.by-id : null }
  { $host-or-control.mount-lane-modal : null }
  { true : $host-or-control }
 ]

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-row-picker-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-row-picker-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-modal-title-wrap title-wrap.className
 ; to heading-el !document.createElement div
 ; assign $heading-el { className lane-modal-title } { textContent 'Select Row' }
 ; to count-el !document.createElement div
 ; assign $count-el { className lane-modal-count } { textContent '' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading-el
 !title-wrap.appendChild $count-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to toolbar !document.createElement div
 ; set lane-row-picker-toolbar toolbar.className
 ; to search-input !document.createElement input
 ; assign $search-input { type text } { className 'lane-modal-search lane-row-picker-search' } { placeholder 'Filter rows...' } { spellcheck false } { autocomplete off }
 ; to clear-btn !document.createElement button
 ; assign $clear-btn { type button } { className 'lane-modal-action lane-row-picker-clear' } { textContent Clear } { title 'Clear selected row' }
 ; set true clear-btn.hidden
 !toolbar.appendChild $search-input
 !toolbar.appendChild $clear-btn

 ; to status-el !document.createElement div
 ; set lane-import-status status-el.className
 ; set true status-el.hidden

 ; to selected-section !document.createElement div
 ; assign $selected-section { className lane-multiselect-bar } { hidden true }
 ; to selected-label-el !document.createElement span
 ; assign $selected-label-el { className lane-multiselect-label } { textContent 'Selected (0)' }
 ; to selected-chips-el !document.createElement div
 ; set lane-multiselect-chips selected-chips-el.className
 !selected-section.appendChild $selected-label-el
 !selected-section.appendChild $selected-chips-el

 ; to list-el !document.createElement div
 ; set 'lane-modal-list lane-row-picker-list' list-el.className

 ; to add-trigger-btn !document.createElement button
 ; assign $add-trigger-btn { type button } { className 'lane-row-picker-option lane-row-picker-option--add' } { title 'Add new row' } { hidden true }
 !add-trigger-btn.setAttribute aria-expanded 'false'
 ; to add-main-el !document.createElement span
 ; set lane-row-picker-option-main add-main-el.className
 ; to add-disp-el !document.createElement span
 ; assign $add-disp-el { className lane-row-picker-option-display } { textContent '' }
 !add-main-el.appendChild $add-disp-el
 ; to add-badge-el !document.createElement span
 ; assign $add-badge-el { className 'lane-row-picker-option-badge lane-row-picker-option-add-badge' } { textContent '+ Add' }
 !add-trigger-btn.appendChild $add-main-el
 !add-trigger-btn.appendChild $add-badge-el

 ; to add-form-el !document.createElement div
 ; assign $add-form-el { className 'lane-row-picker-option lane-row-picker-option--add-expanded' } { hidden true }
 ; to add-fields-el !document.createElement div
 ; set lane-row-picker-add-fields add-fields-el.className
 ; to add-error-el !document.createElement div
 ; assign $add-error-el { className lane-row-picker-add-error } { textContent '' } { hidden true }
 ; to add-actions-el !document.createElement div
 ; set lane-row-picker-add-actions add-actions-el.className
 ; to add-cancel-btn !document.createElement button
 ; assign $add-cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel lane-row-picker-add-cancel' } { textContent Cancel }
 ; to add-save-btn !document.createElement button
 ; assign $add-save-btn { type button } { className 'lane-modal-action lane-config-btn--save lane-row-picker-add-save' } { textContent Save }
 !add-actions-el.appendChild $add-cancel-btn
 !add-actions-el.appendChild $add-save-btn
 !add-form-el.appendChild $add-fields-el
 !add-form-el.appendChild $add-error-el
 !add-form-el.appendChild $add-actions-el

 !list-el.appendChild $add-trigger-btn
 !list-el.appendChild $add-form-el

 ; to footer !document.createElement div
 ; set lane-row-picker-footer footer.className
 ; to more-btn !document.createElement button
 ; assign $more-btn { type button } { className 'lane-modal-action lane-row-picker-more' } { textContent 'Load more' }
 ; set true more-btn.hidden
 ; to footer-actions !document.createElement div
 ; set lane-row-picker-footer-actions footer-actions.className
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to apply-btn !document.createElement button
 ; assign $apply-btn { type button } { className 'lane-modal-action lane-config-btn--save lane-row-picker-apply' } { textContent Apply } { hidden true }
 !footer-actions.appendChild $cancel-btn
 !footer-actions.appendChild $apply-btn
 !footer.appendChild $more-btn
 !footer.appendChild $footer-actions

 !panel.appendChild $header
 !panel.appendChild $toolbar
 !panel.appendChild $status-el
 !panel.appendChild $selected-section
 !panel.appendChild $list-el
 !panel.appendChild $footer
 !backdrop.appendChild $panel

 ; to fallback-page-size [ match
  { $defaultRowPickerPageSize : $defaultRowPickerPageSize }
  { true : 25 }
 ]

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { heading-el $heading-el }
  { count-el $count-el }
  { close-btn $close-btn }
  { search-input $search-input }
  { clear-btn $clear-btn }
  { status-el $status-el }
  { selected-section $selected-section }
  { selected-label-el $selected-label-el }
  { selected-chips-el $selected-chips-el }
  { list-el $list-el }
  { add-trigger-btn $add-trigger-btn }
  { add-btn $add-badge-el }
  { add-form-el $add-form-el }
  { add-fields-el $add-fields-el }
  { add-error-el $add-error-el }
  { add-actions-el $add-actions-el }
  { add-cancel-btn $add-cancel-btn }
  { add-save-btn $add-save-btn }
  { add-expanded false }
  { can-add false }
  { add-fields {} }
  { draft-values ; object }
  { target-table null }
  { target-columns {} }
  { link-col null }
  { display-col null }
  { tables {} }
  { initial-row-values null }
  { on-create-row null }
  { more-btn $more-btn }
  { footer-actions $footer-actions }
  { cancel-btn $cancel-btn }
  { apply-btn $apply-btn }
  { host $host }
  { lane null }
  { is-open false }
  { multiple false }
  { loading false }
  { error '' }
  { query '' }
  { page-size $fallback-page-size }
  { target-limit $fallback-page-size }
  { loaded-items {} }
  { next-offset 0 }
  { has-more false }
  { total-count 0 }
  { pages-loaded 0 }
  { selected-value null }
  { has-selected false }
  { selected-values {} }
  { resolve-display null }
  { item-noun row }
  { item-noun-plural rows }
  { empty-message 'No rows available in linked table.' }
  { pending-after-select null }
  { fetch-page null }
  { on-select null }
  { load-seq 0 }
  { selected-chip-els {} }
  { selected-chips {} }
  { row-els {} }
  { option-items {} }
 ]

 ; to find-selected-val-idx (
  ; to { target-val } $argv
  ; to found ; object { idx -1 }
  ; each $modal.selected-values (
   ; to { item-val idx } $argv
   ; condition { propertyIs -1 found.idx } (
    ; to is-eq !dataValuesEqual $item-val $target-val
    ; condition { propertyIs true is-eq } : ; set $idx found.idx
   )
  )
  $found.idx
 )

 ; to modal.clear-selected-chips (
  ; while { propertyIsGreaterThan 0 modal.selected-chip-els.length } (
   ; to old-chip !modal.selected-chip-els.pop
   !old-chip.remove
  )
  ; set 0 modal.selected-chips.length
 )

 ; to resolve-selected-item-info (
  ; to { val } $argv
  [ match
   { $modal.resolve-display : !modal.resolve-display $val }
   { true (
    ; to matched ; object { info null }
    ; each $modal.loaded-items (
     ; to { it } $argv
     ; condition { propertyIs null matched.info } (
      ; to is-eq !dataValuesEqual $it.value $val
      ; condition { propertyIs true is-eq } : ; set $it matched.info
     )
    )
    [ match
     { $matched.info : $matched.info }
     { true (
      ; to txt [ match
       { [ propertyIs undefined val ] : '' }
       { [ propertyIs null val ] : '' }
       { true : ; add '' $val }
      ]
      ; object { isEmpty [ propertyIs '' txt ] } { valueText $txt } { displayText $txt } { hasSeparateDisplay false } { label $txt } { filterMatched true }
     ) }
    ]
   ) }
  ]
 )

 ; to modal.toggle-value (
  -- Adds or removes a value in the multiselect draft list without saving until Apply is clicked
  ; to { val } $argv
  ; to idx !find-selected-val-idx $val
  [ match
   { [ propertyIsGreaterThan -1 idx ] : !modal.selected-values.splice $idx 1 }
   { true : !modal.selected-values.push $val }
  ]
  !modal.render
 )

 ; to modal.render-selected-chips (
  -- Renders the multiselect Selected (N) chips bar with one-click item removal
  !modal.clear-selected-chips
  [ match
   { [ propertyIs true modal.multiple ] (
    ; set false selected-section.hidden
    ; to sel-count $modal.selected-values.length
    ; set [ ; add 'Selected (' ; add $sel-count ')' ] selected-label-el.textContent
    [ match
     { [ propertyIs 0 sel-count ] (
      ; to none-el !document.createElement span
      ; assign $none-el { className lane-multiselect-empty } { textContent 'None selected' }
      !selected-chips-el.appendChild $none-el
      !modal.selected-chip-els.push $none-el
     ) }
     { true (
      ; each $modal.selected-values (
       ; to { sval idx } $argv
       ; to info !resolve-selected-item-info $sval
       ; to is-invalid [ propertyIs false info.filterMatched ]
       ; to has-sep [ match
        { $info.hasSeparateDisplay [ match
         { [ propertyIs '' info.displayText ] : false }
         { true : true }
        ] }
        { true : false }
       ]
       ; to primary-txt [ match
        { $has-sep : $info.displayText }
        { $info.valueText : $info.valueText }
        { true : ; add '' $sval }
       ]
       ; to chip-el !document.createElement span
       ; set [ ternary $is-invalid 'lane-multiselect-chip lane-multiselect-chip--invalid' lane-multiselect-chip ] chip-el.className
       ; to lbl-el !document.createElement span
       ; assign $lbl-el { className lane-multiselect-chip-label } { textContent $primary-txt }
       !chip-el.appendChild $lbl-el
       [ match
        { $is-invalid (
         ; to inv-el !document.createElement span
         ; assign $inv-el { className lane-multiselect-chip-id } { textContent '(invalid)' }
         !chip-el.appendChild $inv-el
        ) }
        { $has-sep (
         ; to cid-el !document.createElement span
         ; assign $cid-el { className lane-multiselect-chip-id } { textContent $info.valueText }
         !chip-el.appendChild $cid-el
        ) }
       ]
       ; to rm-btn !document.createElement button
       ; assign $rm-btn { type button } { className lane-multiselect-chip-remove } { textContent '×' } { title [ ; add 'Remove ' $primary-txt ] }
       !rm-btn.addEventListener click (
        !modal.selected-values.splice $idx 1
        !modal.render
       )
       !chip-el.appendChild $rm-btn
       !selected-chips-el.appendChild $chip-el
       !modal.selected-chip-els.push $chip-el
       !modal.selected-chips.push [ object
        { value $sval }
        { index $idx }
        { el $chip-el }
        { label-el $lbl-el }
        { remove-btn $rm-btn }
       ]
      )
     ) }
    ]
   ) }
   { true (
    ; set true selected-section.hidden
   ) }
  ]
 )

 ; to modal.clear-add-fields (
  -- Removes any rendered draft field elements from the expanded new row form
  ; while { propertyIsGreaterThan 0 modal.add-fields.length } (
   ; to old-f !modal.add-fields.pop
   !old-f.el.remove
  )
  ; set '' add-error-el.textContent
  ; set true add-error-el.hidden
 )

 ; to modal.sync-add-visibility (
  -- Toggles the top add row between hidden, collapsed blank row with + Add, and expanded new row form
  [ match
   { [ propertyIs false modal.can-add ] (
    ; set true add-trigger-btn.hidden
    ; set true add-form-el.hidden
    !add-trigger-btn.setAttribute aria-expanded 'false'
   ) }
   { $modal.add-expanded (
    ; set true add-trigger-btn.hidden
    ; set false add-form-el.hidden
    !add-trigger-btn.setAttribute aria-expanded 'true'
   ) }
   { true (
    ; set false add-trigger-btn.hidden
    ; set true add-form-el.hidden
    !add-trigger-btn.setAttribute aria-expanded 'false'
   ) }
  ]
 )

 ; to modal.default-draft-col-value (
  -- Returns a blank initial draft value for a column (null for numeric/ref types, '' for text, false for boolean, [] for multiple)
  ; to { col } $argv
  [ match
   { $col.multiple : {} }
   { [ propertyIs boolean col.type ] : false }
   { [ propertyIs integer col.type ] : null }
   { [ propertyIs decimal col.type ] : null }
   { [ propertyIs fixed col.type ] : null }
   { true : !defaultDataValue $col }
  ]
 )

 ; to modal.init-draft-values (
  -- Initializes in-memory draft values for all columns of the linked target table
  ; to vals ; object
  ; each $modal.target-columns (
   ; to { col } $argv
   ; to has-init [ match
    { $modal.initial-row-values : [ !window.Object.hasOwn $modal.initial-row-values $col.id ] }
    { true : false }
   ]
   ; to raw-init [ match
    { $has-init : [ get modal.initial-row-values $col.id ] }
    { true : undefined }
   ]
   ; to col-val [ match
    { [ propertyIs undefined raw-init ] : !modal.default-draft-col-value $col }
    { [ propertyIs null raw-init ] : null }
    { true : !coerceDataValue $raw-init $col $col.multiple null $modal.tables }
   ]
   ; to vals $col.id $col-val
  )
  ; set $vals modal.draft-values
  $vals
 )

 ; to get-clock-display-opts (
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

 ; to modal.build-single-add-control (
  -- Creates a single typed input/select/checkbox control for a column in the expanded new row option
  ; to { col col-label initial-val is-req on-change on-enter } $argv
  ; to wf-constraint [ match
   { [ propertyIs text col.type ] : !normalizeColumnConstraint $col.constraint }
   { true : null }
  ]
  ; to wf-state [ match
   { $wf-constraint : !getWorkflowCellState $modal.tables $col $initial-val }
   { true : null }
  ]
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
    ; to read-value (
     ; to next-bool [ ternary $cb.checked true false ]
     ; set [ ternary $next-bool 'true' 'false' ] txt.textContent
     ; object { ok true } { value $next-bool } { error '' }
    )
    !cb.addEventListener change (
     ; to res !read-value
     [ match
      { $on-change : !$on-change $res.value }
     ]
    )
    ; object { el $wrap } { input-el $cb } { label-el $txt } { read-value $read-value }
   ) }
   { [ propertyIs row col.type ] (
    ; to select-el !document.createElement select
    ; set 'lane-data-cell-select lane-row-picker-add-select' select-el.className
    ; to empty-opt !document.createElement option
    ; to empty-lbl [ match
     { [ propertyIs '(unnamed)' col-label ] : 'Select row…' }
     { true : ; add 'Select ' ; add $col-label '…' }
    ]
    ; assign $empty-opt { value '' } { textContent $empty-lbl }
    !select-el.appendChild $empty-opt
    ; to opt-entries {}
    ; to nested-target !resolveRowTarget $modal.tables $col $modal.target-table
    ; to matched-init ; object { text '' }
    [ match
     { $nested-target.valid (
      ; to clock-opts !get-clock-display-opts
      ; each $nested-target.table.rows (
       ; to { nrow } $argv
       ; to nval [ get nrow.values $nested-target.linkCol.id ]
       ; to ninfo !lookupRowDisplay $modal.tables $col $nval null $modal.target-table $clock-opts
       ; condition { propertyIs false ninfo.isEmpty } (
        ; to opt !document.createElement option
        ; assign $opt { value $ninfo.valueText } { textContent $ninfo.label }
        ; to is-cur !dataValuesEqual $nval $initial-val
        ; condition { propertyIs true is-cur } (
         ; set true opt.selected
         ; set $ninfo.valueText matched-init.text
        )
        !select-el.appendChild $opt
        !opt-entries.push ; object { valueText $ninfo.valueText } { value $nval } { opt $opt }
       )
      )
     ) }
    ]
    ; set $matched-init.text select-el.value
    ; to single-spec [ object { type row } { multiple false } ]
    ; to apply-select-state (
     ; to { ok err-msg is-req-empty } $argv
     [ match
      { [ propertyIs false ok ] (
       ; to cls [ ternary $is-req-empty 'lane-data-cell-select lane-row-picker-add-select lane-data-cell-select--invalid lane-data-cell-select--required-empty' 'lane-data-cell-select lane-row-picker-add-select lane-data-cell-select--invalid' ]
       ; set $cls select-el.className
       ; set $err-msg select-el.title
       !select-el.setAttribute aria-invalid 'true'
      ) }
      { true (
       ; set 'lane-data-cell-select lane-row-picker-add-select' select-el.className
       ; set '' select-el.title
       !select-el.setAttribute aria-invalid 'false'
      ) }
     ]
    )
    ; to read-value (
     ; to raw-sel [ match
      { [ propertyIs undefined select-el.value ] : '' }
      { [ propertyIs null select-el.value ] : '' }
      { true : ; add '' $select-el.value }
     ]
     ; to found ; object { hit false } { value null }
     ; to has-raw [ match
      { [ propertyIs '' raw-sel ] : false }
      { true : true }
     ]
     ; condition { propertyIs true has-raw } (
      ; each $opt-entries (
       ; to { entry } $argv
       ; condition { propertyIs $raw-sel entry.valueText } (
        ; set true found.hit
        ; set $entry.value found.value
       )
      )
      [ match
       { $found.hit : null }
       { $nested-target.valueSpec (
        ; to parsed-fallback !parseCellValue $raw-sel $nested-target.valueSpec
        [ match
         { $parsed-fallback.ok (
          ; set true found.hit
          ; set $parsed-fallback.value found.value
         ) }
        ]
       ) }
       { true (
        ; set true found.hit
        ; set $raw-sel found.value
       ) }
      ]
     )
     ; to is-empty !isDataCellValueEmpty $found.value $single-spec
     ; to is-req-empty [ match
      { $is-req : $is-empty }
      { true : false }
     ]
     [ match
      { $is-req-empty (
       ; to err ; add $col-label ' is required'
       !apply-select-state false $err true
       ; object { ok false } { value null } { error $err }
      ) }
      { true (
       !apply-select-state true '' false
       ; object { ok true } { value $found.value } { error '' }
      ) }
     ]
    )
    !select-el.addEventListener change (
     ; to res !read-value
     ; set '' add-error-el.textContent
     ; set true add-error-el.hidden
     [ match
      { $on-change : !$on-change $res.value }
     ]
    )
    ; object { el $select-el } { input-el $select-el } { select-el $select-el } { read-value $read-value }
   ) }
   { [ propertyIs lane col.type ] (
    ; to select-el !document.createElement select
    ; set 'lane-data-cell-select lane-row-picker-add-select' select-el.className
    ; to empty-opt !document.createElement option
    ; assign $empty-opt { value '' } { textContent 'Select lane…' }
    !select-el.appendChild $empty-opt
    ; to known-lanes [ match
     { $lane-control.list-known : !lane-control.list-known }
     { [ !window.Array.isArray $lane-control.lanes ] : $lane-control.lanes }
     { true : {} }
    ]
    ; to init-id [ match
     { [ propertyIs undefined initial-val ] : '' }
     { [ propertyIs null initial-val ] : '' }
     { true : ; add '' $initial-val }
    ]
    ; each $known-lanes (
     ; to { kl } $argv
     ; to opt !document.createElement option
     ; to kl-title [ match
      { $kl.title : ; add $kl.title ; add ' (' ; add $kl.id ')' }
      { true : $kl.id }
     ]
     ; assign $opt { value $kl.id } { textContent $kl-title }
     ; condition { propertyIs $init-id kl.id } : ; set true opt.selected
     !select-el.appendChild $opt
    )
    ; set $init-id select-el.value
    ; to single-spec [ object { type lane } { multiple false } ]
    ; to read-value (
     ; to raw-sel [ match
      { [ propertyIs undefined select-el.value ] : '' }
      { [ propertyIs null select-el.value ] : '' }
      { true : ; add '' $select-el.value }
     ]
     ; to val [ match
      { [ propertyIs '' raw-sel ] : null }
      { true : $raw-sel }
     ]
     ; to is-empty !isDataCellValueEmpty $val $single-spec
     ; to is-req-empty [ match
      { $is-req : $is-empty }
      { true : false }
     ]
     [ match
      { $is-req-empty (
       ; to err ; add $col-label ' is required'
       ; set 'lane-data-cell-select lane-row-picker-add-select lane-data-cell-select--invalid lane-data-cell-select--required-empty' select-el.className
       ; set $err select-el.title
       !select-el.setAttribute aria-invalid 'true'
       ; object { ok false } { value null } { error $err }
      ) }
      { true (
       ; set 'lane-data-cell-select lane-row-picker-add-select' select-el.className
       ; set '' select-el.title
       !select-el.setAttribute aria-invalid 'false'
       ; object { ok true } { value $val } { error '' }
      ) }
     ]
    )
    !select-el.addEventListener change (
     ; to res !read-value
     ; set '' add-error-el.textContent
     ; set true add-error-el.hidden
     [ match
      { $on-change : !$on-change $res.value }
     ]
    )
    ; object { el $select-el } { input-el $select-el } { select-el $select-el } { read-value $read-value }
   ) }
   { [ match { $wf-state : $wf-state.valid } { true : false } ] (
    ; to select-el !document.createElement select
    ; set 'lane-data-cell-select lane-row-picker-add-select' select-el.className
    ; each $wf-state.options (
     ; to { opt-spec } $argv
     ; to opt !document.createElement option
     ; assign $opt { value $opt-spec.value } { textContent $opt-spec.label }
     ; condition { propertyIs true opt-spec.isCurrent } : ; set true opt.selected
     !select-el.appendChild $opt
    )
    ; set $wf-state.currentValue select-el.value
    ; to single-spec [ object { type text } { multiple false } ]
    ; to read-value (
     ; to next-val [ match
      { [ propertyIs undefined select-el.value ] : '' }
      { [ propertyIs null select-el.value ] : '' }
      { true : ; add '' $select-el.value }
     ]
     ; to is-empty !isDataCellValueEmpty $next-val $single-spec
     ; to is-req-empty [ match
      { $is-req : $is-empty }
      { true : false }
     ]
     [ match
      { $is-req-empty (
       ; to err ; add $col-label ' is required'
       ; set 'lane-data-cell-select lane-row-picker-add-select lane-data-cell-select--invalid lane-data-cell-select--required-empty' select-el.className
       ; set $err select-el.title
       !select-el.setAttribute aria-invalid 'true'
       ; object { ok false } { value $next-val } { error $err }
      ) }
      { true (
       ; set 'lane-data-cell-select lane-row-picker-add-select' select-el.className
       ; set '' select-el.title
       !select-el.setAttribute aria-invalid 'false'
       ; object { ok true } { value $next-val } { error '' }
      ) }
     ]
    )
    !select-el.addEventListener change (
     ; to res !read-value
     ; set '' add-error-el.textContent
     ; set true add-error-el.hidden
     [ match
      { $on-change : !$on-change $res.value }
     ]
    )
    ; object { el $select-el } { input-el $select-el } { select-el $select-el } { read-value $read-value }
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
    ; to base-cls 'lane-data-cell-input lane-row-picker-add-input lane-data-cell-input--datetime'
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
     ; to { ok val err-msg show-req } $argv
     ; to cur-text $input-el.value
     ; to is-date-empty [ propertyIs '' cur-text ]
     ; to is-req-empty [ match
      { [ and { $show-req } { $is-req } ] : !isDataCellValueEmpty $val $single-spec }
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
    ; to init-opts !get-clock-display-opts
    ; to formatted !formatCellInputValue $initial-val $col undefined $modal.tables $init-opts
    ; to ph !resolve-placeholder $init-opts
    ; assign $input-el { type text } { className $base-cls } { value $formatted } { placeholder $ph } { spellcheck false } { autocomplete off }
    !sync-picker-title $init-opts
    !apply-input-state true $initial-val '' false

    ; to read-value (
     ; to copts !get-clock-display-opts
     ; to raw-text $input-el.value
     ; to cur-display !formatCellInputValue $ctrl-state.value $col undefined $modal.tables $copts
     ; to parsed [ match
      { [ and { propertyIs true ctrl-state.valid } { propertyIs $cur-display raw-text } ] : [ object { ok true } { value $ctrl-state.value } { error null } ] }
      { true : !parseCellValue $raw-text $col undefined $modal.tables $copts }
     ]
     [ match
      { [ propertyIs false parsed.ok ] (
       ; set false ctrl-state.valid
       !apply-input-state false null $parsed.error true
       ; to err ; add $col-label ; add ': ' $parsed.error
       ; object { ok false } { value null } { error $err }
      ) }
      { true (
       ; set $parsed.value ctrl-state.value
       ; set true ctrl-state.valid
       ; to is-empty !isDataCellValueEmpty $parsed.value $single-spec
       ; to is-req-empty [ match
        { $is-req : $is-empty }
        { true : false }
       ]
       [ match
        { $is-req-empty (
         !apply-input-state true $parsed.value '' true
         ; to err ; add $col-label ' is required'
         ; object { ok false } { value $parsed.value } { error $err }
        ) }
        { true (
         !apply-input-state true $parsed.value '' false
         ; object { ok true } { value $parsed.value } { error '' }
        ) }
       ]
      ) }
     ]
    )
    ; to handle-edit (
     ; to copts !get-clock-display-opts
     ; to raw-text $input-el.value
     ; to cur-display !formatCellInputValue $ctrl-state.value $col undefined $modal.tables $copts
     [ match
      { [ and { propertyIs true ctrl-state.valid } { propertyIs $cur-display raw-text } ] (
       !apply-input-state true $ctrl-state.value '' false
      ) }
      { true (
       ; to parsed !parseCellValue $raw-text $col undefined $modal.tables $copts
       [ match
        { $parsed.ok (
         ; set $parsed.value ctrl-state.value
         ; set true ctrl-state.valid
         !apply-input-state true $parsed.value '' false
         ; set '' add-error-el.textContent
         ; set true add-error-el.hidden
         [ match
          { $on-change : !$on-change $parsed.value }
         ]
        ) }
        { true (
         ; set false ctrl-state.valid
         !apply-input-state false null $parsed.error false
        ) }
       ]
      ) }
     ]
    )
    ; to handle-blur (
     ; to copts !get-clock-display-opts
     ; to raw-text $input-el.value
     ; to cur-display !formatCellInputValue $ctrl-state.value $col undefined $modal.tables $copts
     [ match
      { [ and { propertyIs true ctrl-state.valid } { propertyIs $cur-display raw-text } ] (
       !apply-input-state true $ctrl-state.value '' false
      ) }
      { true (
       ; to parsed !parseCellValue $raw-text $col undefined $modal.tables $copts
       [ match
        { $parsed.ok (
         ; set $parsed.value ctrl-state.value
         ; set true ctrl-state.valid
         ; to disp !formatCellInputValue $parsed.value $col undefined $modal.tables $copts
         ; set $disp input-el.value
         !apply-input-state true $parsed.value '' false
        ) }
       ]
      ) }
     ]
    )
    ; to refresh-datetime (
     ; to copts !get-clock-display-opts
     ; to next-ph !resolve-placeholder $copts
     ; set $next-ph input-el.placeholder
     !sync-picker-title $copts
     [ match
      { $ctrl-state.valid (
       ; to disp !formatCellInputValue $ctrl-state.value $col undefined $modal.tables $copts
       ; set $disp input-el.value
       !apply-input-state true $ctrl-state.value '' false
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
     ; to copts !get-clock-display-opts
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
     ; to copts !get-clock-display-opts
     ; to parsed !parseCellValue $native-picker.value $col undefined $modal.tables $copts
     [ match
      { $parsed.ok (
       ; set $parsed.value ctrl-state.value
       ; set true ctrl-state.valid
       ; to disp !formatCellInputValue $parsed.value $col undefined $modal.tables $copts
       ; set $disp input-el.value
       !apply-input-state true $parsed.value '' false
       ; set '' add-error-el.textContent
       ; set true add-error-el.hidden
       [ match
        { $on-change : !$on-change $parsed.value }
       ]
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
    ; object { el $wrap } { input-el $input-el } { picker-btn $picker-btn } { native-picker $native-picker } { read-value $read-value } { refresh-datetime $refresh-datetime }
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
     { true : $col-label }
    ]
    ; to base-cls [ match
     { [ propertyIs integer col.type ] : 'lane-data-cell-input lane-row-picker-add-input lane-data-cell-input--num lane-data-cell-input--right' }
     { [ propertyIs decimal col.type ] : 'lane-data-cell-input lane-row-picker-add-input lane-data-cell-input--num' }
     { [ propertyIs fixed col.type ] : 'lane-data-cell-input lane-row-picker-add-input lane-data-cell-input--num lane-data-cell-input--right' }
     { [ propertyIs json col.type ] : 'lane-data-cell-input lane-row-picker-add-input lane-data-cell-input--json' }
     { true : 'lane-data-cell-input lane-row-picker-add-input' }
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
     ; to { ok val err-msg show-req } $argv
     ; to cur-text $input-el.value
     ; to is-date-empty [ match
      { $is-date-like : [ propertyIs '' cur-text ] }
      { true : false }
     ]
     ; to is-req-empty [ match
      { [ and { $show-req } { $is-req } ] : !isDataCellValueEmpty $val $single-spec }
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
    !apply-input-state true $initial-val '' false
    ; to read-value (
     ; to parsed !parseCellValue $input-el.value $col
     [ match
      { [ propertyIs false parsed.ok ] (
       !apply-input-state false null $parsed.error true
       ; to err ; add $col-label ; add ': ' $parsed.error
       ; object { ok false } { value null } { error $err }
      ) }
      { true (
       ; to is-empty !isDataCellValueEmpty $parsed.value $single-spec
       ; to is-req-empty [ match
        { $is-req : $is-empty }
        { true : false }
       ]
       [ match
        { $is-req-empty (
         !apply-input-state true $parsed.value '' true
         ; to err ; add $col-label ' is required'
         ; object { ok false } { value $parsed.value } { error $err }
        ) }
        { true (
         !apply-input-state true $parsed.value '' false
         ; object { ok true } { value $parsed.value } { error '' }
        ) }
       ]
      ) }
     ]
    )
    ; to handle-edit (
     ; to parsed !parseCellValue $input-el.value $col
     [ match
      { $parsed.ok (
       !apply-input-state true $parsed.value '' false
       ; set '' add-error-el.textContent
       ; set true add-error-el.hidden
       [ match
        { $on-change : !$on-change $parsed.value }
       ]
      ) }
      { true (
       !apply-input-state false null $parsed.error false
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
    ; object { el $input-el } { input-el $input-el } { read-value $read-value }
   ) }
  ]
 )

 ; to modal.build-add-fields (
  -- Renders labeled column controls for all columns of the linked table inside the expanded new row option
  !modal.clear-add-fields
  ; each $modal.target-columns (
   ; to { col } $argv
   ; to trimmed-name !col.name.trim
   ; to col-label [ match
    { [ propertyIs '' trimmed-name ] : '(unnamed)' }
    { true : $trimmed-name }
   ]
   ; to is-link [ match
    { $modal.link-col : [ propertyIs $modal.link-col.id col.id ] }
    { true : false }
   ]
   ; to is-disp [ match
    { $modal.display-col : [ propertyIs $modal.display-col.id col.id ] }
    { true : false }
   ]
   ; to is-req [ match
    { $col.required : true }
    { $is-link : true }
    { true : false }
   ]
   ; to type-txt !formatColumnType $col undefined undefined $modal.tables
   ; to role-txt [ match
    { [ and { $is-link } { $is-disp } ] : ' · link & display' }
    { $is-link : ' · link' }
    { $is-disp : ' · display' }
    { true : '' }
   ]
   ; to meta-txt ; add $type-txt $role-txt

   ; to field-el !document.createElement div
   ; set lane-row-picker-add-field field-el.className
   ; to header-el !document.createElement div
   ; set lane-row-picker-add-field-header header-el.className
   ; to name-el !document.createElement span
   ; assign $name-el { className lane-row-picker-add-col-name } { textContent [ ternary $is-req [ add $col-label ' *' ] $col-label ] }
   ; to meta-el !document.createElement span
   ; assign $meta-el { className lane-row-picker-add-col-meta } { textContent $meta-txt }
   !header-el.appendChild $name-el
   !header-el.appendChild $meta-el
   ; to ctrl-wrap !document.createElement div
   ; set lane-row-picker-add-control ctrl-wrap.className
   !field-el.appendChild $header-el
   !field-el.appendChild $ctrl-wrap

   ; to cur-val [ get modal.draft-values $col.id ]
   [ match
    { $col.multiple (
     ; to nested-row-target [ match
      { [ propertyIs row col.type ] : !resolveRowTarget $modal.tables $col $modal.target-table }
      { true : null }
     ]
     ; to nested-wf-target [ match
      { [ propertyIs text col.type ] : !resolveWorkflowTarget $modal.tables $col }
      { true : null }
     ]
     ; to is-selectable-multi [ match
      { [ propertyIs lane col.type ] : true }
      { [ and { [ propertyIs row col.type ] } { $nested-row-target.valid } ] : true }
      { [ and { [ propertyIs text col.type ] } { $nested-wf-target.valid } ] : true }
      { true : false }
     ]
     [ match
      { $is-selectable-multi (
       ; to multi-wrap !document.createElement div
       ; set lane-data-multi multi-wrap.className
       ; to items-el !document.createElement div
       ; set lane-data-multi-items items-el.className
       ; to add-item-btn !document.createElement button
       ; assign $add-item-btn { type button } { className lane-data-multi-add } { textContent '+' } { title 'Add or remove items' }
       ; to inline-picker-el !document.createElement div
       ; assign $inline-picker-el { className lane-inline-multiselect } { hidden true }
       ; to inline-search !document.createElement input
       ; assign $inline-search { type text } { className lane-data-multi-filter } { placeholder 'Filter options…' } { spellcheck false } { autocomplete off }
       ; to inline-list !document.createElement div
       ; set lane-inline-multiselect-list inline-list.className
       ; to inline-actions !document.createElement div
       ; set lane-row-picker-add-actions inline-actions.className
       ; to inline-cancel-btn !document.createElement button
       ; assign $inline-cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
       ; to inline-apply-btn !document.createElement button
       ; assign $inline-apply-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent Apply }
       !inline-actions.appendChild $inline-cancel-btn
       !inline-actions.appendChild $inline-apply-btn
       !inline-picker-el.appendChild $inline-search
       !inline-picker-el.appendChild $inline-list
       !inline-picker-el.appendChild $inline-actions
       !multi-wrap.appendChild $items-el
       !multi-wrap.appendChild $add-item-btn
       !multi-wrap.appendChild $inline-picker-el
       !ctrl-wrap.appendChild $multi-wrap

       ; to collect-selectable-options (
        ; to opts-out {}
        [ match
         { [ propertyIs lane col.type ] (
          ; to known-lanes [ match
           { $lane-control.list-known : !lane-control.list-known }
           { [ !window.Array.isArray $lane-control.lanes ] : $lane-control.lanes }
           { true : {} }
          ]
          ; each $known-lanes (
           ; to { kl } $argv
           ; to has-t [ match
            { [ propertyIs '' kl.title ] : false }
            { [ propertyIs $kl.id kl.title ] : false }
            { $kl.title : true }
            { true : false }
           ]
           ; to disp [ ternary $has-t $kl.title $kl.id ]
           !opts-out.push [ object { value $kl.id } { valueText $kl.id } { displayText $disp } { hasSeparateDisplay $has-t } { label [ ternary $has-t [ add $kl.title [ add ' (' [ add $kl.id ')' ] ] ] $kl.id ] } ]
          )
         ) }
         { [ propertyIs row col.type ] (
          ; each $nested-row-target.table.rows (
           ; to { nrow } $argv
           ; to nval [ get nrow.values $nested-row-target.linkCol.id ]
           ; to ninfo !lookupRowDisplay $modal.tables $col $nval null $modal.target-table
           ; condition { propertyIs false ninfo.isEmpty } (
            !opts-out.push [ object { value $nval } { valueText $ninfo.valueText } { displayText $ninfo.displayText } { hasSeparateDisplay $ninfo.hasSeparateDisplay } { label $ninfo.label } ]
           )
          )
         ) }
         { [ propertyIs text col.type ] (
          ; to seen-wf ; object
          ; each $nested-wf-target.fromValues (
           ; to { fv } $argv
           ; to already [ get seen-wf $fv ]
           [ match
            { $already : null }
            { [ propertyIs '' fv ] : null }
            { true (
             ; to seen-wf $fv true
             !opts-out.push [ object { value $fv } { valueText $fv } { displayText $fv } { hasSeparateDisplay false } { label $fv } ]
            ) }
           ]
          )
          ; each $nested-wf-target.toValues (
           ; to { tv } $argv
           ; to already [ get seen-wf $tv ]
           [ match
            { $already : null }
            { [ propertyIs '' tv ] : null }
            { true (
             ; to seen-wf $tv true
             !opts-out.push [ object { value $tv } { valueText $tv } { displayText $tv } { hasSeparateDisplay false } { label $tv } ]
            ) }
           ]
          )
         ) }
        ]
        $opts-out
       )

       ; to item-recs {}
       ; to inline-option-recs {}
       ; to inline-state ; object { open false } { draft {} } { options {} }

       ; to find-inline-draft-idx (
        ; to { v } $argv
        ; to found ; object { idx -1 }
        ; each $inline-state.draft (
         ; to { dv didx } $argv
         ; condition { propertyIs -1 found.idx } (
          ; to eq !dataValuesEqual $dv $v
          ; condition { propertyIs true eq } : ; set $didx found.idx
         )
        )
        $found.idx
       )

       ; to format-inline-val-label (
        ; to { v } $argv
        [ match
         { [ propertyIs lane col.type ] (
          ; to raw-s [ match { [ propertyIs undefined v ] : '' } { [ propertyIs null v ] : '' } { true : ; add '' $v } ]
          ; to open-l [ get lane-control.by-id $raw-s ]
          ; to cat-l [ get lane-control.catalog $raw-s ]
          ; to ltitle [ match
           { $open-l.title : $open-l.title }
           { $cat-l.title : $cat-l.title }
           { $lane-control.get-lane-title : !lane-control.get-lane-title $raw-s }
           { true : $raw-s }
          ]
          [ match
           { [ propertyIs '' ltitle ] : $raw-s }
           { [ propertyIs $raw-s ltitle ] : $raw-s }
           { true : ; add $ltitle ; add ' (' ; add $raw-s ')' }
          ]
         ) }
         { [ propertyIs row col.type ] (
          ; to info !lookupRowDisplay $modal.tables $col $v null $modal.target-table
          [ match
           { $info.label : $info.label }
           { $info.valueText : $info.valueText }
           { true : ; add '' $v }
          ]
         ) }
         { true : ; add '' $v }
        ]
       )

       ; to render-multi-items (
        ; while { propertyIsGreaterThan 0 item-recs.length } (
         ; to old-it !item-recs.pop
         !old-it.el.remove
        )
        ; to raw-arr [ get modal.draft-values $col.id ]
        ; to arr [ match
         { [ !window.Array.isArray $raw-arr ] : $raw-arr }
         { true (
          ; to fresh {}
          ; to modal.draft-values $col.id $fresh
          $fresh
         ) }
        ]
        ; each $arr (
         ; to { item-val item-idx } $argv
         ; to item-el !document.createElement div
         ; set lane-data-multi-item item-el.className
         ; to lbl-span !document.createElement span
         ; assign $lbl-span { className lane-data-row-cell-display } { textContent !format-inline-val-label $item-val }
         ; to rm-btn !document.createElement button
         ; assign $rm-btn { type button } { className lane-data-multi-remove } { textContent '×' } { title 'Remove item' }
         !rm-btn.addEventListener click (
          !arr.splice $item-idx 1
          !render-multi-items
         )
         !item-el.appendChild $lbl-span
         !item-el.appendChild $rm-btn
         !items-el.appendChild $item-el
         !item-recs.push [ object
          { el $item-el }
          { label-el $lbl-span }
          { remove-btn $rm-btn }
          { read-value : ; object { ok true } { value $item-val } { error '' } }
         ]
        )
       )

       ; to render-inline-options (
        ; while { propertyIsGreaterThan 0 inline-option-recs.length } (
         ; to old-o !inline-option-recs.pop
         !old-o.el.remove
        )
        ; to filtered !filterRowOptions $inline-state.options $inline-search.value
        ; each $filtered (
         ; to { opt-it } $argv
         ; to didx !find-inline-draft-idx $opt-it.value
         ; to is-act [ propertyIsGreaterThan -1 didx ]
         ; to obtn !document.createElement button
         ; assign $obtn { type button } { className [ ternary $is-act 'lane-row-picker-option lane-row-picker-option--active' lane-row-picker-option ] }
         !obtn.setAttribute aria-selected [ ternary $is-act 'true' 'false' ]
         ; to omain !document.createElement span
         ; set lane-row-picker-option-main omain.className
         ; to odisp !document.createElement span
         ; assign $odisp { className lane-row-picker-option-display } { textContent [ ternary $opt-it.hasSeparateDisplay $opt-it.displayText $opt-it.valueText ] }
         !omain.appendChild $odisp
         [ match
          { $opt-it.hasSeparateDisplay (
           ; to oid !document.createElement span
           ; assign $oid { className lane-row-picker-option-id } { textContent $opt-it.valueText }
           !omain.appendChild $oid
          ) }
         ]
         ; to obadge !document.createElement span
         ; assign $obadge { className [ ternary $is-act lane-row-picker-option-badge 'lane-row-picker-option-badge lane-row-picker-option-add-badge' ] } { textContent [ ternary $is-act Selected '+ Add' ] }
         !obtn.appendChild $omain
         !obtn.appendChild $obadge
         !obtn.addEventListener click (
          ; to cur-didx !find-inline-draft-idx $opt-it.value
          [ match
           { [ propertyIsGreaterThan -1 cur-didx ] : !inline-state.draft.splice $cur-didx 1 }
           { true : !inline-state.draft.push $opt-it.value }
          ]
          !render-inline-options
         )
         !inline-list.appendChild $obtn
         !inline-option-recs.push [ object { item $opt-it } { el $obtn } { active $is-act } ]
        )
       )

       ; to open-inline-picker (
        ; to opts-all !collect-selectable-options
        ; set $opts-all inline-state.options
        ; to raw-arr [ get modal.draft-values $col.id ]
        ; to copy {}
        [ match
         { [ !window.Array.isArray $raw-arr ] (
          ; each $raw-arr (
           ; to { iv } $argv
           !copy.push $iv
          )
         ) }
        ]
        ; set $copy inline-state.draft
        ; set true inline-state.open
        ; set '' inline-search.value
        ; set false inline-picker-el.hidden
        !render-inline-options
        [ match { $inline-search.focus : !inline-search.focus } ]
       )

       ; to close-inline-picker (
        ; set false inline-state.open
        ; set true inline-picker-el.hidden
       )

       !add-item-btn.addEventListener click $open-inline-picker
       !inline-search.addEventListener input $render-inline-options
       !inline-cancel-btn.addEventListener click $close-inline-picker
       !inline-apply-btn.addEventListener click (
        ; to next-arr {}
        ; each $inline-state.draft (
         ; to { dv } $argv
         !next-arr.push $dv
        )
        ; to modal.draft-values $col.id $next-arr
        ; set '' add-error-el.textContent
        ; set true add-error-el.hidden
        ; set lane-data-multi multi-wrap.className
        !close-inline-picker
        !render-multi-items
       )
       !render-multi-items
       ; to read-multi (
        ; to raw-arr [ get modal.draft-values $col.id ]
        ; to out-arr [ match
         { [ !window.Array.isArray $raw-arr ] : $raw-arr }
         { true : {} }
        ]
        ; to modal.draft-values $col.id $out-arr
        ; to is-empty !isDataCellValueEmpty $out-arr $col
        ; to is-req-empty [ match
         { $is-req : $is-empty }
         { true : false }
        ]
        [ match
         { $is-req-empty (
          ; set 'lane-data-multi lane-data-multi--required-empty' multi-wrap.className
          ; to err ; add $col-label ' is required'
          ; object { ok false } { value $out-arr } { error $err } { focus-el $add-item-btn }
         ) }
         { true (
          ; set lane-data-multi multi-wrap.className
          ; object { ok true } { value $out-arr } { error '' }
         ) }
        ]
       )
       !add-fields-el.appendChild $field-el
       ; to frec [ object
        { col $col }
        { name $col.name }
        { label $col-label }
        { is-link $is-link }
        { is-display $is-disp }
        { required $is-req }
        { multi true }
        { selectable true }
        { el $field-el }
        { header-el $header-el }
        { name-el $name-el }
        { meta-el $meta-el }
        { control-el $multi-wrap }
        { input-el $add-item-btn }
        { add-btn $add-item-btn }
        { inline-picker $inline-picker-el }
        { inline-search $inline-search }
        { inline-apply-btn $inline-apply-btn }
        { inline-cancel-btn $inline-cancel-btn }
        { inline-options $inline-option-recs }
        { items $item-recs }
        { read-value $read-multi }
       ]
       !modal.add-fields.push $frec
      ) }
      { true (
       ; to multi-wrap !document.createElement div
       ; set lane-data-multi multi-wrap.className
       ; to items-el !document.createElement div
       ; set lane-data-multi-items items-el.className
       ; to add-item-btn !document.createElement button
       ; assign $add-item-btn { type button } { className lane-data-multi-add } { textContent '+' } { title 'Add item' }
       !multi-wrap.appendChild $items-el
       !multi-wrap.appendChild $add-item-btn
       !ctrl-wrap.appendChild $multi-wrap

       ; to item-recs {}
       ; to render-multi-items (
        ; to { focus-idx } $argv
        ; while { propertyIsGreaterThan 0 item-recs.length } (
         ; to old-it !item-recs.pop
         !old-it.el.remove
        )
        ; to raw-arr [ get modal.draft-values $col.id ]
        ; to arr [ match
         { [ !window.Array.isArray $raw-arr ] : $raw-arr }
         { true (
          ; to fresh {}
          ; to modal.draft-values $col.id $fresh
          $fresh
         ) }
        ]
        ; each $arr (
         ; to { item-val item-idx } $argv
         ; to item-el !document.createElement div
         ; set lane-data-multi-item item-el.className
         ; to on-item-change (
          ; to { next-v } $argv
          ; to arr $item-idx $next-v
         )
         ; to on-item-enter (
          ; to next-idx ; add $item-idx 1
          ; to def-it !defaultDataValue $col false
          !arr.splice $next-idx 0 $def-it
          !render-multi-items $next-idx
         )
         ; to item-ctrl !modal.build-single-add-control $col $col-label $item-val false $on-item-change $on-item-enter
         ; to rm-btn !document.createElement button
         ; assign $rm-btn { type button } { className lane-data-multi-remove } { textContent '×' } { title 'Remove item' }
         !rm-btn.addEventListener click (
          !arr.splice $item-idx 1
          !render-multi-items -1
         )
         !item-el.appendChild $item-ctrl.el
         !item-el.appendChild $rm-btn
         !items-el.appendChild $item-el
         ; to irec [ object
          { el $item-el }
          { input-el $item-ctrl.input-el }
          { remove-btn $rm-btn }
          { read-value $item-ctrl.read-value }
          { refresh-datetime $item-ctrl.refresh-datetime }
         ]
         !item-recs.push $irec
        )
        [ match
         { [ propertyIsGreaterThanOrEqual 0 focus-idx ] (
          ; to target-it [ get item-recs $focus-idx ]
          [ match
           { $target-it.input-el.focus : !target-it.input-el.focus }
          ]
         ) }
        ]
       )
       !add-item-btn.addEventListener click (
        ; to raw-arr [ get modal.draft-values $col.id ]
        ; to arr [ match
         { [ !window.Array.isArray $raw-arr ] : $raw-arr }
         { true (
          ; to fresh {}
          ; to modal.draft-values $col.id $fresh
          $fresh
         ) }
        ]
        ; to def-it !defaultDataValue $col false
        !arr.push $def-it
        ; to next-idx ; subtract $arr.length 1
        !render-multi-items $next-idx
       )
       !render-multi-items -1
       ; to read-multi (
        ; to out-arr {}
        ; to bad ; object { failed false } { error '' } { input-el null }
        ; each $item-recs (
         ; to { irec iidx } $argv
         ; to ires !irec.read-value
         [ match
          { $ires.ok (
           !out-arr.push $ires.value
          ) }
          { [ propertyIs false bad.failed ] (
           ; set true bad.failed
           ; set $ires.error bad.error
           ; set $irec.input-el bad.input-el
          ) }
         ]
        )
        ; to modal.draft-values $col.id $out-arr
        [ match
         { $bad.failed (
          ; object { ok false } { value $out-arr } { error $bad.error } { focus-el $bad.input-el }
         ) }
         { true (
          ; to is-empty !isDataCellValueEmpty $out-arr $col
          ; to is-req-empty [ match
           { $is-req : $is-empty }
           { true : false }
          ]
          [ match
           { $is-req-empty (
            ; set 'lane-data-multi lane-data-multi--required-empty' multi-wrap.className
            ; to err ; add $col-label ' is required'
            ; object { ok false } { value $out-arr } { error $err } { focus-el $add-item-btn }
           ) }
           { true (
            ; set lane-data-multi multi-wrap.className
            ; object { ok true } { value $out-arr } { error '' }
           ) }
          ]
         ) }
        ]
       )
       !add-fields-el.appendChild $field-el
       ; to frec [ object
        { col $col }
        { name $col.name }
        { label $col-label }
        { is-link $is-link }
        { is-display $is-disp }
        { required $is-req }
        { multi true }
        { selectable false }
        { el $field-el }
        { header-el $header-el }
        { name-el $name-el }
        { meta-el $meta-el }
        { control-el $multi-wrap }
        { input-el $add-item-btn }
        { add-btn $add-item-btn }
        { items $item-recs }
        { read-value $read-multi }
       ]
       !modal.add-fields.push $frec
      ) }
     ]
    ) }
    { true (
     ; to on-single-change (
      ; to { next-v } $argv
      ; to modal.draft-values $col.id $next-v
     )
     ; to on-single-enter (
      !modal.save-add-row
     )
     ; to ctrl !modal.build-single-add-control $col $col-label $cur-val $is-req $on-single-change $on-single-enter
     !ctrl-wrap.appendChild $ctrl.el
     !add-fields-el.appendChild $field-el
     ; to frec [ object
      { col $col }
      { name $col.name }
      { label $col-label }
      { is-link $is-link }
      { is-display $is-disp }
      { required $is-req }
      { multi false }
      { el $field-el }
      { header-el $header-el }
      { name-el $name-el }
      { meta-el $meta-el }
      { control-el $ctrl.el }
      { input-el $ctrl.input-el }
      { read-value $ctrl.read-value }
      { refresh-datetime $ctrl.refresh-datetime }
     ]
     !modal.add-fields.push $frec
    ) }
   ]
  )
 )

 ; to modal.expand-add (
  -- Expands the top blank row into the full new row form without saving until Save is clicked
  ; condition { propertyIs true modal.can-add } (
   ; condition { propertyIs false modal.add-expanded } (
    ; set true modal.add-expanded
    !modal.init-draft-values
    !modal.build-add-fields
    !modal.sync-add-visibility
    ; to first-f [ get modal.add-fields 0 ]
    [ match
     { $first-f.input-el.focus : !first-f.input-el.focus }
    ]
   )
  )
 )

 ; to modal.collapse-add (
  -- Collapses the expanded new row form back to the blank row with + Add and discards draft values
  ; set false modal.add-expanded
  !modal.clear-add-fields
  ; set [ object ] modal.draft-values
  !modal.sync-add-visibility
 )

 ; to modal.save-add-row (
  -- Validates the draft new row fields, saves to the linked table, and either closes (single) or adds to draft selection (multiple)
  ; condition { propertyIs true modal.is-open } (
   ; condition { propertyIs true modal.add-expanded } (
    ; to next-values ; object
    ; to failure ; object { failed false } { error '' } { focus-el null }
    ; each $modal.add-fields (
     ; to { frec } $argv
     ; to res !frec.read-value
     [ match
      { $res.ok (
       ; to next-values $frec.col.id $res.value
       ; to modal.draft-values $frec.col.id $res.value
      ) }
      { [ propertyIs false failure.failed ] (
       ; set true failure.failed
       ; set $res.error failure.error
       ; set [ match { $res.focus-el : $res.focus-el } { true : $frec.input-el } ] failure.focus-el
      ) }
     ]
    )
    [ match
     { $failure.failed (
      ; set $failure.error add-error-el.textContent
      ; set false add-error-el.hidden
      [ match
       { $failure.focus-el.focus : !failure.focus-el.focus }
      ]
      ; object { ok false } { error $failure.error }
     ) }
     { true (
      ; set '' add-error-el.textContent
      ; set true add-error-el.hidden
      ; to created [ match
       { $modal.on-create-row : !modal.on-create-row $next-values }
       { true : ; object { ok false } { error 'Cannot create row' } }
      ]
      [ match
       { $created.ok [ match
        { [ propertyIs true modal.multiple ] (
         ; to has-new-val [ match
          { [ propertyIs undefined created.value ] : false }
          { [ propertyIs null created.value ] : false }
          { true : true }
         ]
         ; condition { propertyIs true has-new-val } (
          ; to dup-idx !find-selected-val-idx $created.value
          ; condition { propertyIs -1 dup-idx } : !modal.selected-values.push $created.value
         )
         [ match
          { $created.after-select : ; set $created.after-select modal.pending-after-select }
         ]
         !modal.collapse-add
         ; set {} modal.loaded-items
         ; set 0 modal.next-offset
         ; set true modal.has-more
         ; set 0 modal.pages-loaded
         ; to next-seq ; add $modal.load-seq 1
         ; set $next-seq modal.load-seq
         !modal.ensure-loaded
         $created
        ) }
        { true (
         ; to cb $modal.on-select
         ; to post-cb $created.after-select
         !modal.close
         [ match
          { $cb : !$cb $created.value }
         ]
         [ match
          { $post-cb : !$post-cb }
         ]
         $created
        ) }
       ] }
       { true (
        ; to err-msg [ match
         { $created.error : $created.error }
         { true : 'Failed to create row' }
        ]
        ; set $err-msg add-error-el.textContent
        ; set false add-error-el.hidden
        $created
       ) }
      ]
     ) }
    ]
   )
  )
 )

 ; to modal.close (
  -- Closes the row picker modal and resets session callbacks
  ; condition { propertyIs true modal.is-open } (
   ; to seq ; add $modal.load-seq 1
   ; set $seq modal.load-seq
   ; to prev-lane $modal.lane
   ; to post-cb $modal.pending-after-select
   ; set false modal.is-open
   ; set false modal.multiple
   ; set false modal.loading
   ; set false modal.can-add
   !modal.collapse-add
   !modal.clear-selected-chips
   ; set true selected-section.hidden
   ; set true apply-btn.hidden
   ; set 0 modal.selected-values.length
   ; set null modal.resolve-display
   ; set null modal.pending-after-select
   ; set null modal.target-table
   ; set {} modal.target-columns
   ; set null modal.link-col
   ; set null modal.display-col
   ; set {} modal.tables
   ; set null modal.initial-row-values
   ; set null modal.on-create-row
   ; set null modal.lane
   ; set null modal.fetch-page
   ; set null modal.on-select
   !backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $modal }
   ]
   [ match
    { $post-cb : !$post-cb }
   ]
  )
 )

 ; to modal.apply (
  -- Applies the multiselect draft values list, closes the modal, and forwards the array to on-select
  ; condition { propertyIs true modal.is-open } (
   ; condition { propertyIs true modal.multiple } (
    ; to out {}
    ; each $modal.selected-values (
     ; to { sv } $argv
     !out.push $sv
    )
    ; to cb $modal.on-select
    ; to post-cb $modal.pending-after-select
    ; set null modal.pending-after-select
    !modal.close
    [ match
     { $cb : !$cb $out }
    ]
    [ match
     { $post-cb : !$post-cb }
    ]
   )
  )
 )

 ; to modal.render (
  -- Renders filtered row/state options, multiselect chips, loading/error status, and footer controls
  !modal.render-selected-chips
  ; set [ ternary $modal.multiple false true ] apply-btn.hidden
  ; while { propertyIsGreaterThan 0 modal.row-els.length } (
   ; to old-el !modal.row-els.pop
   !old-el.remove
  )
  ; set 0 modal.option-items.length

  ; to matches !filterRowOptions $modal.loaded-items $modal.query
  ; to visible !matches.slice 0 $modal.target-limit
  ; to trimmed-q !modal.query.trim
  ; to has-query [ match
   { [ propertyIs '' trimmed-q ] : false }
   { true : true }
  ]

  [ match
   { [ propertyIs true modal.multiple ] (
    ; set [ ternary [ propertyIsGreaterThan 0 modal.selected-values.length ] false true ] clear-btn.hidden
    ; set 'Clear all selected' clear-btn.title
   ) }
   { true (
    ; set [ ternary $modal.has-selected false true ] clear-btn.hidden
    ; set 'Clear selected row' clear-btn.title
   ) }
  ]

  ; to noun-one $modal.item-noun
  ; to noun-many $modal.item-noun-plural

  [ match
   { [ propertyIs '' modal.error ] [ match
    { $modal.loading (
     ; to msg [ ternary $has-query [ add 'Searching ' [ add $noun-many '…' ] ] [ add 'Loading ' [ add $noun-many '…' ] ] ]
     ; set $msg status-el.textContent
     ; set lane-import-status status-el.className
     ; set false status-el.hidden
    ) }
    { true (
     ; set '' status-el.textContent
     ; set true status-el.hidden
    ) }
   ] }
   { true (
    ; set $modal.error status-el.textContent
    ; set 'lane-import-status lane-import-status--error' status-el.className
    ; set false status-el.hidden
   ) }
  ]

  ; to has-hidden-matches [ propertyIsGreaterThan $visible.length matches.length ]
  ; to can-load-more [ match
   { $modal.has-more : true }
   { $has-hidden-matches : true }
   { true : false }
  ]
  ; set [ ternary $can-load-more false true ] more-btn.hidden
  ; set $modal.loading more-btn.disabled
  ; set [ ternary $modal.loading 'Loading…' 'Load more' ] more-btn.textContent

  ; to total-unit [ ternary [ propertyIs 1 modal.total-count ] [ add ' ' $noun-one ] [ add ' ' $noun-many ] ]
  ; to count-text [ match
   { [ propertyIs true modal.loading ] [ match
    { [ propertyIs 0 modal.pages-loaded ] : [ add 'Loading ' [ add $noun-many '…' ] ] }
    { $has-query : ; add $matches.length ; add '+ matching (' ; add $modal.loaded-items.length ; add '/' ; add $modal.total-count ' scanned)' }
    { true : ; add 'Showing ' ; add $visible.length ; add ' of ' ; add $modal.total-count $total-unit }
   ] }
   { $has-query [ match
    { $modal.has-more : ; add $matches.length ; add '+ matching (' ; add $modal.loaded-items.length ; add '/' ; add $modal.total-count ' scanned)' }
    { true : ; add $matches.length ; add ' matching of ' ; add $modal.total-count $total-unit }
   ] }
   { $can-load-more : ; add 'Showing ' ; add $visible.length ; add ' of ' ; add $modal.total-count $total-unit }
   { true (
    ; to unit [ ternary [ propertyIs 1 visible.length ] [ add ' ' $noun-one ] [ add ' ' $noun-many ] ]
    ; add $visible.length $unit
   ) }
  ]
  ; set $count-text count-el.textContent

  [ match
   { [ propertyIs 0 visible.length ] (
    ; condition { propertyIs false modal.loading } (
     ; to empty-el !document.createElement div
     ; set lane-modal-empty empty-el.className
     ; to empty-msg [ match
      { [ propertyIs '' modal.error ] [ match
       { [ propertyIs 0 modal.total-count ] : $modal.empty-message }
       { $has-query : [ add 'No matching ' [ add $noun-many ' found.' ] ] }
       { true : 'No selectable values in linked column.' }
      ] }
      { true : $modal.error }
     ]
     ; set $empty-msg empty-el.textContent
     !list-el.appendChild $empty-el
     !modal.row-els.push $empty-el
    )
   ) }
   { true (
    ; each $visible (
     ; to { item } $argv
     ; to is-active [ match
      { [ propertyIs true modal.multiple ] (
       ; to sidx !find-selected-val-idx $item.value
       [ propertyIsGreaterThan -1 sidx ]
      ) }
      { $modal.has-selected : !dataValuesEqual $item.value $modal.selected-value }
      { true : false }
     ]
     ; to opt-btn !document.createElement button
     ; to cls [ ternary $is-active 'lane-row-picker-option lane-row-picker-option--active' lane-row-picker-option ]
     ; assign $opt-btn { type button } { className $cls }
     !opt-btn.setAttribute aria-selected [ ternary $is-active 'true' 'false' ]

     ; to main-el !document.createElement span
     ; set lane-row-picker-option-main main-el.className
     ; to disp-el !document.createElement span
     ; set lane-row-picker-option-display disp-el.className
     [ match
      { $item.hasSeparateDisplay (
       ; set $item.displayText disp-el.textContent
       !main-el.appendChild $disp-el
       ; to id-el !document.createElement span
       ; assign $id-el { className lane-row-picker-option-id } { textContent $item.valueText }
       !main-el.appendChild $id-el
      ) }
      { true (
       ; set $item.valueText disp-el.textContent
       !main-el.appendChild $disp-el
      ) }
     ]
     !opt-btn.appendChild $main-el

     ; to badge-el [ match
      { $is-active (
       ; to b-el !document.createElement span
       ; assign $b-el { className lane-row-picker-option-badge } { textContent Selected }
       !opt-btn.appendChild $b-el
       $b-el
      ) }
      { [ propertyIs true modal.multiple ] (
       ; to b-el !document.createElement span
       ; assign $b-el { className 'lane-row-picker-option-badge lane-row-picker-option-add-badge' } { textContent '+ Add' }
       !opt-btn.appendChild $b-el
       $b-el
      ) }
      { true : null }
     ]

     !opt-btn.addEventListener click (
      [ match
       { [ propertyIs true modal.multiple ] : !modal.toggle-value $item.value }
       { true (
        ; to cb $modal.on-select
        ; to chosen $item.value
        !modal.close
        [ match
         { $cb : !$cb $chosen }
        ]
       ) }
      ]
     )

     !list-el.appendChild $opt-btn
     !modal.row-els.push $opt-btn
     ; to opt-rec ; object { item $item } { el $opt-btn } { active $is-active } { badge-el $badge-el }
     !modal.option-items.push $opt-rec
    )
   ) }
  ]
 )

 ; to modal.ensure-loaded (
  -- Fetches pages asynchronously only until target-limit matches are available or source rows are exhausted
  ; to seq $modal.load-seq
  ; to initial-matches !filterRowOptions $modal.loaded-items $modal.query
  ; to needs-fetch [ match
   { [ propertyIs false modal.is-open ] : false }
   { [ propertyIs false modal.has-more ] : false }
   { [ propertyIsGreaterThanOrEqual $modal.target-limit initial-matches.length ] : false }
   { $modal.fetch-page : true }
   { true : false }
  ]

  [ match
   { [ propertyIs true needs-fetch ] (
    ; set true modal.loading
    ; set '' modal.error
    !modal.render
    ; to loop ; object { keep true }
    ; while { propertyIs true loop.keep } (
     ; to cur-matches !filterRowOptions $modal.loaded-items $modal.query
     ; to stop-early [ match
      { [ propertyIs false modal.is-open ] : true }
      { [ propertyIs false modal.has-more ] : true }
      { [ propertyIsGreaterThanOrEqual $modal.target-limit cur-matches.length ] : true }
      { true : false }
     ]
     [ match
      { $stop-early : ; set false loop.keep }
      { true (
       ; to prev-offset $modal.next-offset
       ; to res ; try (
        !modal.fetch-page $prev-offset $modal.page-size
       ) (
        ; to { err } $argv
        ; to err-msg [ match
         { $err.message : $err.message }
         { true : 'Failed to load rows' }
        ]
        ; object { ok false } { error $err-msg }
       )
       ; to still-active [ match
        { [ propertyIs false modal.is-open ] : false }
        { [ propertyIs $seq modal.load-seq ] : true }
        { true : false }
       ]
       [ match
        { [ propertyIs false still-active ] : ; set false loop.keep }
        { [ propertyIs false res.ok ] (
         ; to err-text [ match
          { $res.error : $res.error }
          { true : 'Failed to load rows' }
         ]
         ; set $err-text modal.error
         ; set false modal.has-more
         ; set false loop.keep
        ) }
        { true (
         ; to next-pages ; add $modal.pages-loaded 1
         ; set $next-pages modal.pages-loaded
         ; to page-items [ match
          { [ !window.Array.isArray $res.items ] : $res.items }
          { true : {} }
         ]
         ; each $page-items (
          ; to { it } $argv
          !modal.loaded-items.push $it
         )
         ; to next-off [ match
          { [ propertyIs undefined res.nextOffset ] : ; add $prev-offset $page-items.length }
          { [ propertyIs null res.nextOffset ] : ; add $prev-offset $page-items.length }
          { true : $res.nextOffset }
         ]
         ; set $next-off modal.next-offset
         ; to advanced [ propertyIsGreaterThan $prev-offset next-off ]
         ; to more [ match
          { [ propertyIs false res.hasMore ] : false }
          { [ propertyIs false advanced ] : false }
          { true : true }
         ]
         ; set $more modal.has-more
         [ match
          { [ propertyIs undefined res.total ] : null }
          { [ propertyIs null res.total ] : null }
          { true : ; set $res.total modal.total-count }
         ]
         ; to after-matches !filterRowOptions $modal.loaded-items $modal.query
         ; condition { propertyIs false more } : ; set false loop.keep
         ; condition { propertyIsGreaterThanOrEqual $modal.target-limit after-matches.length } : ; set false loop.keep
        ) }
       ]
      ) }
     ]
    )
    ; condition { propertyIs $seq modal.load-seq } (
     ; set false modal.loading
     !modal.render
    )
   ) }
   { true (
    ; set false modal.loading
    !modal.render
   ) }
  ]
 )

 ; to modal.load-more (
  -- Increases target match limit by one page and fetches additional pages only as needed
  ; condition { propertyIs true modal.is-open } (
   ; condition { propertyIs false modal.loading } (
    ; to next-limit ; add $modal.target-limit $modal.page-size
    ; set $next-limit modal.target-limit
    !modal.ensure-loaded
   )
  )
 )

 ; to modal.refresh-clock-displays (
  -- Refreshes datetime inputs, chips, and loaded row options when timezone or 12h/24h preferences change while open
  ; condition { propertyIs true modal.is-open } (
   ; each $modal.add-fields (
    ; to { frec } $argv
    [ match
     { $frec.refresh-datetime : !frec.refresh-datetime }
    ]
    [ match
     { $frec.items (
      ; each $frec.items (
       ; to { it } $argv
       [ match
        { $it.refresh-datetime : !it.refresh-datetime }
       ]
      )
     ) }
    ]
   )
   [ match
    { $modal.fetch-page (
     ; to next-seq ; add $modal.load-seq 1
     ; set $next-seq modal.load-seq
     ; set 0 modal.loaded-items.length
     ; set 0 modal.next-offset
     ; set true modal.has-more
     ; set 0 modal.pages-loaded
     !modal.ensure-loaded
    ) }
    { true : !modal.render }
   ]
  )
 )

 ; to modal.open (
  -- Opens the row picker modal in single or multiselect mode and fetches only the initial page of options asynchronously
  ; to { opts } $argv
  ; to seq ; add $modal.load-seq 1
  ; set $seq modal.load-seq
  ; to is-multi [ ternary $opts.multiple true false ]
  ; to title [ match
   { $opts.title : $opts.title }
   { $is-multi : 'Select Rows' }
   { true : 'Select Row' }
  ]
  ; to placeholder [ match
   { $opts.placeholder : $opts.placeholder }
   { true : 'Filter rows...' }
  ]
  ; to psize [ match
   { [ propertyIsGreaterThan 0 opts.page-size ] : $opts.page-size }
   { true : $fallback-page-size }
  ]
  ; to cur-val $opts.current-value
  ; to has-cur [ match
   { [ propertyIs undefined cur-val ] : false }
   { [ propertyIs null cur-val ] : false }
   { true : true }
  ]

  ; set $is-multi modal.multiple
  ; set $title heading-el.textContent
  ; set $placeholder search-input.placeholder
  ; set $psize modal.page-size
  ; set $psize modal.target-limit
  ; set '' modal.query
  ; set '' search-input.value
  ; set '' modal.error
  ; set {} modal.loaded-items
  ; set 0 modal.next-offset
  ; set true modal.has-more
  ; set 0 modal.total-count
  ; set 0 modal.pages-loaded
  ; set null modal.pending-after-select
  ; set [ match { $opts.item-noun : $opts.item-noun } { true : row } ] modal.item-noun
  ; set [ match { $opts.item-noun-plural : $opts.item-noun-plural } { true : rows } ] modal.item-noun-plural
  ; set [ match { $opts.empty-message : $opts.empty-message } { true : 'No rows available in linked table.' } ] modal.empty-message
  ; set [ match { $opts.resolve-display : $opts.resolve-display } { true : null } ] modal.resolve-display
  ; set 0 modal.selected-values.length
  [ match
   { $is-multi (
    ; set null modal.selected-value
    ; set false modal.has-selected
    ; to raw-list [ match
     { [ !window.Array.isArray $opts.current-values ] : $opts.current-values }
     { [ !window.Array.isArray $opts.current-value ] : $opts.current-value }
     { true : {} }
    ]
    ; each $raw-list (
     ; to { rval } $argv
     ; to is-undef [ match
      { [ propertyIs undefined rval ] : true }
      { [ propertyIs null rval ] : true }
      { true : false }
     ]
     ; condition { propertyIs false is-undef } (
      ; to dup-idx !find-selected-val-idx $rval
      ; condition { propertyIs -1 dup-idx } : !modal.selected-values.push $rval
     )
    )
   ) }
   { true (
    ; set $cur-val modal.selected-value
    ; set $has-cur modal.has-selected
   ) }
  ]
  ; set [ match { $opts.fetch-page : $opts.fetch-page } { true : null } ] modal.fetch-page
  ; set [ match { $opts.on-select : $opts.on-select } { true : null } ] modal.on-select
  ; to target-tbl [ match { $opts.target-table : $opts.target-table } { true : null } ]
  ; to target-cols [ match
   { [ !window.Array.isArray $opts.target-columns ] : $opts.target-columns }
   { [ !window.Array.isArray $target-tbl.columns ] : $target-tbl.columns }
   { true : {} }
  ]
  ; to on-create [ match { $opts.on-create-row : $opts.on-create-row } { true : null } ]
  ; to can-add [ match
   { [ and { $on-create } { [ propertyIsGreaterThan 0 target-cols.length ] } ] : true }
   { true : false }
  ]
  ; set $target-tbl modal.target-table
  ; set $target-cols modal.target-columns
  ; set [ match { $opts.link-col : $opts.link-col } { true : null } ] modal.link-col
  ; set [ match { $opts.display-col : $opts.display-col } { true : null } ] modal.display-col
  ; set [ match { [ !window.Array.isArray $opts.tables ] : $opts.tables } { true : {} } ] modal.tables
  ; set [ match { $opts.initial-row-values : $opts.initial-row-values } { true : null } ] modal.initial-row-values
  ; set $on-create modal.on-create-row
  ; set $can-add modal.can-add
  !modal.collapse-add

  ; condition { propertyIs true modal.is-open } (
   [ match
    { [ and { $modal.lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $modal.lane $modal }
   ]
  )
  ; to target-lane [ match
   { $opts.lane : $opts.lane }
   { [ and { $opts.lane-id } { $lane-control.resolve-lane } ] : !lane-control.resolve-lane $opts.lane-id }
   { $opts.lane-id : [ get lane-control.by-id $opts.lane-id ] }
   { true : null }
  ]
  ; set $target-lane modal.lane
  ; set true modal.is-open
  [ match
   { [ and { $target-lane } { $lane-control.mount-lane-modal } ] : !lane-control.mount-lane-modal $target-lane $modal }
   { $opts.host.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-row-picker-backdrop lane-modal-backdrop--lane' backdrop.className
    !opts.host.appendChild $backdrop
   ) }
   { $target-lane.body.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-row-picker-backdrop lane-modal-backdrop--lane' backdrop.className
    !target-lane.body.appendChild $backdrop
   ) }
   { $modal.host.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-row-picker-backdrop lane-modal-backdrop--lane' backdrop.className
    !modal.host.appendChild $backdrop
   ) }
   { $document.body.appendChild : !document.body.appendChild $backdrop }
  ]
  [ match
   { $search-input.focus : !search-input.focus }
  ]
  !modal.ensure-loaded
  $modal
 )

 !close-btn.addEventListener click $modal.close
 !cancel-btn.addEventListener click $modal.close
 !apply-btn.addEventListener click $modal.apply
 !add-trigger-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !modal.expand-add
 )
 !add-badge-el.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !modal.expand-add
 )
 !add-cancel-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !modal.collapse-add
 )
 !add-save-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !modal.save-add-row
 )
 !clear-btn.addEventListener click (
  [ match
   { [ propertyIs true modal.multiple ] (
    ; set 0 modal.selected-values.length
    !modal.render
   ) }
   { true (
    ; to cb $modal.on-select
    !modal.close
    [ match
     { $cb : !$cb null }
    ]
   ) }
  ]
 )
 !more-btn.addEventListener click $modal.load-more
 !search-input.addEventListener input (
  ; set $search-input.value modal.query
  ; set $modal.page-size modal.target-limit
  ; to next-seq ; add $modal.load-seq 1
  ; set $next-seq modal.load-seq
  !modal.ensure-loaded
 )
 !list-el.addEventListener scroll (
  ; condition { propertyIs true modal.is-open } (
   ; condition { propertyIs false modal.loading } (
    ; condition { propertyIs true modal.has-more } (
     ; to ch $list-el.clientHeight
     ; to sh $list-el.scrollHeight
     ; to st $list-el.scrollTop
     ; to has-geom [ match
      { [ propertyIsGreaterThan 0 ch ] : [ propertyIsGreaterThan 0 sh ] }
      { true : false }
     ]
     ; condition { propertyIs true has-geom } (
      ; to bottom ; add $st $ch
      ; to threshold ; subtract $sh 24
      ; condition { propertyIsGreaterThanOrEqual $threshold bottom } : !modal.load-more
     )
    )
   )
  )
 )
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
 )
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.close
   )
  ) }
 ]

 $modal
)
$scope
