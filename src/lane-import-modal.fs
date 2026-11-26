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
     { true : 'lane-import-status' }
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
  !modal.set-status 'Waiting for lane to finish running...' false
  ; set true scope-wrap.hidden

  ; to result !lane-control.get-lane-final-state $lane-id $modal.current-lane-id
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
  ; to known !lane-control.list-known
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
$scope
