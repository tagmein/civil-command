-- file lane-control.fs
; to lane-notebook ; load /src/lane-notebook.fs
; to lane-inputs ; load /src/lane-inputs.fs
; to lane-config-modal ; load /src/lane-config-modal.fs
; to lane-import-modal ; load /src/lane-import-modal.fs
; to confirm-modal-mod ; load /src/confirm-modal.fs
; to row-picker-modal-mod ; load /src/lane-row-picker-modal.fs
; to lane-rails ; load /src/lane-rails.fs
; to scope ; object { lanes {} } { lane-ids {} } { by-id ; object } { catalog ; object } { active-imports ; object }
; to config-modal !lane-config-modal.create $scope
; set $config-modal scope.config-modal
; to import-modal !lane-import-modal.create $scope
; set $import-modal scope.import-modal
; to confirm-modal !confirm-modal-mod.create
; set $confirm-modal scope.confirm-modal
; to row-picker-modal !row-picker-modal-mod.create
; set $row-picker-modal scope.row-picker-modal
; to rails !lane-rails.create $scope
; set $rails scope.rails
; to scope.load-catalog (
 -- Loads known lanes index from persistent KV and merges into scope.catalog
 ; to stored !data.get lanes
 [ match
  { $stored (
   ; to parsed !window.JSON.parse $stored
   ; assign scope.catalog $parsed
  ) }
 ]
 $scope.catalog
)
; to scope.register (
 -- Records a lane in the persistent known-lanes database
 ; to { id title } $argv
 !scope.load-catalog
 ; to entry ; object { id $id } { title $title }
 ; to scope.catalog $id $entry
 !data.set lanes !window.JSON.stringify $scope.catalog
 $entry
)
; to scope.list-known (
 -- Returns all known lanes from the persistent database
 !scope.load-catalog
 !window.Object.values $scope.catalog
)
; to scope.sync-minimized-labels (
 -- Syncs minimized placeholder and rail icon titles after a lane rename or reload
 ; to { lane } $argv
 [ match
  { $lane (
   ; to restore-label ; add 'Restore ' $lane.title
   [ match
    { $lane.minimized-title-el : ; set $lane.title lane.minimized-title-el.textContent }
   ]
   [ match
    { $lane.minimized-placeholder (
     ; set $restore-label lane.minimized-placeholder.title
     !lane.minimized-placeholder.setAttribute aria-label $restore-label
    ) }
   ]
   [ match
    { $lane.minimized-header-btn (
     ; set $restore-label lane.minimized-header-btn.title
     !lane.minimized-header-btn.setAttribute aria-label $restore-label
    ) }
   ]
   !rails.update $lane
  ) }
 ]
)
; to scope.rename (
 -- Updates a lane's title in live state, DOM header, minimized labels, lane KV, and persistent catalog
 ; to { id title } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   ; set $title lane.title
   ; set $title lane.title-el.textContent
   !scope.sync-minimized-labels $lane
   !lane.data.set title $title
   !scope.register $id $title
   !scope.refresh-import-labels $id
  ) }
 ]
 $lane
)
; to clear-lane-box-width (
 -- Clears inline width and --lane-width overrides on a lane header or body cell
 ; to { el } $argv
 [ match
  { $el.style (
   ; set '' el.style.width
   ; set '' el.style.maxWidth
   ; set '' el.style.minWidth
   [ match
    { $el.style.removeProperty : !el.style.removeProperty '--lane-width' }
    { true : ; set '' el.style.--lane-width }
   ]
  ) }
 ]
)
; to scope.apply-lane-width (
 -- Applies a lane's stored Width setting to header and body elements (clamping rendered width to >= 100px with no max)
 ; to { lane raw-width } $argv
 [ match
  { $lane (
   ; to normalized !normalizeLaneWidth $raw-width
   ; to rendered !resolveLaneRenderedWidth $normalized
   ; set $normalized lane.width
   ; set $rendered lane.rendered-width
   ; condition { propertyIs false lane.is-minimized } (
    ; to has-width [ match
     { [ propertyIs null rendered ] : false }
     { true : true }
    ]
    ; to px-str [ match
     { $has-width : ; add $rendered px }
     { true : '' }
    ]
    [ match
     { $lane.element (
      ; set [ ternary $has-width 'lane-header lane-header--sized' lane-header ] lane.element.className
      [ match
       { $lane.element.style (
        ; set $px-str lane.element.style.width
        ; set $px-str lane.element.style.maxWidth
        ; set [ ternary $has-width 100px '' ] lane.element.style.minWidth
        [ match
         { $lane.element.style.setProperty (
          [ match
           { $has-width : !lane.element.style.setProperty '--lane-width' $px-str }
           { true (
            [ match
             { $lane.element.style.removeProperty : !lane.element.style.removeProperty '--lane-width' }
            ]
           ) }
          ]
         ) }
         { true : ; set $px-str lane.element.style.--lane-width }
        ]
       ) }
      ]
     ) }
    ]
    [ match
     { $lane.body (
      ; set [ ternary $has-width 'lane-body lane-body--sized' lane-body ] lane.body.className
      [ match
       { $lane.body.style (
        ; set $px-str lane.body.style.width
        ; set $px-str lane.body.style.maxWidth
        ; set [ ternary $has-width 100px '' ] lane.body.style.minWidth
        [ match
         { $lane.body.style.setProperty (
          [ match
           { $has-width : !lane.body.style.setProperty '--lane-width' $px-str }
           { true (
            [ match
             { $lane.body.style.removeProperty : !lane.body.style.removeProperty '--lane-width' }
            ]
           ) }
          ]
         ) }
         { true : ; set $px-str lane.body.style.--lane-width }
        ]
       ) }
      ]
     ) }
    ]
   )
  ) }
 ]
 $lane
)
; to scope.minimize (
 -- Minimizes an open lane to the left or right side rail and displays a clickable 90-degree vertical title placeholder in its position
 ; to { id raw-side skip-save } $argv
 ; to lane [ get scope.by-id $id ]
 ; to side !normalizeLaneMinimizeSide $raw-side
 [ match
  { $lane (
   [ match
    { $side (
     [ match
      { $rails.preview-lane (
       ; condition { propertyIs $id rails.preview-lane.id } : !rails.hide-preview
      ) }
     ]
     ; set true lane.is-minimized
     ; set $side lane.minimized-side
     ; to restore-label ; add 'Restore ' $lane.title
     ; to header-chevron [ ternary [ propertyIs left side ] '›' '‹' ]
     [ match
      { $lane.element (
       ; set 'lane-header lane-header--minimized' lane.element.className
       !clear-lane-box-width $lane.element
       [ match
        { $lane.element.style : ; assign lane.element.style { textAlign '' } { verticalAlign '' } { padding '' } }
       ]
       [ match
        { $lane.minimized-header-btn (
         ; assign $lane.minimized-header-btn { textContent $header-chevron } { title $restore-label }
         !lane.minimized-header-btn.setAttribute aria-label $restore-label
        ) }
        { true (
         ; to hdr-btn !document.createElement button
         ; assign $hdr-btn { type button } { className lane-minimized-header-btn } { textContent $header-chevron } { title $restore-label }
         !hdr-btn.setAttribute aria-label $restore-label
         !hdr-btn.addEventListener click : !scope.restore $id
         !lane.element.appendChild $hdr-btn
         ; set $hdr-btn lane.minimized-header-btn
        ) }
       ]
      ) }
     ]
     [ match
      { $lane.body (
       ; set 'lane-body lane-body--minimized' lane.body.className
       !clear-lane-box-width $lane.body
      ) }
     ]
     ; to placeholder-host [ match
      { $lane.body : $lane.body }
      { true : $lane.element }
     ]
     [ match
      { $lane.minimized-placeholder (
       !scope.sync-minimized-labels $lane
      ) }
      { true (
       ; to ph-btn !document.createElement button
       ; assign $ph-btn { type button } { className lane-minimized-placeholder } { title $restore-label }
       !ph-btn.setAttribute aria-label $restore-label
       !ph-btn.setAttribute data-lane-id $id
       !ph-btn.setAttribute data-minimized-side $side
       ; to ph-title !document.createElement span
       ; assign $ph-title { className lane-minimized-title } { textContent $lane.title }
       !ph-btn.appendChild $ph-title
       !ph-btn.addEventListener click : !scope.restore $id
       [ match
        { $placeholder-host : !placeholder-host.appendChild $ph-btn }
       ]
       ; set $ph-btn lane.minimized-placeholder
       ; set $ph-title lane.minimized-title-el
      ) }
     ]
     [ match
      { $lane.minimized-placeholder : !lane.minimized-placeholder.setAttribute data-minimized-side $side }
     ]
     !rails.add $lane $side
     [ match
      { $skip-save : null }
      { true : !lane.data.set minimized $side }
     ]
    ) }
   ]
  ) }
 ]
 $lane
)
; to scope.restore (
 -- Restores a minimized lane back to its original position with its previous width and state
 ; to { id skip-save } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   ; condition { propertyIs true lane.is-minimized } (
    !rails.remove $id
    ; set false lane.is-minimized
    ; set null lane.minimized-side
    [ match
     { $lane.minimized-header-btn (
      !lane.minimized-header-btn.remove
      ; set null lane.minimized-header-btn
     ) }
    ]
    [ match
     { $lane.minimized-placeholder (
      !lane.minimized-placeholder.remove
      ; set null lane.minimized-placeholder
      ; set null lane.minimized-title-el
     ) }
    ]
    [ match
     { $lane.element.style : ; assign lane.element.style { textAlign left } { verticalAlign top } { padding '0.25em 0.75em' } }
    ]
    !scope.apply-lane-width $lane $lane.width
    [ match
     { $lane.notebook.auto-size-rows : !lane.notebook.auto-size-rows }
    ]
    [ match
     { $skip-save : null }
     { true : !lane.data.set minimized '' }
    ]
   )
  ) }
 ]
 $lane
)
; to scope.set-width (
 -- Updates a lane's Width setting in live state, DOM, and lane KV storage
 ; to { id raw-width } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   !scope.apply-lane-width $lane $raw-width
   ; to stored [ match
    { [ propertyIs null lane.width ] : '' }
    { true : ; add '' $lane.width }
   ]
   !lane.data.set width $stored
  ) }
 ]
 $lane
)
; to scope.set-resizer-class (
 -- Sets CSS class on both header and body right-edge resize handles of a lane
 ; to { lane cls } $argv
 [ match
  { $lane.header-resizer : ; set $cls lane.header-resizer.className }
 ]
 [ match
  { $lane.body-resizer : ; set $cls lane.body-resizer.className }
 ]
)
; to scope.attach-lane-resizer (
 -- Wires ew-resize drag and double-click reset behavior onto a lane right-boundary resizer handle
 ; to { lane handle-el } $argv
 ; assign $handle-el { className lane-resizer } { title 'Drag to resize lane (double-click to reset)' }
 !handle-el.setAttribute role separator
 !handle-el.setAttribute aria-orientation vertical
 !handle-el.addEventListener mouseenter (
  ; condition { propertyIs false lane.is-resizing } : !scope.set-resizer-class $lane 'lane-resizer lane-resizer--hover'
 )
 !handle-el.addEventListener mouseleave (
  ; condition { propertyIs false lane.is-resizing } : !scope.set-resizer-class $lane lane-resizer
 )
 !handle-el.addEventListener mousedown (
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
  ; to rect-w [ match
   { $lane.element.getBoundingClientRect (
    ; to rect !lane.element.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] : !window.Math.round $rect.width }
     { true : null }
    ]
   ) }
   { true : null }
  ]
  ; to start-w [ match
   { $rect-w : $rect-w }
   { [ propertyIsGreaterThan 0 lane.element.offsetWidth ] : $lane.element.offsetWidth }
   { [ propertyIsGreaterThan 0 lane.rendered-width ] : $lane.rendered-width }
   { true : 320 }
  ]
  ; to prev-cursor [ match
   { $document.body.style.cursor : $document.body.style.cursor }
   { true : '' }
  ]
  ; set true lane.is-resizing
  !scope.set-resizer-class $lane 'lane-resizer lane-resizer--active'
  [ match
   { $document.body.style : ; set ew-resize document.body.style.cursor }
  ]
  ; to drag ; object { start-x $start-x } { start-w $start-w } { moved false } { next-w $start-w }
  ; to on-move (
   ; to { mev } $argv
   ; to cur-x [ match
    { [ propertyIs undefined mev.clientX ] : $drag.start-x }
    { [ propertyIs null mev.clientX ] : $drag.start-x }
    { true : $mev.clientX }
   ]
   ; to delta ; subtract $cur-x $drag.start-x
   ; to raw-next !window.Math.round ; add $drag.start-w $delta
   ; to clamped !window.Math.max 100 $raw-next
   ; set true drag.moved
   ; set $clamped drag.next-w
   !scope.apply-lane-width $lane $clamped
  )
  ; to on-up (
   ; set false lane.is-resizing
   !scope.set-resizer-class $lane lane-resizer
   [ match
    { $document.body.style : ; set $prev-cursor document.body.style.cursor }
   ]
   [ match
    { $window.removeEventListener (
     !window.removeEventListener mousemove $on-move
     !window.removeEventListener mouseup $on-up
    ) }
   ]
   [ match
    { $drag.moved : !lane.data.set width [ ; add '' $drag.next-w ] }
   ]
  )
  !window.addEventListener mousemove $on-move
  !window.addEventListener mouseup $on-up
 )
 !handle-el.addEventListener dblclick : !scope.set-width $lane.id null
 $handle-el
)
; to scope.get-lane-title (
 -- Returns the display title for a lane ID from open lanes or catalog, falling back to the ID
 ; to { id } $argv
 ; to open-lane [ get scope.by-id $id ]
 ; to cat-entry [ get scope.catalog $id ]
 [ match
  { $open-lane.title : $open-lane.title }
  { $cat-entry.title : $cat-entry.title }
  { true : $id }
 ]
)
; to scope.pick-import (
 -- Opens the Import from Lane picker modal
 ; to { opts } $argv
 !import-modal.open $opts
)
; to scope.refresh-import-labels (
 -- Updates import picker button labels across all open lanes after a lane rename
 ; to { id } $argv
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.refresh-import-labels : !lane.notebook.refresh-import-labels $id }
  ]
 )
)
; to scope.evaluate-stored-lane (
 -- Evaluates an unmounted lane's persisted script and inputs to completion and returns its final state
 ; to { target-id } $argv
 ; to target-data !data.namespace $target-id
 ; to stored-script !target-data.get script
 ; to stored-inputs !target-data.get inputs
 ; to stored-tables !target-data.get tables
 ; to lines !lane-notebook.parse-stored $stored-script
 ; to inputs !lane-inputs.parse-stored $stored-inputs
 ; to tables !parseStoredTables $stored-tables
 ; to env [ object
  { console $console }
  { data $target-data }
  { Math $window.Math }
  { JSON $window.JSON }
  { Date $window.Date }
  { importLane (
   ; to { nested-id ...nested-path } $argv
   [ match
    { [ propertyIs '' nested-id ] : undefined }
    { [ propertyIs undefined nested-id ] : undefined }
    { true (
     ; to res !scope.get-lane-final-state $nested-id $target-id
     !resolveImportValue $res $nested-path
    ) }
   ]
  ) }
 ]
 ; each $inputs (
  ; to { entry } $argv
  ; to trimmed !entry.name.trim
  [ match
   { [ propertyIs '' trimmed ] : null }
   { true (
    ; to val !defaultValueForType $entry.type
    ; to env $trimmed $val
   ) }
  ]
 )
 ; to scoped-tables !buildTablesScope $tables
 ; assign $env $scoped-tables
 ; to run-opts [ object { filename $target-id } { initialState $env } ]
 ; to outcome !runLines $lines $run-opts
 ; object { ok true } { state $outcome.state } { error null }
)
; to scope.get-lane-final-state (
 -- Awaits completion of another lane once idle and returns its final scope state, guarding against cycles
 ; to { target-id requester-id } $argv
 [ match
  { [ propertyIs '' target-id ] : ; object { ok false } { state null } { error 'No target lane selected' } }
  { [ propertyIs undefined target-id ] : ; object { ok false } { state null } { error 'No target lane selected' } }
  { [ propertyIs $target-id requester-id ] : ; object { ok false } { state null } { error 'Cannot import from the same lane' } }
  { [ !hasImportCycle $scope.active-imports $requester-id $target-id ] : ; object { ok false } { state null } { error 'Circular lane import detected' } }
  { true (
   ; to tracked-list null
   [ match
    { $requester-id (
     ; to existing [ get scope.active-imports $requester-id ]
     ; to list [ match
      { $existing : $existing }
      { true (
       ; to fresh {}
       ; to scope.active-imports $requester-id $fresh
       $fresh
      ) }
     ]
     !list.push $target-id
     ; set $list tracked-list
    ) }
   ]
   ; to open-lane [ get scope.by-id $target-id ]
   ; to res [ match
    { $open-lane.notebook (
     !open-lane.notebook.when-idle
     ; to completed !open-lane.notebook.has-run
     [ match
      { $completed : ; object { ok true } { state $open-lane.notebook.state } { error null } }
      { true : !scope.evaluate-stored-lane $target-id }
     ]
    ) }
    { true : !scope.evaluate-stored-lane $target-id }
   ]
   [ match
    { $tracked-list (
     ; to idx !tracked-list.indexOf $target-id
     ; condition { propertyIsGreaterThanOrEqual 0 idx } : !tracked-list.splice $idx 1
    ) }
   ]
   $res
  ) }
 ]
)
; to scope.notify-lane-idle (
 -- Re-runs mounted lanes that import from a lane once that lane finishes running and becomes idle
 ; to { source-id visited } $argv
 ; to seen [ match
  { $visited : $visited }
  { true : ; object }
 ]
 ; to already [ get seen $source-id ]
 [ match
  { $already : null }
  { true (
   ; to seen $source-id true
   ; each $scope.lanes (
    ; to { lane } $argv
    ; to is-other [ ternary [ propertyIs $source-id lane.id ] false true ]
    ; to not-seen [ ternary [ get seen $lane.id ] false true ]
    ; condition { propertyIs true is-other } (
     ; condition { propertyIs true not-seen } (
      [ match
       { $lane.notebook.imports-from (
        ; to depends !lane.notebook.imports-from $source-id
        ; condition { propertyIs true depends } : !lane.notebook.run $seen
       ) }
      ]
     )
    )
   )
  ) }
 ]
)
; to scope.configure (
 -- Opens the configuration modal for a mounted lane
 ; to { id } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane : !config-modal.open $lane }
 ]
)
; to scope.mount (
 -- Mounts a lane DOM header, gear config button, minimize buttons, reload button, close button, resize handles, notebook body, and registers it on scope
 ; to { id title lane-data initial-tab initial-subroute initial-width initial-minimized } $argv
 ; to tab !normalizeLaneTab $initial-tab
 ; to subroute [ match
  { $initial-subroute : $initial-subroute }
  { true : '' }
 ]
 ; to created !scope.create-lane
 ; to element [ match
  { $created.header : $created.header }
  { true : $created }
 ]
 ; to body-el [ match
  { $created.body : $created.body }
  { true : null }
 ]
 !element.setAttribute data-lane-id $id
 ; assign element.style { textAlign left } { verticalAlign top } { padding '0.25em 0.75em' }
 ; to header-top !document.createElement div
 ; set lane-header-top header-top.className
 ; to config-btn !document.createElement button
 ; assign $config-btn { type button } { className 'lane-control-btn lane-config-btn' } { title 'Configure lane' } { innerHTML '<svg class="lane-config-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M6.56 3L6.63 1.24L9.37 1.24L9.44 3A5.2 5.2 0 0 1 11.61 4.26L13.17 3.43L14.54 5.81L13.05 6.75A5.2 5.2 0 0 1 13.05 9.25L14.54 10.19L13.17 12.57L11.61 11.74A5.2 5.2 0 0 1 9.44 13L9.37 14.76L6.63 14.76L6.56 13A5.2 5.2 0 0 1 4.39 11.74L2.83 12.57L1.46 10.19L2.95 9.25A5.2 5.2 0 0 1 2.95 6.75L1.46 5.81L2.83 3.43L4.39 4.26A5.2 5.2 0 0 1 6.56 3ZM8 5.5A2.5 2.5 0 1 0 8 10.5A2.5 2.5 0 1 0 8 5.5Z"></path></svg>' }
 !config-btn.setAttribute aria-label 'Configure lane'
 !config-btn.addEventListener click : !scope.configure $id
 ; to meta-el !document.createElement div
 ; set lane-header-meta meta-el.className
 ; to title-el !document.createElement div
 ; set $title title-el.textContent
 ; to id-el !document.createElement div
 ; set $id id-el.textContent
 ; assign id-el.style { fontFamily '"IBM Plex Mono", monospace' } { fontSize 10px } { fontWeight normal } { opacity '0.65' }
 !meta-el.appendChild $title-el
 !meta-el.appendChild $id-el
 ; to min-left-btn !document.createElement button
 ; assign $min-left-btn { type button } { className 'lane-min-btn lane-min-btn--left' } { title 'Minimize to left rail' } { innerHTML '<svg class="lane-min-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8L10 12.5"></path></svg>' }
 !min-left-btn.setAttribute aria-label 'Minimize to left rail'
 !min-left-btn.addEventListener click : !scope.minimize $id left
 ; to min-right-btn !document.createElement button
 ; assign $min-right-btn { type button } { className 'lane-min-btn lane-min-btn--right' } { title 'Minimize to right rail' } { innerHTML '<svg class="lane-min-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5L10.5 8L6 12.5"></path></svg>' }
 !min-right-btn.setAttribute aria-label 'Minimize to right rail'
 !min-right-btn.addEventListener click : !scope.minimize $id right
 ; to reload-btn !document.createElement button
 ; assign $reload-btn { type button } { className lane-reload-btn } { textContent '↻' } { title 'Reload lane' }
 !reload-btn.setAttribute aria-label 'Reload lane'
 !reload-btn.addEventListener click : !scope.reload $id
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-close-btn } { textContent '×' } { title 'Close lane' }
 !close-btn.addEventListener click : !scope.close $id
 !header-top.appendChild $config-btn
 !header-top.appendChild $meta-el
 !header-top.appendChild $min-left-btn
 !header-top.appendChild $min-right-btn
 !header-top.appendChild $reload-btn
 !header-top.appendChild $close-btn
 !element.appendChild $header-top
 ; to header-resizer !document.createElement div
 !element.appendChild $header-resizer
 ; to lane [ object
  { id $id }
  { tab $tab }
  { subroute $subroute }
  { title $title }
  { width null }
  { rendered-width null }
  { is-resizing false }
  { is-minimized false }
  { minimized-side null }
  { minimized-header-btn null }
  { minimized-placeholder null }
  { minimized-title-el null }
  { header-top $header-top }
  { title-el $title-el }
  { data $lane-data }
  { element $element }
  { body $body-el }
  { header-resizer $header-resizer }
  { body-resizer null }
  { config-btn $config-btn }
  { min-left-btn $min-left-btn }
  { min-right-btn $min-right-btn }
  { reload-btn $reload-btn }
  { close-btn $close-btn }
 ]
 !scope.attach-lane-resizer $lane $header-resizer
 !scope.lanes.push $lane
 ; set $scope.lanes.length lane.number
 !scope.lane-ids.push $id
 ; to scope.by-id $id $lane
 [ match
  { $body-el (
   !body-el.setAttribute data-lane-id $id
   !lane-notebook.mount $lane $body-el $scope $tab
   ; to body-resizer !document.createElement div
   ; set $body-resizer lane.body-resizer
   !scope.attach-lane-resizer $lane $body-resizer
   !body-el.appendChild $body-resizer
  ) }
 ]
 !scope.apply-lane-width $lane $initial-width
 ; to norm-min !normalizeLaneMinimizeSide $initial-minimized
 [ match
  { $norm-min : !scope.minimize $id $norm-min true }
 ]
 $lane
)
; to scope.update-url (
 -- Updates browser URL pathname to reflect current lane IDs and active tabs while preserving search and hash
 ; to pathname !formatLaneRoutes $scope.lanes
 ; to search [ match
  { $location.search : $location.search }
  { true : '' }
 ]
 ; to hash [ match
  { $location.hash : $location.hash }
  { true : '' }
 ]
 ; to url ; add [ ; add $pathname $search ] $hash
 [ match
  { [ propertyIs $location.pathname pathname ] : null }
  { true : !history.pushState null '' $url }
 ]
)
; to scope.reload (
 -- Reloads an open lane from scratch from persisted KV storage (title, width, minimized, script, inputs, tables, output) while preserving its position and selected tab
 ; to { id } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   [ match
    { $rails.preview-lane (
     ; condition { propertyIs $id rails.preview-lane.id } : !rails.hide-preview
    ) }
   ]
   ; to was-minimized $lane.is-minimized
   ; to raw-tab [ match
    { $lane.notebook.active-tab : $lane.notebook.active-tab }
    { true : $lane.tab }
   ]
   ; to current-tab !normalizeLaneTab $raw-tab
   ; set $current-tab lane.tab
   ; to stored-title !lane.data.get title
   ; to stored-width !lane.data.get width
   ; to stored-minimized !lane.data.get minimized
   ; to next-min !normalizeLaneMinimizeSide $stored-minimized
   [ match
    { $stored-title (
     ; set $stored-title lane.title
     ; set $stored-title lane.title-el.textContent
     !scope.sync-minimized-labels $lane
     !scope.register $id $stored-title
     !scope.refresh-import-labels $id
    ) }
   ]
   !scope.apply-lane-width $lane $stored-width
   [ match
    { $lane.body (
     [ match
      { $lane.body.replaceChildren : !lane.body.replaceChildren }
      { true (
       ; while { propertyIsGreaterThan 0 lane.body.children.length } (
        ; to child !lane.body.children.pop
        [ match
         { $child.remove : !child.remove }
        ]
       )
      ) }
     ]
     ; set null lane.minimized-placeholder
     ; set null lane.minimized-title-el
     !lane-notebook.mount $lane $lane.body $scope $current-tab
     [ match
      { $lane.body-resizer : !lane.body.appendChild $lane.body-resizer }
     ]
     [ match
      { [ propertyIs input current-tab ] : !scope.notify-lane-idle $id }
      { [ propertyIs data current-tab ] : !scope.notify-lane-idle $id }
     ]
    ) }
   ]
   [ match
    { $next-min : !scope.minimize $id $next-min true }
    { $was-minimized : !scope.restore $id true }
   ]
  ) }
 ]
 $lane
)
; to scope.close (
 -- Safely closes an open lane from the view while preserving its persisted data
 ; to { id } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   ; to was-minimized $lane.is-minimized
   !rails.remove $id
   [ match
    { $was-minimized : !lane.data.set minimized '' }
   ]
   !lane.element.remove
   [ match
    { $lane.body : !lane.body.remove }
   ]
   ; to lane-idx !scope.lanes.indexOf $lane
   ; condition { propertyIsGreaterThanOrEqual 0 lane-idx } : !scope.lanes.splice $lane-idx 1
   ; to id-idx !scope.lane-ids.indexOf $id
   ; condition { propertyIsGreaterThanOrEqual 0 id-idx } : !scope.lane-ids.splice $id-idx 1
   !window.Reflect.deleteProperty $scope.by-id $id
   !scope.update-url
  ) }
 ]
 $lane
)
; to scope.add (
 -- Creates, persists, registers, and mounts a new lane
 !console.log lane-control--add $argv
 ; to id !crypto.randomUUID
 ; to number ; add $scope.lanes.length 1
 ; to title ; add 'Lane ' $number
 ; to lane-data !data.namespace $id
 ; to lane !scope.mount $id $title $lane-data
 !scope.update-url
 !lane-data.set title $title
 !scope.register $id $title
 !console.log new lane $lane
 $lane
)
; to scope.open (
 -- Loads or initializes a lane by ID on an optional tab and subroute, registers it, and mounts it if not already open
 ; to { id tab subroute } $argv
 ; to existing [ get scope.by-id $id ]
 [ match
  { $existing (
   [ match
    { [ propertyIs undefined tab ] : null }
    { true (
     ; to normalized-tab !normalizeLaneTab $tab
     ; set $normalized-tab existing.tab
     ; to next-subroute [ match
      { $subroute : $subroute }
      { true : '' }
     ]
     ; set $next-subroute existing.subroute
     [ match
      { [ and { [ propertyIs data normalized-tab ] } { $existing.notebook.data-view.select-table-by-name } ] : !existing.notebook.data-view.select-table-by-name $next-subroute true }
     ]
     [ match
      { $existing.notebook.set-tab : !existing.notebook.set-tab $normalized-tab true }
     ]
    ) }
   ]
   $existing
  ) }
  { true (
   ; to normalized-tab !normalizeLaneTab $tab
   ; to lane-data !data.namespace $id
   ; to stored-title !lane-data.get title
   ; to stored-width !lane-data.get width
   ; to stored-minimized !lane-data.get minimized
   ; to number ; add $scope.lanes.length 1
   ; to title [ match
    { $stored-title : $stored-title }
    { true (
     ; to default-title ; add 'Lane ' $number
     !lane-data.set title $default-title
     $default-title
    ) }
   ]
   !scope.register $id $title
   ; to lane !scope.mount $id $title $lane-data $normalized-tab $subroute $stored-width $stored-minimized
   $lane
  ) }
 ]
)
; to scope.clear (
 -- Removes all mounted lane elements and resets lane collections and side rails
 !rails.clear
 ; while { propertyIsGreaterThan 0 scope.lanes.length } (
  ; to removing !scope.lanes.pop
  !removing.element.remove
  [ match
   { $removing.body : !removing.body.remove }
  ]
 )
 ; set 0 scope.lane-ids.length
 ; to scope.by-id ; object
)
; to scope.sync (
 -- Synchronizes mounted lanes and their active tabs from the current URL pathname
 !scope.clear
 ; to routes !parseLaneRoutes $location.pathname
 ; each $routes (
  ; to { route } $argv
  !scope.open $route.id $route.tab $route.subroute
 )
)
; to scope.init (
 -- Subscribes to popstate and performs initial URL sync
 !window.addEventListener popstate $scope.sync
 !scope.sync
)
!console.log $scope
$scope
