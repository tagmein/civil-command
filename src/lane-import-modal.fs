-- file lane-import-modal.fs
; to lane-scope ; load /src/lane-scope.fs
; to scope ; object
; to scope.create (
 -- Creates a modal picker for importing a value from another idle lane's final Scope browser
 ; to { lane-control } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-import-backdrop' backdrop.className
 ; to panel !document.createElement div
 ; set 'lane-modal lane-import-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-modal-title-wrap title-wrap.className
 ; to heading !document.createElement div
 ; assign $heading { className lane-modal-title } { textContent 'Import from Lane' }
 ; to subtitle !document.createElement div
 ; assign $subtitle { className lane-modal-count } { textContent 'Import a whole lane or pick a specific value once idle' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading
 !title-wrap.appendChild $subtitle
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to lanes-section !document.createElement div
 ; set lane-import-section lanes-section.className
 ; to lanes-label !document.createElement div
 ; assign $lanes-label { className lane-config-label } { textContent 'Source Lane' }
 ; to lanes-el !document.createElement div
 ; set lane-import-lanes lanes-el.className
 !lanes-section.appendChild $lanes-label
 !lanes-section.appendChild $lanes-el

 ; to status-el !document.createElement div
 ; set lane-import-status status-el.className
 ; set true status-el.hidden

 ; to scope-section !document.createElement div
 ; set 'lane-import-section lane-import-scope-section' scope-section.className
 ; to scope-header !document.createElement div
 ; set lane-import-scope-header scope-header.className
 ; to scope-label !document.createElement div
 ; assign $scope-label { className lane-config-label } { textContent 'Final Scope (optional — leave at root to import the whole lane)' }
 ; to whole-lane-btn !document.createElement button
 ; assign $whole-lane-btn { type button } { className 'lane-import-whole-btn lane-import-whole-btn--active' } { textContent 'Whole lane' } { title 'Import the entire lane scope without picking a single value' }
 !scope-header.appendChild $scope-label
 !scope-header.appendChild $whole-lane-btn
 ; to scope-wrap !document.createElement div
 ; set lane-import-scope-wrap scope-wrap.className
 !scope-section.appendChild $scope-header
 !scope-section.appendChild $scope-wrap

 ; to form !document.createElement form
 ; set lane-import-form form.className
 ; to alias-row !document.createElement div
 ; set lane-import-alias-row alias-row.className
 ; to alias-field !document.createElement div
 ; set lane-import-alias-field alias-field.className
 ; to alias-label !document.createElement label
 ; assign $alias-label { className lane-config-label } { textContent 'Assign as' }
 ; to alias-input !document.createElement input
 ; assign $alias-input { type text } { className lane-config-input } { placeholder 'Same name or custom variable name...' } { spellcheck false } { autocomplete off }
 !alias-field.appendChild $alias-label
 !alias-field.appendChild $alias-input

 ; to summary-field !document.createElement div
 ; set lane-import-summary-field summary-field.className
 ; to summary-label !document.createElement div
 ; assign $summary-label { className lane-config-label } { textContent 'Selected Import' }
 ; to summary-el !document.createElement div
 ; assign $summary-el { className lane-import-summary } { textContent 'Select a lane above' }
 !summary-field.appendChild $summary-label
 !summary-field.appendChild $summary-el

 !alias-row.appendChild $alias-field
 !alias-row.appendChild $summary-field

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to confirm-btn !document.createElement button
 ; assign $confirm-btn { type submit } { className 'lane-modal-action lane-config-btn--save' } { textContent Import }
 ; set true confirm-btn.disabled
 !footer.appendChild $cancel-btn
 !footer.appendChild $confirm-btn

 !form.appendChild $alias-row
 !form.appendChild $footer

 !panel.appendChild $header
 !panel.appendChild $lanes-section
 !panel.appendChild $status-el
 !panel.appendChild $scope-section
 !panel.appendChild $form
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { form $form }
  { lanes-el $lanes-el }
  { status-el $status-el }
  { scope-wrap $scope-wrap }
  { whole-lane-btn $whole-lane-btn }
  { alias-input $alias-input }
  { summary-el $summary-el }
  { close-btn $close-btn }
  { cancel-btn $cancel-btn }
  { confirm-btn $confirm-btn }
  { is-open false }
  { lane null }
  { lane-loaded false }
  { current-lane-id '' }
  { selected-lane-id '' }
  { selected-lane-title '' }
  { selected-path {} }
  { alias '' }
  { custom-alias false }
  { on-confirm null }
  { load-seq 0 }
  { open-seq 0 }
  { lane-items {} }
  { lane-els {} }
 ]

 ; to modal.default-lane-alias (
  -- Derives a clean default variable name from a lane title for whole-lane imports
  ; to { title } $argv
  ; to text [ match
   { $title : ; add '' $title }
   { true : '' }
  ]
  ; to trimmed !text.trim
  [ match
   { [ propertyIs '' trimmed ] : lane }
   { true (
    ; to lower !trimmed.toLowerCase
    ; to parts !lower.split ' '
    ; to kept {}
    ; each $parts (
     ; to { part } $argv
     ; to is-empty [ propertyIs '' part ]
     ; condition { propertyIs false is-empty } : !kept.push $part
    )
    ; to slug !kept.join '-'
    [ match
     { [ propertyIs '' slug ] : lane }
     { true : $slug }
    ]
   ) }
  ]
 )

 ; to modal.update-summary (
  -- Updates the selected import summary text, Whole lane button state, and Import button enabled state
  ; to has-lane [ match
   { [ propertyIs '' modal.selected-lane-id ] : false }
   { true : true }
  ]
  ; to is-whole [ propertyIs 0 modal.selected-path.length ]
  ; to ready [ ternary $has-lane $modal.lane-loaded false ]
  ; set [ ternary $ready false true ] confirm-btn.disabled
  ; set [ ternary $is-whole 'lane-import-whole-btn lane-import-whole-btn--active' lane-import-whole-btn ] whole-lane-btn.className
  !whole-lane-btn.setAttribute aria-pressed [ ternary $is-whole 'true' 'false' ]
  [ match
   { $ready (
    ; to lane-label [ match
     { [ propertyIs '' modal.selected-lane-title ] : $modal.selected-lane-id }
     { true : $modal.selected-lane-title }
    ]
    ; to txt [ match
     { $is-whole : ; add $lane-label ' · (whole lane)' }
     { true (
      ; to joined !modal.selected-path.join '.'
      ; add $lane-label ; add ' · $' $joined
     ) }
    ]
    ; set $txt summary-el.textContent
   ) }
   { $has-lane : ; set 'Waiting for lane to become idle…' summary-el.textContent }
   { true : ; set 'Select a lane above' summary-el.textContent }
  ]
 )

 ; to scope-opts [ object
  { on-select (
   ; to { next-path } $argv
   ; set $next-path modal.selected-path
   ; to should-fill [ match
    { [ propertyIs false modal.custom-alias ] : true }
    { [ propertyIs '' modal.alias ] : true }
    { true : false }
   ]
   ; condition { propertyIs true should-fill } (
    ; to auto-alias [ match
     { [ propertyIsGreaterThan 0 next-path.length ] (
      ; to last-idx ; subtract $next-path.length 1
      [ get next-path $last-idx ]
     ) }
     { true : !modal.default-lane-alias $modal.selected-lane-title }
    ]
    ; set $auto-alias modal.alias
    ; set $auto-alias alias-input.value
   )
   !modal.update-summary
  ) }
 ]
 ; to scope-view !lane-scope.mount null $scope-wrap $scope-opts
 ; set $scope-view modal.scope-view
 !whole-lane-btn.addEventListener click : !scope-view.select {}

 ; to modal.set-status (
  -- Displays or hides the status / error banner above the Scope browser
  ; to { message is-error } $argv
  [ match
   { [ propertyIs '' message ] (
    ; set '' status-el.textContent
    ; set true status-el.hidden
   ) }
   { true (
    ; set $message status-el.textContent
    ; to cls [ match
     { $is-error : 'lane-import-status lane-import-status--error' }
     { true : 'lane-import-status cc-loading' }
    ]
    ; set $cls status-el.className
    ; set false status-el.hidden
   ) }
  ]
 )

 ; to modal.update-lane-buttons (
  -- Highlights the active source lane button
  ; each $modal.lane-items (
   ; to { item } $argv
   ; to active [ propertyIs $item.id modal.selected-lane-id ]
   ; to cls [ ternary $active 'lane-import-lane-btn lane-import-lane-btn--active' lane-import-lane-btn ]
   ; set $cls item.el.className
   !item.el.setAttribute aria-pressed [ ternary $active 'true' 'false' ]
  )
 )

 ; to modal.select-lane (
  -- Waits for the chosen lane to become idle and renders its final state in the Scope browser
  ; to { lane-id title initial-path } $argv
  ; to seq ; add $modal.load-seq 1
  ; set $seq modal.load-seq
  ; set false modal.lane-loaded
  ; set $lane-id modal.selected-lane-id
  ; to resolved-title [ match
   { $title : $title }
   { true : !lane-control.get-lane-title $lane-id }
  ]
  ; set $resolved-title modal.selected-lane-title
  ; to path-to-use [ match
   { [ !window.Array.isArray $initial-path ] : !initial-path.slice 0 }
   { true : {} }
  ]
  ; set $path-to-use modal.selected-path
  !modal.update-lane-buttons
  !modal.update-summary
  !modal.set-status 'Waiting for lane to finish running…' false
  ; set true scope-wrap.hidden

  ; to res-box ; object { res null }
  ; try (
   ; to r !lane-control.get-lane-final-state $lane-id $modal.current-lane-id
   ; set $r res-box.res
  ) (
   ; to { err } $argv
   ; to emsg [ match { $err.message : $err.message } { true : 'Failed to inspect lane state' } ]
   ; set [ object { ok false } { error $emsg } ] res-box.res
   null
  )
  ; to result $res-box.res
  ; condition { propertyIs $seq modal.load-seq } (
   [ match
    { $result.ok (
     ; set true modal.lane-loaded
     !modal.set-status '' false
     ; set false scope-wrap.hidden
     ; set $path-to-use scope-view.selected-path
     !scope-view.render $result.state
     ; set $scope-view.selected-path modal.selected-path
     ; condition { propertyIs 0 modal.selected-path.length } (
      ; to should-fill [ match
       { [ propertyIs false modal.custom-alias ] : true }
       { [ propertyIs '' modal.alias ] : true }
       { true : false }
      ]
      ; condition { propertyIs true should-fill } (
       ; to auto-alias !modal.default-lane-alias $resolved-title
       ; set $auto-alias modal.alias
       ; set $auto-alias alias-input.value
      )
     )
     !modal.update-summary
    ) }
    { true (
     ; set false modal.lane-loaded
     ; set {} modal.selected-path
     ; set true scope-wrap.hidden
     !modal.set-status $result.error true
     !modal.update-summary
    ) }
   ]
  )
 )

 ; to modal.render-lanes (
  -- Renders buttons for all other open and known lanes
  ; while { propertyIsGreaterThan 0 modal.lane-els.length } (
   ; to old-el !modal.lane-els.pop
   !old-el.remove
  )
  ; set 0 modal.lane-items.length
  ; to lanes-load-el !document.createElement div
  ; assign $lanes-load-el { className 'cc-loading cc-loading--compact' } { textContent 'Loading lanes…' }
  !lanes-el.appendChild $lanes-load-el
  !modal.lane-els.push $lanes-load-el

  ; to seen ; object
  ; to candidates {}

  -- Open lanes first
  ; each $lane-control.lanes (
   ; to { lane } $argv
   ; to is-self [ propertyIs $lane.id modal.current-lane-id ]
   ; condition { propertyIs false is-self } (
    ; to seen $lane.id true
    ; to entry [ object
     { id $lane.id }
     { title $lane.title }
     { is-open true }
    ]
    !candidates.push $entry
   )
  )

  -- Then closed known lanes from persistent catalog
  ; to known ; try ( !lane-control.list-known ) ( {} )
  ; each $known (
   ; to { entry } $argv
   ; to is-self [ propertyIs $entry.id modal.current-lane-id ]
   ; to already [ get seen $entry.id ]
   ; condition { propertyIs false is-self } (
    [ match
     { $already : null }
     { true (
      ; to seen $entry.id true
      ; to rec [ object
       { id $entry.id }
       { title $entry.title }
       { is-open false }
      ]
      !candidates.push $rec
     ) }
    ]
   )
  )

  ; while { propertyIsGreaterThan 0 modal.lane-els.length } (
   ; to old-el !modal.lane-els.pop
   !old-el.remove
  )

  [ match
   { [ propertyIs 0 candidates.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-import-empty } { textContent 'No other lanes available. Create or open another lane first.' }
    !lanes-el.appendChild $empty-el
    !modal.lane-els.push $empty-el
    ; set true scope-wrap.hidden
    !modal.set-status '' false
   ) }
   { true (
    ; each $candidates (
     ; to { cand } $argv
     ; to btn !document.createElement button
     ; assign $btn { type button } { className lane-import-lane-btn }
     ; to title-span !document.createElement span
     ; assign $title-span { className lane-import-lane-title } { textContent $cand.title }
     !btn.appendChild $title-span
     [ match
      { $cand.is-open (
       ; to badge !document.createElement span
       ; assign $badge { className lane-import-lane-badge } { textContent Open }
       !btn.appendChild $badge
      ) }
     ]
     !btn.addEventListener click : !modal.select-lane $cand.id $cand.title {}
     !lanes-el.appendChild $btn
     !modal.lane-els.push $btn
     ; to item [ object { id $cand.id } { title $cand.title } { is-open $cand.is-open } { el $btn } ]
     !modal.lane-items.push $item
    )
   ) }
  ]
  $candidates
 )

 ; to modal.close (
  -- Closes the Import from Lane picker modal
  ; condition { propertyIs true modal.is-open } (
   ; to prev-lane $modal.lane
   ; set false modal.is-open
   ; set false modal.lane-loaded
   ; set [ ; add $modal.open-seq 1 ] modal.open-seq
   ; set [ ; add $modal.load-seq 1 ] modal.load-seq
   ; set null modal.lane
   ; set null modal.on-confirm
   !backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $modal }
   ]
  )
 )

 ; to modal.confirm (
  -- Confirms the selected lane, optional property path (or whole lane), and variable name
  ; to has-lane [ match
   { [ propertyIs '' modal.selected-lane-id ] : false }
   { true : true }
  ]
  ; condition { propertyIs true has-lane } (
   ; condition { propertyIs true modal.lane-loaded } (
    ; to trimmed !alias-input.value.trim
    ; to fallback [ match
     { [ propertyIsGreaterThan 0 modal.selected-path.length ] (
      ; to last-idx ; subtract $modal.selected-path.length 1
      [ get modal.selected-path $last-idx ]
     ) }
     { true : !modal.default-lane-alias $modal.selected-lane-title }
    ]
    ; to final-alias [ match
     { [ propertyIs '' trimmed ] : $fallback }
     { true : $trimmed }
    ]
    ; to cb $modal.on-confirm
    ; to spec [ object
     { alias $final-alias }
     { laneId $modal.selected-lane-id }
     { path !modal.selected-path.slice 0 }
    ]
    !modal.close
    [ match
     { $cb : !$cb $spec }
    ]
   )
  )
 )

 ; to modal.open (
  -- Opens the Import from Lane picker for a given lane and current import spec
  ; to { opts } $argv
  ; to cur-id [ match
   { $opts.current-lane-id : $opts.current-lane-id }
   { true : '' }
  ]
  ; to init-lane-id [ match
   { $opts.lane-id : $opts.lane-id }
   { true : '' }
  ]
  ; to init-path [ match
   { [ !window.Array.isArray $opts.path ] : !opts.path.slice 0 }
   { true : {} }
  ]
  ; to init-alias [ match
   { $opts.alias : $opts.alias }
   { true : '' }
  ]
  ; set $cur-id modal.current-lane-id
  ; set $init-lane-id modal.selected-lane-id
  ; set '' modal.selected-lane-title
  ; set $init-path modal.selected-path
  ; set $init-alias modal.alias
  ; set $init-alias alias-input.value

  -- Mark custom-alias true only if user already picked a different name than the default leaf/lane alias
  ; to is-custom [ match
   { [ propertyIs '' init-alias ] : false }
   { [ propertyIsGreaterThan 0 init-path.length ] (
    ; to last-idx ; subtract $init-path.length 1
    ; to leaf [ get init-path $last-idx ]
    [ ternary [ propertyIs $leaf init-alias ] false true ]
   ) }
   { [ propertyIs '' init-lane-id ] : true }
   { true (
    ; to init-title !lane-control.get-lane-title $init-lane-id
    ; to expected !modal.default-lane-alias $init-title
    [ ternary [ propertyIs $expected init-alias ] false true ]
   ) }
  ]
  ; set false modal.lane-loaded
  ; set $is-custom modal.custom-alias
  ; set $opts.on-confirm modal.on-confirm
  ; to oseq ; add $modal.open-seq 1
  ; set $oseq modal.open-seq
  ; set [ ; add $modal.load-seq 1 ] modal.load-seq
  ; set true scope-wrap.hidden
  !modal.set-status 'Loading lanes…' false
  !modal.update-summary

  ; condition { propertyIs true modal.is-open } (
   [ match
    { [ and { $modal.lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $modal.lane $modal }
   ]
  )
  ; to target-lane [ match
   { $opts.lane : $opts.lane }
   { [ and { $cur-id } { $lane-control.resolve-lane } ] : !lane-control.resolve-lane $cur-id }
   { $cur-id : [ get lane-control.by-id $cur-id ] }
   { true : null }
  ]
  ; set $target-lane modal.lane
  ; set true modal.is-open
  [ match
   { [ and { $target-lane } { $lane-control.mount-lane-modal } ] : !lane-control.mount-lane-modal $target-lane $modal }
   { $target-lane.body.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-import-backdrop lane-modal-backdrop--lane' backdrop.className
    !target-lane.body.appendChild $backdrop
   ) }
   { $document.body.appendChild : !document.body.appendChild $backdrop }
  ]

  ; to candidates !modal.render-lanes

  -- Auto-select existing source lane, or the first available lane if none selected yet
  ; condition { and { [ propertyIs true modal.is-open ] } { [ propertyIs $oseq modal.open-seq ] } } (
   [ match
    { [ propertyIsGreaterThan 0 candidates.length ] (
     ; to target-id [ match
      { [ propertyIs '' init-lane-id ] : $candidates.0.id }
      { true : $init-lane-id }
     ]
     ; to target-title !lane-control.get-lane-title $target-id
     !modal.select-lane $target-id $target-title $init-path
    ) }
    { true (
     ; set '' modal.selected-lane-id
     ; set {} modal.selected-path
     !modal.update-summary
    ) }
   ]
  )

  $modal
 )

 !alias-input.addEventListener input (
  ; set $alias-input.value modal.alias
  ; to trimmed !alias-input.value.trim
  ; set [ ternary [ propertyIs '' trimmed ] false true ] modal.custom-alias
 )
 !close-btn.addEventListener click $modal.close
 !cancel-btn.addEventListener click $modal.close
 !form.addEventListener submit (
  ; to { ev } $argv
  [ match
   { $ev.preventDefault : !ev.preventDefault }
  ]
  !modal.confirm
 )
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
 )
 !window.addEventListener keydown (
  ; to { ev } $argv
  ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.close
 )

 $modal
)

; to scope.create-table-import (
 -- Creates a modal picker for importing a live read-only or read-write table from another lane
 ; to { lane-control } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-import-backdrop lane-table-import-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'
 ; to panel !document.createElement div
 ; set 'lane-modal lane-import-modal lane-table-import-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-modal-title-wrap title-wrap.className
 ; to heading !document.createElement div
 ; assign $heading { className lane-modal-title } { textContent 'Import Table' }
 ; to subtitle !document.createElement div
 ; assign $subtitle { className lane-modal-count } { textContent 'Mount a remote table from another lane as read-only or read-write' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading
 !title-wrap.appendChild $subtitle
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to lanes-section !document.createElement div
 ; set lane-import-section lanes-section.className
 ; to lanes-label !document.createElement div
 ; assign $lanes-label { className lane-config-label } { textContent 'Owner Lane' }
 ; to lanes-el !document.createElement div
 ; set lane-import-lanes lanes-el.className
 !lanes-section.appendChild $lanes-label
 !lanes-section.appendChild $lanes-el

 ; to status-el !document.createElement div
 ; set lane-import-status status-el.className
 ; set true status-el.hidden

 ; to tables-section !document.createElement div
 ; set 'lane-import-section lane-table-import-tables-section' tables-section.className
 ; to tables-label !document.createElement div
 ; assign $tables-label { className lane-config-label } { textContent 'Remote Table' }
 ; to tables-el !document.createElement div
 ; set lane-table-import-list tables-el.className
 !tables-section.appendChild $tables-label
 !tables-section.appendChild $tables-el

 ; to mode-section !document.createElement div
 ; set 'lane-import-section lane-table-import-mode-section' mode-section.className
 ; to mode-label !document.createElement div
 ; assign $mode-label { className lane-config-label } { textContent 'Access Mode' }
 ; to mode-row !document.createElement div
 ; set lane-table-import-mode-row mode-row.className

 ; to ro-btn !document.createElement button
 ; assign $ro-btn { type button } { className 'lane-table-import-mode-btn lane-table-import-mode-btn--active' }
 !ro-btn.setAttribute aria-pressed 'true'
 ; to ro-title !document.createElement span
 ; assign $ro-title { className lane-table-import-mode-title } { textContent 'Read-only' }
 ; to ro-desc !document.createElement span
 ; assign $ro-desc { className lane-table-import-mode-desc } { textContent 'Live rows & schema from owner lane; editing disabled here' }
 !ro-btn.appendChild $ro-title
 !ro-btn.appendChild $ro-desc

 ; to rw-btn !document.createElement button
 ; assign $rw-btn { type button } { className lane-table-import-mode-btn }
 !rw-btn.setAttribute aria-pressed 'false'
 ; to rw-title !document.createElement span
 ; assign $rw-title { className lane-table-import-mode-title } { textContent 'Read-write' }
 ; to rw-desc !document.createElement span
 ; assign $rw-desc { className lane-table-import-mode-desc } { textContent 'Live rows & schema; edits write directly to owner lane' }
 !rw-btn.appendChild $rw-title
 !rw-btn.appendChild $rw-desc

 !mode-row.appendChild $ro-btn
 !mode-row.appendChild $rw-btn
 !mode-section.appendChild $mode-label
 !mode-section.appendChild $mode-row

 ; to form !document.createElement form
 ; set lane-import-form form.className
 ; to alias-row !document.createElement div
 ; set lane-import-alias-row alias-row.className
 ; to alias-field !document.createElement div
 ; set lane-import-alias-field alias-field.className
 ; to alias-label !document.createElement label
 ; assign $alias-label { className lane-config-label } { textContent 'Table name in this lane' }
 ; to alias-input !document.createElement input
 ; assign $alias-input { type text } { className lane-config-input } { placeholder 'Same name or custom table name...' } { spellcheck false } { autocomplete off }
 !alias-field.appendChild $alias-label
 !alias-field.appendChild $alias-input

 ; to summary-field !document.createElement div
 ; set lane-import-summary-field summary-field.className
 ; to summary-label !document.createElement div
 ; assign $summary-label { className lane-config-label } { textContent 'Remote Origin' }
 ; to summary-el !document.createElement div
 ; assign $summary-el { className lane-import-summary } { textContent 'Select an owner lane and table above' }
 !summary-field.appendChild $summary-label
 !summary-field.appendChild $summary-el

 !alias-row.appendChild $alias-field
 !alias-row.appendChild $summary-field

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to confirm-btn !document.createElement button
 ; assign $confirm-btn { type submit } { className 'lane-modal-action lane-config-btn--save' } { textContent Import }
 ; set true confirm-btn.disabled
 !footer.appendChild $cancel-btn
 !footer.appendChild $confirm-btn

 !form.appendChild $alias-row
 !form.appendChild $footer

 !panel.appendChild $header
 !panel.appendChild $lanes-section
 !panel.appendChild $status-el
 !panel.appendChild $tables-section
 !panel.appendChild $mode-section
 !panel.appendChild $form
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { heading-el $heading }
  { form $form }
  { lanes-el $lanes-el }
  { status-el $status-el }
  { tables-el $tables-el }
  { ro-btn $ro-btn }
  { rw-btn $rw-btn }
  { alias-input $alias-input }
  { summary-el $summary-el }
  { close-btn $close-btn }
  { cancel-btn $cancel-btn }
  { confirm-btn $confirm-btn }
  { is-open false }
  { lane null }
  { tables-loaded false }
  { current-lane-id '' }
  { editing-table-id '' }
  { selected-lane-id '' }
  { selected-lane-title '' }
  { selected-table-id '' }
  { selected-table-name '' }
  { selected-table null }
  { mode read-only }
  { alias '' }
  { user-edited-alias false }
  { existing-tables {} }
  { on-confirm null }
  { load-seq 0 }
  { open-seq 0 }
  { lane-items {} }
  { lane-els {} }
  { table-items {} }
  { table-els {} }
 ]

 ; to modal.set-status (
  -- Displays or hides the status / error banner above the table list
  ; to { message is-error } $argv
  [ match
   { [ propertyIs '' message ] (
    ; set '' status-el.textContent
    ; set true status-el.hidden
   ) }
   { true (
    ; set $message status-el.textContent
    ; to cls [ match
     { $is-error : 'lane-import-status lane-import-status--error' }
     { true : 'lane-import-status cc-loading' }
    ]
    ; set $cls status-el.className
    ; set false status-el.hidden
   ) }
  ]
 )

 ; to modal.is-name-taken (
  -- Returns true if another table in the current lane already uses the candidate name
  ; to { candidate } $argv
  ; to raw [ match { $candidate : ; add '' $candidate } { true : '' } ]
  ; to clean !raw.trim
  [ match
   { [ propertyIs '' clean ] : false }
   { true (
    ; to low !clean.toLowerCase
    ; to hit ; object { found false }
    ; each $modal.existing-tables (
     ; to { et } $argv
     ; to same-edit [ match
      { [ propertyIs '' modal.editing-table-id ] : false }
      { [ propertyIs $modal.editing-table-id et.id ] : true }
      { true : false }
     ]
     ; condition { propertyIs false same-edit } (
      ; to et-raw [ match { $et.name : ; add '' $et.name } { true : '' } ]
      ; to et-trim !et-raw.trim
      ; to et-low !et-trim.toLowerCase
      ; condition { propertyIs $low et-low } : ; set true hit.found
     )
    )
    $hit.found
   ) }
  ]
 )

 ; to modal.disambiguate-name (
  -- Suggests an unused local table name when the remote table name already exists in this lane
  ; to { base-name } $argv
  ; to raw [ match { $base-name : ; add '' $base-name } { true : '' } ]
  ; to clean !raw.trim
  ; to stem [ match { [ propertyIs '' clean ] : remote_table } { true : $clean } ]
  ; to taken !modal.is-name-taken $stem
  [ match
   { [ propertyIs false taken ] : $stem }
   { true (
    ; to n 2
    ; to chosen ''
    ; while { propertyIs '' chosen } (
     ; to try-name ; add $stem ; add '_' $n
     ; to is-used !modal.is-name-taken $try-name
     [ match
      { [ propertyIs false is-used ] : ; set $try-name chosen }
      { true : ; set [ add $n 1 ] n }
     ]
    )
    $chosen
   ) }
  ]
 )

 ; to modal.is-already-imported (
  -- Returns true if the current lane already has an import pointing to the same owner lane & table
  ; to { owner-lane-id owner-table-id } $argv
  ; to hit ; object { found false }
  ; each $modal.existing-tables (
   ; to { et } $argv
   ; to same-edit [ match
    { [ propertyIs '' modal.editing-table-id ] : false }
    { [ propertyIs $modal.editing-table-id et.id ] : true }
    { true : false }
   ]
   ; condition { propertyIs false same-edit } (
    [ match
     { [ and { [ propertyIs $owner-lane-id et.remote.laneId ] } { [ propertyIs $owner-table-id et.remote.tableId ] } ] : ; set true hit.found }
    ]
   )
  )
  $hit.found
 )

 ; to modal.update-summary (
  -- Updates the Remote Origin summary text, heading, and Import button enabled state
  ; to is-edit [ match { [ propertyIs '' modal.editing-table-id ] : false } { true : true } ]
  ; set [ ternary $is-edit 'Import Settings' 'Import Table' ] heading.textContent
  ; set [ ternary $is-edit 'Save changes' Import ] confirm-btn.textContent
  ; to has-lane [ match
   { [ propertyIs '' modal.selected-lane-id ] : false }
   { true : true }
  ]
  ; to has-tbl [ match
   { $modal.selected-table : true }
   { true : false }
  ]
  ; to ready [ ternary [ and { $has-lane } { $modal.tables-loaded } { $has-tbl } ] true false ]
  ; set [ ternary $ready false true ] confirm-btn.disabled
  ; to mode-lbl [ ternary [ propertyIs read-write modal.mode ] 'Read-write' 'Read-only' ]
  [ match
   { $ready (
    ; to lane-label [ match
     { [ propertyIs '' modal.selected-lane-title ] : $modal.selected-lane-id }
     { true : $modal.selected-lane-title }
    ]
    ; to tbl-raw [ match
     { $modal.selected-table.name : ; add '' $modal.selected-table.name }
     { true : '' }
    ]
    ; to tbl-trim !tbl-raw.trim
    ; to tbl-label [ match
     { [ propertyIs '' tbl-trim ] : $modal.selected-table.id }
     { true : $tbl-trim }
    ]
    ; to txt ; add $lane-label ; add ' · data/' ; add $tbl-label ; add ' · ' $mode-lbl
    ; set $txt summary-el.textContent
   ) }
   { [ and { $has-lane } { [ propertyIs false modal.tables-loaded ] } ] : ; set 'Loading tables...' summary-el.textContent }
   { $has-lane : ; set 'Select a table above' summary-el.textContent }
   { true : ; set 'Select an owner lane and table above' summary-el.textContent }
  ]
 )

 ; to modal.update-mode-buttons (
  -- Highlights the selected read-only or read-write access mode button
  ; to is-rw [ propertyIs read-write modal.mode ]
  ; set [ ternary $is-rw lane-table-import-mode-btn 'lane-table-import-mode-btn lane-table-import-mode-btn--active' ] ro-btn.className
  ; set [ ternary $is-rw 'lane-table-import-mode-btn lane-table-import-mode-btn--active' lane-table-import-mode-btn ] rw-btn.className
  !ro-btn.setAttribute aria-pressed [ ternary $is-rw 'false' 'true' ]
  !rw-btn.setAttribute aria-pressed [ ternary $is-rw 'true' 'false' ]
  !modal.update-summary
 )

 ; to modal.set-mode (
  -- Sets access mode to read-only or read-write
  ; to { next-mode } $argv
  ; to norm [ match
   { $normalizeTableImportMode : !normalizeTableImportMode $next-mode }
   { [ propertyIs read-write next-mode ] : read-write }
   { true : read-only }
  ]
  ; set $norm modal.mode
  !modal.update-mode-buttons
 )

 ; to modal.update-lane-buttons (
  -- Highlights the active owner lane button
  ; each $modal.lane-items (
   ; to { item } $argv
   ; to active [ propertyIs $item.id modal.selected-lane-id ]
   ; to cls [ ternary $active 'lane-import-lane-btn lane-import-lane-btn--active' lane-import-lane-btn ]
   ; set $cls item.el.className
   !item.el.setAttribute aria-pressed [ ternary $active 'true' 'false' ]
  )
 )

 ; to modal.update-table-buttons (
  -- Highlights the active remote table card
  ; each $modal.table-items (
   ; to { item } $argv
   ; to active [ propertyIs $item.id modal.selected-table-id ]
   ; to cls [ ternary $active 'lane-table-import-item lane-table-import-item--active' lane-table-import-item ]
   ; set $cls item.el.className
   !item.el.setAttribute aria-pressed [ ternary $active 'true' 'false' ]
  )
 )

 ; to modal.select-table (
  -- Selects a remote table and auto-populates the local table name unless user customized it
  ; to { tbl } $argv
  ; set $tbl modal.selected-table
  [ match
   { $tbl (
    ; set $tbl.id modal.selected-table-id
    ; to raw-name [ match { $tbl.name : ; add '' $tbl.name } { true : '' } ]
    ; set $raw-name modal.selected-table-name
    ; to should-fill [ match
     { [ propertyIs false modal.user-edited-alias ] : true }
     { [ propertyIs '' modal.alias ] : true }
     { true : false }
    ]
    ; condition { propertyIs true should-fill } (
     ; to suggested !modal.disambiguate-name $raw-name
     ; set $suggested modal.alias
     ; set $suggested alias-input.value
    )
   ) }
   { true (
    ; set '' modal.selected-table-id
    ; set '' modal.selected-table-name
   ) }
  ]
  !modal.update-table-buttons
  !modal.update-summary
 )

 ; to modal.render-tables (
  -- Renders own tables from the chosen owner lane (excluding already-remote tables)
  ; to { tables initial-table-id } $argv
  ; while { propertyIsGreaterThan 0 modal.table-els.length } (
   ; to old-el !modal.table-els.pop
   !old-el.remove
  )
  ; set 0 modal.table-items.length

  ; to own-tables {}
  ; each $tables (
   ; to { t } $argv
   ; to is-rem [ match
    { $isRemoteTable : !isRemoteTable $t }
    { $t.remote.laneId : true }
    { true : false }
   ]
   ; condition { propertyIs false is-rem } : !own-tables.push $t
  )

  [ match
   { [ propertyIs 0 own-tables.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-import-empty } { textContent 'No tables in this lane.' }
    !tables-el.appendChild $empty-el
    !modal.table-els.push $empty-el
    !modal.select-table null
   ) }
   { true (
    ; to picked ; object { table null }
    ; each $own-tables (
     ; to { t idx } $argv
     ; to btn !document.createElement button
     ; assign $btn { type button } { className lane-table-import-item }
     ; to top-row !document.createElement div
     ; set lane-table-import-item-top top-row.className
     ; to raw-tname [ match { $t.name : ; add '' $t.name } { true : '' } ]
     ; to trim-tname !raw-tname.trim
     ; to disp-tname [ match
      { [ propertyIs '' trim-tname ] : ; add 'Table ' [ ; add $idx 1 ] }
      { true : $trim-tname }
     ]
     ; to name-span !document.createElement span
     ; assign $name-span { className lane-table-import-item-name } { textContent $disp-tname }
     !top-row.appendChild $name-span

     ; to col-count [ match { $t.columns.length : $t.columns.length } { true : 0 } ]
     ; to row-count [ match { $t.rows.length : $t.rows.length } { true : 0 } ]
     ; to col-unit [ ternary [ propertyIs 1 col-count ] col cols ]
     ; to row-unit [ ternary [ propertyIs 1 row-count ] row rows ]
     ; to meta-txt ; add $col-count ; add ' ' ; add $col-unit ; add ' · ' ; add $row-count ; add ' ' $row-unit
     ; to meta-span !document.createElement span
     ; assign $meta-span { className lane-table-import-item-meta } { textContent $meta-txt }
     !top-row.appendChild $meta-span

     ; to already-imp !modal.is-already-imported $modal.selected-lane-id $t.id
     [ match
      { $already-imp (
       ; to imp-badge !document.createElement span
       ; assign $imp-badge { className lane-table-import-item-badge } { textContent Imported }
       !top-row.appendChild $imp-badge
      ) }
     ]
     !btn.appendChild $top-row

     ; to col-names {}
     ; each $t.columns (
      ; to { col cidx } $argv
      ; condition { propertyIsLessThan 6 cidx } (
       ; to raw-cname [ match { $col.name : ; add '' $col.name } { true : '' } ]
       ; to clean-cname !raw-cname.trim
       !col-names.push [ ternary [ propertyIs '' clean-cname ] '(unnamed)' $clean-cname ]
      )
     )
     ; to cols-preview [ match
      { [ propertyIs 0 col-count ] : 'No columns' }
      { [ propertyIsGreaterThan 6 col-count ] : ; add [ !col-names.join ', ' ] ', …' }
      { true : !col-names.join ', ' }
     ]
     ; to cols-span !document.createElement div
     ; assign $cols-span { className lane-table-import-item-cols } { textContent $cols-preview }
     !btn.appendChild $cols-span

     !btn.addEventListener click : !modal.select-table $t
     !tables-el.appendChild $btn
     !modal.table-els.push $btn
     !modal.table-items.push [ object { id $t.id } { table $t } { el $btn } ]

     ; condition { propertyIs $initial-table-id t.id } : ; set $t picked.table
    )
    ; to target-tbl [ match
     { $picked.table : $picked.table }
     { true : $own-tables.0 }
    ]
    !modal.select-table $target-tbl
   ) }
  ]
 )

 ; to modal.select-lane (
  -- Loads tables from the selected owner lane and populates the remote table list
  ; to { lane-id title initial-table-id } $argv
  ; to seq ; add $modal.load-seq 1
  ; set $seq modal.load-seq
  ; set false modal.tables-loaded
  ; set $lane-id modal.selected-lane-id
  ; to resolved-title [ match
   { $title : $title }
   { true : !lane-control.get-lane-title $lane-id }
  ]
  ; set $resolved-title modal.selected-lane-title
  ; set null modal.selected-table
  ; set '' modal.selected-table-id
  ; set '' modal.selected-table-name
  !modal.update-lane-buttons
  !modal.update-summary
  !modal.set-status 'Loading tables...' false
  ; set true tables-el.hidden

  ; to open-lane [ get lane-control.by-id $lane-id ]
  ; try (
   ; to loaded-tables [ match
    { $open-lane.notebook.data-view.tables : $open-lane.notebook.data-view.tables }
    { true : !loadLaneTables $data [ !data.namespace $lane-id ] $lane-id [ object { openPackageIds $lane-control.open-package-ids } ] }
   ]
   ; condition { propertyIs $seq modal.load-seq } (
    ; set true modal.tables-loaded
    !modal.set-status '' false
    ; set false tables-el.hidden
    !modal.render-tables $loaded-tables $initial-table-id
   )
  ) (
   ; to { err } $argv
   ; condition { propertyIs $seq modal.load-seq } (
    ; set false modal.tables-loaded
    ; set true tables-el.hidden
    ; to err-msg [ match { $err.message : $err.message } { true : 'Failed to load tables from lane' } ]
    !modal.set-status $err-msg true
    !modal.update-summary
   )
  )
 )

 ; to modal.render-lanes (
  -- Renders buttons for all other accessible open and known lanes
  ; while { propertyIsGreaterThan 0 modal.lane-els.length } (
   ; to old-el !modal.lane-els.pop
   !old-el.remove
  )
  ; set 0 modal.lane-items.length
  ; to lanes-load-el !document.createElement div
  ; assign $lanes-load-el { className 'cc-loading cc-loading--compact' } { textContent 'Loading lanes…' }
  !lanes-el.appendChild $lanes-load-el
  !modal.lane-els.push $lanes-load-el

  ; to seen ; object
  ; to candidates {}

  ; each $lane-control.lanes (
   ; to { lane } $argv
   ; to is-self [ propertyIs $lane.id modal.current-lane-id ]
   ; condition { propertyIs false is-self } (
    ; to seen $lane.id true
    !candidates.push [ object { id $lane.id } { title $lane.title } { is-open true } ]
   )
  )

  ; to known ; try ( !lane-control.list-known ) ( {} )
  ; each $known (
   ; to { entry } $argv
   ; to is-self [ propertyIs $entry.id modal.current-lane-id ]
   ; to already [ get seen $entry.id ]
   ; condition { propertyIs false is-self } (
    [ match
     { $already : null }
     { true (
      ; to seen $entry.id true
      !candidates.push [ object { id $entry.id } { title $entry.title } { is-open false } ]
     ) }
    ]
   )
  )

  ; while { propertyIsGreaterThan 0 modal.lane-els.length } (
   ; to old-el !modal.lane-els.pop
   !old-el.remove
  )

  [ match
   { [ propertyIs 0 candidates.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-import-empty } { textContent 'No other lanes available. Create or open another lane first.' }
    !lanes-el.appendChild $empty-el
    !modal.lane-els.push $empty-el
    ; set true tables-el.hidden
    !modal.set-status '' false
   ) }
   { true (
    ; each $candidates (
     ; to { cand } $argv
     ; to btn !document.createElement button
     ; assign $btn { type button } { className lane-import-lane-btn }
     ; to title-span !document.createElement span
     ; assign $title-span { className lane-import-lane-title } { textContent $cand.title }
     !btn.appendChild $title-span
     [ match
      { $cand.is-open (
       ; to badge !document.createElement span
       ; assign $badge { className lane-import-lane-badge } { textContent Open }
       !btn.appendChild $badge
      ) }
     ]
     !btn.addEventListener click : !modal.select-lane $cand.id $cand.title ''
     !lanes-el.appendChild $btn
     !modal.lane-els.push $btn
     !modal.lane-items.push [ object { id $cand.id } { title $cand.title } { is-open $cand.is-open } { el $btn } ]
    )
   ) }
  ]
  $candidates
 )

 ; to modal.close (
  -- Closes the Import Table modal
  ; condition { propertyIs true modal.is-open } (
   ; to prev-lane $modal.lane
   ; set false modal.is-open
   ; set false modal.tables-loaded
   ; set [ ; add $modal.open-seq 1 ] modal.open-seq
   ; set [ ; add $modal.load-seq 1 ] modal.load-seq
   ; set null modal.lane
   ; set null modal.on-confirm
   !backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $modal }
   ]
  )
 )

 ; to modal.confirm (
  -- Confirms the selected owner lane, remote table, access mode, and local table name
  ; to has-lane [ match { [ propertyIs '' modal.selected-lane-id ] : false } { true : true } ]
  ; to sel-tbl $modal.selected-table
  ; condition { and { [ propertyIs true has-lane ] } { [ propertyIs true modal.tables-loaded ] } { $sel-tbl } } (
   ; to trimmed !alias-input.value.trim
   ; to raw-sel-name [ match { $sel-tbl.name : ; add '' $sel-tbl.name } { true : '' } ]
   ; to final-name [ match
    { [ propertyIs '' trimmed ] : !modal.disambiguate-name $raw-sel-name }
    { true : $trimmed }
   ]
   ; to is-custom [ ternary [ propertyIs $final-name raw-sel-name ] false true ]
   ; to cb $modal.on-confirm
   ; to spec [ object
    { laneId $modal.selected-lane-id }
    { laneTitle $modal.selected-lane-title }
    { tableId $sel-tbl.id }
    { tableName $raw-sel-name }
    { localName $final-name }
    { customName $is-custom }
    { mode $modal.mode }
    { columns $sel-tbl.columns }
    { rows $sel-tbl.rows }
   ]
   !modal.close
   [ match
    { $cb : !$cb $spec }
   ]
  )
 )

 ; to modal.open (
  -- Opens the Import Table modal for mounting or editing a remote table in the given lane
  ; to { opts } $argv
  ; to cur-id [ match { $opts.current-lane-id : $opts.current-lane-id } { true : '' } ]
  ; to init-lane-id [ match { $opts.lane-id : $opts.lane-id } { true : '' } ]
  ; to init-table-id [ match { $opts.table-id : $opts.table-id } { true : '' } ]
  ; to edit-id [ match { $opts.editing-table-id : $opts.editing-table-id } { true : '' } ]
  ; to init-name [ match { $opts.local-name : $opts.local-name } { true : '' } ]
  ; to existing [ match
   { [ !window.Array.isArray $opts.existing-tables ] : $opts.existing-tables }
   { true : {} }
  ]
  ; set $cur-id modal.current-lane-id
  ; set $edit-id modal.editing-table-id
  ; set $existing modal.existing-tables
  ; set $init-lane-id modal.selected-lane-id
  ; set '' modal.selected-lane-title
  ; set $init-table-id modal.selected-table-id
  ; set '' modal.selected-table-name
  ; set null modal.selected-table
  ; set false modal.tables-loaded
  ; set $init-name modal.alias
  ; set $init-name alias-input.value
  ; to start-edited [ match
   { [ and { $edit-id } { $opts.custom-name } ] : true }
   { $init-name : true }
   { true : false }
  ]
  ; set $start-edited modal.user-edited-alias
  ; set $opts.on-confirm modal.on-confirm
  ; to oseq ; add $modal.open-seq 1
  ; set $oseq modal.open-seq
  ; set [ add $modal.load-seq 1 ] modal.load-seq
  ; set true tables-el.hidden
  !modal.set-status 'Loading lanes…' false
  !modal.set-mode [ match { $opts.mode : $opts.mode } { true : read-only } ]

  ; condition { propertyIs true modal.is-open } (
   [ match
    { [ and { $modal.lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $modal.lane $modal }
   ]
  )
  ; to target-lane [ match
   { $opts.lane : $opts.lane }
   { [ and { $cur-id } { $lane-control.resolve-lane } ] : !lane-control.resolve-lane $cur-id }
   { $cur-id : [ get lane-control.by-id $cur-id ] }
   { true : null }
  ]
  ; set $target-lane modal.lane
  ; set true modal.is-open
  [ match
   { [ and { $target-lane } { $lane-control.mount-lane-modal } ] : !lane-control.mount-lane-modal $target-lane $modal }
   { $target-lane.body.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-import-backdrop lane-table-import-backdrop lane-modal-backdrop--lane' backdrop.className
    !target-lane.body.appendChild $backdrop
   ) }
   { $document.body.appendChild : !document.body.appendChild $backdrop }
  ]

  ; to candidates !modal.render-lanes

  ; condition { and { [ propertyIs true modal.is-open ] } { [ propertyIs $oseq modal.open-seq ] } } (
   [ match
    { [ propertyIsGreaterThan 0 candidates.length ] (
     ; to target-id [ match
      { [ propertyIs '' init-lane-id ] : $candidates.0.id }
      { true : $init-lane-id }
     ]
     ; to target-title !lane-control.get-lane-title $target-id
     !modal.select-lane $target-id $target-title $init-table-id
    ) }
    { true (
     ; set '' modal.selected-lane-id
     ; set '' modal.selected-table-id
     ; set null modal.selected-table
     !modal.update-summary
    ) }
   ]
  )

  $modal
 )

 !ro-btn.addEventListener click : !modal.set-mode read-only
 !rw-btn.addEventListener click : !modal.set-mode read-write
 !alias-input.addEventListener input (
  ; set $alias-input.value modal.alias
  ; to trimmed !alias-input.value.trim
  ; set [ ternary [ propertyIs '' trimmed ] false true ] modal.user-edited-alias
 )
 !close-btn.addEventListener click $modal.close
 !cancel-btn.addEventListener click $modal.close
 !form.addEventListener submit (
  ; to { ev } $argv
  [ match
   { $ev.preventDefault : !ev.preventDefault }
  ]
  !modal.confirm
 )
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
 )
 !window.addEventListener keydown (
  ; to { ev } $argv
  ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.close
 )

 $modal
)
$scope
