-- file lane-notebook.fs
; to lane-story ; load /src/lane-story.fs
; to lane-inputs ; load /src/lane-inputs.fs
; to lane-scope ; load /src/lane-scope.fs
; to lane-data ; load /src/lane-data.fs
; to lane-output ; load /src/lane-output.fs
; to lane-server ; load /src/lane-server.fs
; to lane-line-info-mod ; load /src/lane-line-info-modal.fs
; to scope ; object
; to scope.parse-stored (
 -- Parses persisted lane script storage into an array of line strings
 ; to { stored } $argv
 [ match
  { [ propertyIs null stored ] : { '' } }
  { [ propertyIs undefined stored ] : { '' } }
  { [ !stored.startsWith '[' ] (
   ; to parsed !window.JSON.parse $stored
   [ match
    { [ !window.Array.isArray $parsed ] : $parsed }
    { true : { '' } }
   ]
  ) }
  { true : !stored.split '\n' }
 ]
)
; to scope.has-newline (
 -- Returns true when a line string contains a newline character
 ; to { text } $argv
 [ match
  { [ propertyIs null text ] : false }
  { [ propertyIs undefined text ] : false }
  { [ !text.includes '\n' ] : true }
  { [ !text.includes '\r' ] : true }
  { true : false }
 ]
)
; to scope.auto-size-textarea (
 -- Expands a textarea element vertically to fit its current content without ever shrinking it
 ; to { el } $argv
 [ match
  { $el (
   ; to text [ match
    { [ propertyIs null el.value ] : '' }
    { [ propertyIs undefined el.value ] : '' }
    { true : $el.value }
   ]
   ; to parts !text.split '\n'
   ; to line-count !window.Math.max 1 $parts.length
   ; to prev-rows [ match
    { [ propertyIsGreaterThan 0 el.rows ] : $el.rows }
    { true : 1 }
   ]
   ; to next-rows !window.Math.max $prev-rows $line-count
   ; set $next-rows el.rows
   [ match
    { $el.style (
     ; to prev-style-h !normalizeLaneWidth $el.style.height
     ; to prev-h [ match
      { [ propertyIsGreaterThan 0 prev-style-h ] : $prev-style-h }
      { true : 0 }
     ]
     ; to sh $el.scrollHeight
     [ match
      { [ propertyIsGreaterThan 0 sh ] (
       ; to oh [ match
        { [ propertyIsGreaterThan 0 el.offsetHeight ] : $el.offsetHeight }
        { true : 0 }
       ]
       ; to ch [ match
        { [ propertyIsGreaterThan 0 el.clientHeight ] : $el.clientHeight }
        { true : 0 }
       ]
       ; to raw-border ; subtract $oh $ch
       ; to border [ match
        { [ propertyIsGreaterThan 0 raw-border ] : $raw-border }
        { true : 0 }
       ]
       ; to needed ; add $sh $border
       ; to target !window.Math.max $prev-h $needed
       [ match
        { [ propertyIsGreaterThan $prev-h target ] : ; set [ ; add $target px ] el.style.height }
       ]
      ) }
     ]
    ) }
   ]
  ) }
 ]
)
; to scope.mount (
 -- Mounts a persistent, live-evaluated FieldScript notebook inside a lane container
 ; to { lane container lane-control initial-tab defer-load } $argv
 ; to features [ match
  { $normalizeLaneFeatures : !normalizeLaneFeatures $lane.features }
  { $lane.features : $lane.features }
  { true : ; object { httpServer false } }
 ]
 ; set $features lane.features
 ; to raw-starting-tab !normalizeLaneTab $initial-tab
 ; to starting-tab [ match
  { [ propertyIs server raw-starting-tab ] (
   [ match
    { $features.httpServer : server }
    { true : source }
   ]
  ) }
  { true : $raw-starting-tab }
 ]
 ; set $starting-tab lane.tab
 ; to idle-tracker !createIdleTracker
 ; to nb [ object
  { lane $lane }
  { container $container }
  { lane-control $lane-control }
  { active-tab $starting-tab }
  { lines {} }
  { line-records {} }
  { rows {} }
  { results {} }
  { sent {} }
  { state ; object }
  { run-id 0 }
  { editing-row null }
  { highlighted-line-id null }
  { highlight-timer null }
  { script-initialized false }
  { has-completed-initial-run false }
  { is-loading-script true }
  { disposed false }
  { load-task null }
  { pre-load-finish null }
  { idle-tracker $idle-tracker }
 ]
 ; to init-is-story [ propertyIs story starting-tab ]
 ; to init-is-source [ propertyIs source starting-tab ]
 ; to init-is-input [ propertyIs input starting-tab ]
 ; to init-is-scope [ propertyIs scope starting-tab ]
 ; to init-is-data [ propertyIs data starting-tab ]
 ; to init-is-view [ propertyIs view starting-tab ]
 ; to init-is-server [ propertyIs server starting-tab ]

 ; to root-el !document.createElement div
 ; set lane-notebook root-el.className

 ; to tabs-el !document.createElement div
 ; set lane-tabs tabs-el.className
 !tabs-el.setAttribute role tablist

 ; to story-tab !document.createElement button
 ; assign $story-tab { type button } { className [ ternary $init-is-story 'lane-tab lane-tab--active' lane-tab ] } { textContent Story }
 !story-tab.setAttribute role tab
 !story-tab.setAttribute data-tab story
 !story-tab.setAttribute aria-selected [ ternary $init-is-story 'true' 'false' ]

 ; to source-tab !document.createElement button
 ; assign $source-tab { type button } { className [ ternary $init-is-source 'lane-tab lane-tab--active' lane-tab ] } { textContent Source }
 !source-tab.setAttribute role tab
 !source-tab.setAttribute data-tab source
 !source-tab.setAttribute aria-selected [ ternary $init-is-source 'true' 'false' ]

 ; to input-tab !document.createElement button
 ; assign $input-tab { type button } { className [ ternary $init-is-input 'lane-tab lane-tab--active' lane-tab ] } { textContent Input }
 !input-tab.setAttribute role tab
 !input-tab.setAttribute data-tab input
 !input-tab.setAttribute aria-selected [ ternary $init-is-input 'true' 'false' ]

 ; to scope-tab !document.createElement button
 ; assign $scope-tab { type button } { className [ ternary $init-is-scope 'lane-tab lane-tab--active' lane-tab ] } { textContent Scope }
 !scope-tab.setAttribute role tab
 !scope-tab.setAttribute data-tab scope
 !scope-tab.setAttribute aria-selected [ ternary $init-is-scope 'true' 'false' ]

 ; to data-tab !document.createElement button
 ; assign $data-tab { type button } { className [ ternary $init-is-data 'lane-tab lane-tab--active' lane-tab ] } { textContent Data }
 !data-tab.setAttribute role tab
 !data-tab.setAttribute data-tab data
 !data-tab.setAttribute aria-selected [ ternary $init-is-data 'true' 'false' ]

 ; to view-tab !document.createElement button
 ; assign $view-tab { type button } { className [ ternary $init-is-view 'lane-tab lane-tab--active' lane-tab ] } { textContent View }
 !view-tab.setAttribute role tab
 !view-tab.setAttribute data-tab view
 !view-tab.setAttribute aria-selected [ ternary $init-is-view 'true' 'false' ]

 ; to server-tab !document.createElement button
 ; assign $server-tab { type button } { className [ ternary $init-is-server 'lane-tab lane-tab--active' lane-tab ] } { textContent Server } { hidden [ ternary $features.httpServer false true ] }
 !server-tab.setAttribute role tab
 !server-tab.setAttribute data-tab server
 !server-tab.setAttribute aria-selected [ ternary $init-is-server 'true' 'false' ]

 !tabs-el.appendChild $story-tab
 !tabs-el.appendChild $source-tab
 !tabs-el.appendChild $input-tab
 !tabs-el.appendChild $scope-tab
 !tabs-el.appendChild $data-tab
 !tabs-el.appendChild $view-tab
 !tabs-el.appendChild $server-tab

 ; to story-panel !document.createElement div
 ; set lane-tab-panel story-panel.className
 !story-panel.setAttribute role tabpanel
 !story-panel.setAttribute data-panel story
 ; set [ ternary $init-is-story false true ] story-panel.hidden
 ; to story-boot-el !document.createElement div
 ; assign $story-boot-el { className cc-loading } { textContent 'Loading story…' } { hidden false }
 !story-panel.appendChild $story-boot-el

 ; to source-panel !document.createElement div
 ; set lane-tab-panel source-panel.className
 !source-panel.setAttribute role tabpanel
 !source-panel.setAttribute data-panel source
 ; set [ ternary $init-is-source false true ] source-panel.hidden

 ; to input-panel !document.createElement div
 ; set lane-tab-panel input-panel.className
 !input-panel.setAttribute role tabpanel
 !input-panel.setAttribute data-panel input
 ; set [ ternary $init-is-input false true ] input-panel.hidden
 ; to input-boot-el !document.createElement div
 ; assign $input-boot-el { className cc-loading } { textContent 'Loading inputs…' } { hidden false }
 !input-panel.appendChild $input-boot-el

 ; to scope-panel !document.createElement div
 ; set lane-tab-panel scope-panel.className
 !scope-panel.setAttribute role tabpanel
 !scope-panel.setAttribute data-panel scope
 ; set [ ternary $init-is-scope false true ] scope-panel.hidden
 ; to scope-boot-el !document.createElement div
 ; assign $scope-boot-el { className 'cc-loading cc-loading--scope' } { textContent 'Loading scope…' } { hidden false }
 !scope-panel.appendChild $scope-boot-el

 ; to data-panel !document.createElement div
 ; set lane-tab-panel data-panel.className
 !data-panel.setAttribute role tabpanel
 !data-panel.setAttribute data-panel data
 ; set [ ternary $init-is-data false true ] data-panel.hidden
 ; to data-boot-el !document.createElement div
 ; assign $data-boot-el { className cc-loading } { textContent 'Loading tables…' } { hidden false }
 !data-panel.appendChild $data-boot-el

 ; to server-panel !document.createElement div
 ; set lane-tab-panel server-panel.className
 !server-panel.setAttribute role tabpanel
 !server-panel.setAttribute data-panel server
 ; set [ ternary $init-is-server false true ] server-panel.hidden
 ; to server-boot-el !document.createElement div
 ; assign $server-boot-el { className cc-loading } { textContent 'Loading server…' } { hidden false }
 !server-panel.appendChild $server-boot-el

 ; to source-loading-el !document.createElement div
 ; assign $source-loading-el { className cc-loading } { textContent 'Loading source…' } { hidden false }
 ; to lines-el !document.createElement div
 ; set lane-lines lines-el.className
 ; to actions-el !document.createElement div
 ; set lane-line-actions actions-el.className
 ; to add-btn !document.createElement button
 ; assign $add-btn { type button } { className lane-add-line } { textContent '+' } { title 'Add line' } { disabled true }
 ; to add-import-btn !document.createElement button
 ; assign $add-import-btn { type button } { className lane-add-import } { textContent '+ Import' } { title 'Import value from another lane' } { disabled true }
 ; to add-export-btn !document.createElement button
 ; assign $add-export-btn { type button } { className lane-add-export } { textContent '+ Export' } { title 'Export evaluated line content to another lane' } { disabled true }
 !actions-el.appendChild $add-btn
 !actions-el.appendChild $add-import-btn
 !actions-el.appendChild $add-export-btn
 !source-panel.appendChild $source-loading-el
 !source-panel.appendChild $lines-el
 !source-panel.appendChild $actions-el

 !root-el.appendChild $tabs-el
 !root-el.appendChild $source-panel
 !root-el.appendChild $input-panel
 !root-el.appendChild $scope-panel
 !root-el.appendChild $data-panel
 !root-el.appendChild $server-panel
 !root-el.appendChild $story-panel
 [ match
  { $lane-control.insert-lane-body-node : !lane-control.insert-lane-body-node $lane $container $root-el }
  { true : !container.appendChild $root-el }
 ]

 ; to tabs ; object { story $story-tab } { source $source-tab } { input $input-tab } { scope $scope-tab } { data $data-tab } { view $view-tab } { server $server-tab }
 ; assign $nb { element $root-el } { tabs-el $tabs-el } { tabs $tabs } { story-panel $story-panel } { source-panel $source-panel } { input-panel $input-panel } { scope-panel $scope-panel } { data-panel $data-panel } { server-panel $server-panel } { source-loading-el $source-loading-el } { lines-el $lines-el } { actions-el $actions-el } { add-btn $add-btn } { add-import-btn $add-import-btn } { add-export-btn $add-export-btn }

 ; to nb.dispose (
  -- Terminates the dedicated Source Web Worker and disposes any active sandboxed Lane Output iframes
  ; set true nb.disposed
  [ match
   { $nb.source-runner.dispose : !nb.source-runner.dispose }
  ]
  [ match
   { $nb.output-view.dispose : !nb.output-view.dispose }
  ]
 )

 ; to nb.when-idle (
  -- Resolves once all in-flight runs of this lane have completed
  !idle-tracker.whenIdle
 )

 ; to nb.is-running (
  -- Returns true while this lane is actively evaluating Source
  !idle-tracker.isRunning
 )

 ; to nb.has-run (
  -- Returns true if this lane has completed at least one run
  !idle-tracker.hasRun
 )

 ; to nb.imports-from (
  -- Returns true if any import line in this lane targets the given source lane ID
  ; to { source-id } $argv
  ; to found ; object { hit false }
  ; each $nb.rows (
   ; to { row } $argv
   ; condition { propertyIs import row.kind } (
    ; condition { propertyIs $source-id row.spec.laneId } : ; set true found.hit
   )
  )
  $found.hit
 )

 ; to nb.auto-size-rows (
  -- Auto-sizes all multiline row textareas and any active individual line editor
  ; each $nb.rows (
   ; to { row } $argv
   [ match
    { $row.auto-size : !row.auto-size }
   ]
  )
 )

 ; set $nb lane.notebook

 ; to nb.apply-tab-ui (
  -- Updates tab button active styles, panel visibility, and View output mode for the current active tab
  ; to active $nb.active-tab
  ; to is-story [ propertyIs story active ]
  ; to is-source [ propertyIs source active ]
  ; to is-input [ propertyIs input active ]
  ; to is-scope [ propertyIs scope active ]
  ; to is-data [ propertyIs data active ]
  ; to is-view [ propertyIs view active ]
  ; to is-server [ propertyIs server active ]

  ; set [ ternary $is-story 'lane-tab lane-tab--active' lane-tab ] story-tab.className
  ; set [ ternary $is-source 'lane-tab lane-tab--active' lane-tab ] source-tab.className
  ; set [ ternary $is-input 'lane-tab lane-tab--active' lane-tab ] input-tab.className
  ; set [ ternary $is-scope 'lane-tab lane-tab--active' lane-tab ] scope-tab.className
  ; set [ ternary $is-data 'lane-tab lane-tab--active' lane-tab ] data-tab.className
  ; set [ ternary $is-view 'lane-tab lane-tab--active' lane-tab ] view-tab.className
  ; set [ ternary $is-server 'lane-tab lane-tab--active' lane-tab ] server-tab.className
  !story-tab.setAttribute aria-selected [ ternary $is-story 'true' 'false' ]
  !source-tab.setAttribute aria-selected [ ternary $is-source 'true' 'false' ]
  !input-tab.setAttribute aria-selected [ ternary $is-input 'true' 'false' ]
  !scope-tab.setAttribute aria-selected [ ternary $is-scope 'true' 'false' ]
  !data-tab.setAttribute aria-selected [ ternary $is-data 'true' 'false' ]
  !view-tab.setAttribute aria-selected [ ternary $is-view 'true' 'false' ]
  !server-tab.setAttribute aria-selected [ ternary $is-server 'true' 'false' ]

  ; set [ ternary $is-story false true ] story-panel.hidden
  ; set [ ternary $is-source false true ] source-panel.hidden
  ; set [ ternary $is-input false true ] input-panel.hidden
  ; set [ ternary $is-scope false true ] scope-panel.hidden
  ; set [ ternary $is-data false true ] data-panel.hidden
  ; set [ ternary $is-server false true ] server-panel.hidden
  [ match
   { $nb.output-view.set-always-visible : !nb.output-view.set-always-visible $is-view }
  ]
  [ match
   { $nb.output-view.set-suppressed : !nb.output-view.set-suppressed $is-story }
  ]
  [ match
   { [ and { $is-view } { $nb.output-view.set-loading } { [ propertyIs false nb.has-completed-initial-run ] } { [ propertyIs false nb.disposed ] } ] : !nb.output-view.set-loading true }
  ]
  [ match
   { $is-story (
    [ match
     { $nb.story-view.activate : !nb.story-view.activate }
    ]
   ) }
  ]
  [ match
   { $is-source (
    !nb.auto-size-rows
    [ match
     { $window.requestAnimationFrame (
      !window.requestAnimationFrame : !nb.auto-size-rows
     ) }
    ]
   ) }
  ]
 )

 ; to nb.set-features (
  -- Updates enabled lane features, toggles Server tab visibility, and falls back to Source if disabled while active
  ; to { raw-features } $argv
  ; to next-features [ match
   { $normalizeLaneFeatures : !normalizeLaneFeatures $raw-features }
   { $raw-features : $raw-features }
   { true : ; object { httpServer false } }
  ]
  ; set $next-features nb.lane.features
  ; to show-server [ ternary $next-features.httpServer true false ]
  ; set [ ternary $show-server false true ] server-tab.hidden
  [ match
   { [ propertyIs false show-server ] (
    ; condition { propertyIs server nb.active-tab } : !nb.set-tab source
   ) }
  ]
  $next-features
 )

 ; to nb.set-tab (
  -- Switches the active lane tab, updates lane route URL unless skipped, and runs Source on Source, Scope, View, and Server (never on Input or Data)
  ; to { tab skip-url } $argv
  ; to normalized-tab !normalizeLaneTab $tab
  ; to is-server-enabled [ match
   { [ propertyIs true nb.lane.features.httpServer ] : true }
   { true : false }
  ]
  ; to next-tab [ match
   { [ propertyIs server normalized-tab ] (
    [ match
     { $is-server-enabled : server }
     { true : source }
    ]
   ) }
   { true : $normalized-tab }
  ]
  ; set $next-tab nb.active-tab
  ; set $next-tab nb.lane.tab
  !nb.apply-tab-ui
  [ match
   { $skip-url : null }
   { true (
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
     [ match
      { $lane-control.remember-path : !lane-control.remember-path $nb.lane }
     ]
     [ match
      { $lane-control.update-url : !lane-control.update-url }
     ]
    ) : null
    [ match
     { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
    ]
   ) }
  ]
  [ match
   { [ propertyIs story next-tab ] : null }
   { [ propertyIs input next-tab ] : null }
   { [ propertyIs data next-tab ] : null }
   { $nb.run : !nb.run }
  ]
  $next-tab
 )

 !story-tab.addEventListener click : !nb.set-tab story
 !source-tab.addEventListener click : !nb.set-tab source
 !input-tab.addEventListener click : !nb.set-tab input
 !scope-tab.addEventListener click : !nb.set-tab scope
 !data-tab.addEventListener click : !nb.set-tab data
 !view-tab.addEventListener click : !nb.set-tab view
 !server-tab.addEventListener click : !nb.set-tab server

 ; to clear-boot-placeholder (
  ; to { panel boot-el } $argv
  ; set true boot-el.hidden
  !boot-el.remove
  [ match
   { [ and { $panel.children } { $panel.children.indexOf } { $panel.children.splice } ] (
    ; to bidx !panel.children.indexOf $boot-el
    ; condition { propertyIsGreaterThanOrEqual 0 bidx } : !panel.children.splice $bidx 1
   ) }
  ]
 )

 ; to load-notebook-body (
  ; to { pre-finish } $argv
  ; set $pre-finish nb.pre-load-finish
  !clear-boot-placeholder $story-panel $story-boot-el
  ; to story-view !lane-story.mount $lane $story-panel $lane-control $nb
  !clear-boot-placeholder $input-panel $input-boot-el
  ; to inputs-view !lane-inputs.mount $lane $input-panel
  !clear-boot-placeholder $scope-panel $scope-boot-el
  ; to scope-view !lane-scope.mount $lane $scope-panel [ object { initial-loading true } ]
  !clear-boot-placeholder $data-panel $data-boot-el
  ; to data-view !lane-data.mount $lane $data-panel $lane-control
  ; to data-view.on-record-change (
   ; to { change-info } $argv
   [ match
    { [ and $lane-control.preferences-lane-id [ propertyIs $lane.id lane-control.preferences-lane-id ] ] (
     [ match
      { $lane-control.refresh-preferences-from-storage : !lane-control.refresh-preferences-from-storage }
      { $lane-control.sync-preferences-timezones : !lane-control.sync-preferences-timezones }
     ]
    ) }
   ]
   !nb.run-on-table-change $change-info
  )
  !clear-boot-placeholder $server-panel $server-boot-el
  ; to server-view !lane-server.mount $lane $server-panel $lane-control $nb
  ; to output-view !lane-output.mount $lane $container $nb $lane-control
  [ match
   { $output-view.set-loading : !output-view.set-loading [ propertyIs false nb.disposed ] }
  ]
  ; to source-runner [ match
   { $createSourceWorkerRunner : !createSourceWorkerRunner [ object
    { laneId $lane.id }
    { hostOrigin [ match { $window.location.origin : $window.location.origin } { true : '' } ] }
   ] }
   { true : null }
  ]
  ; to info-modal [ match
   { $lane-control.line-info-modal : $lane-control.line-info-modal }
   { true : !lane-line-info-mod.create $container $lane-control }
  ]
  ; assign $nb { story-view $story-view } { inputs-view $inputs-view } { inputs $inputs-view.inputs } { scope-view $scope-view } { data-view $data-view } { tables $data-view.tables } { server-view $server-view } { output-view $output-view } { source-runner $source-runner } { info-modal $info-modal }

 ; to nb.refresh-import-labels (
  -- Updates display labels on all import rows (e.g. after another lane is renamed)
  ; each $nb.rows (
   ; to { row } $argv
   ; condition { propertyIs import row.kind } : !row.update-label
  )
 )

 ; to nb.refresh-export-labels (
  -- Updates display labels on all export rows (e.g. after another lane is renamed)
  ; each $nb.rows (
   ; to { row } $argv
   ; condition { propertyIs export row.kind } : !row.update-label
  )
 )

 ; to nb.refresh-set-by-labels (
  -- Updates Set-by display labels on all rows set by another lane's export
  ; each $nb.rows (
   ; to { row } $argv
   [ match
    { $row.update-set-by-label : !row.update-set-by-label }
   ]
  )
 )

 ; to nb.apply-line-set-by (
  -- Sets or updates the Set-by indicator on a row by line ID without re-running Source
  ; to { line-id set-by } $argv
  ; to found ; object { row null }
  ; each $nb.rows (
   ; to { r } $argv
   ; condition { propertyIs $line-id r.record.id } : ; set $r found.row
  )
  ; to target-row $found.row
  [ match
   { [ and { $target-row } { $target-row.set-set-by } ] : !target-row.set-set-by $set-by }
  ]
  $target-row
 )

 ; to nb.clear-line-set-by (
  -- Clears the Set-by indicator on a row by line ID when matching the given exporter lane and line ID
  ; to { line-id source-lane-id source-line-id } $argv
  ; to found ; object { row null }
  ; each $nb.rows (
   ; to { r } $argv
   ; condition { propertyIs $line-id r.record.id } : ; set $r found.row
  )
  ; to target-row $found.row
  [ match
   { $target-row.set-by (
    ; to cur-sb $target-row.set-by
    ; to match-lane [ match
     { [ propertyIs '' source-lane-id ] : true }
     { [ propertyIs null source-lane-id ] : true }
     { [ propertyIs undefined source-lane-id ] : true }
     { [ propertyIs $source-lane-id cur-sb.laneId ] : true }
     { true : false }
    ]
    ; to match-line [ match
     { [ propertyIs '' source-line-id ] : true }
     { [ propertyIs null source-line-id ] : true }
     { [ propertyIs undefined source-line-id ] : true }
     { [ propertyIs $source-line-id cur-sb.lineId ] : true }
     { true : false }
    ]
    ; condition { and { propertyIs true match-lane } { propertyIs true match-line } } (
     [ match
      { $target-row.set-set-by : !target-row.set-set-by null }
     ]
    )
   ) }
  ]
  $target-row
 )

 ; to nb.clear-highlight (
  -- Clears any active line highlight in this notebook
  [ match
   { $nb.highlight-timer (
    [ match
     { $window.clearTimeout : !window.clearTimeout $nb.highlight-timer }
    ]
    ; set null nb.highlight-timer
   ) }
  ]
  ; set null nb.highlighted-line-id
  ; each $nb.rows (
   ; to { r } $argv
   ; condition { propertyIs true r.is-highlighted } (
    ; set false r.is-highlighted
    [ match
     { $r.el.removeAttribute : !r.el.removeAttribute data-highlighted }
    ]
    [ match
     { $r.update-classes : !r.update-classes }
    ]
   )
  )
 )

 ; to nb.highlight-line (
  -- Switches to Source tab if needed, highlights the specified line by ID, and scrolls it into view unless skip-scroll is true
  ; to { line-id skip-scroll } $argv
  ; to is-source [ propertyIs source nb.active-tab ]
  ; condition { propertyIs false is-source } : !nb.set-tab source
  !nb.clear-highlight
  ; to found ; object { row null }
  [ match
   { $line-id (
    ; each $nb.rows (
     ; to { r } $argv
     ; condition { propertyIs $line-id r.record.id } : ; set $r found.row
    )
   ) }
  ]
  ; to target-row [ match
   { $found.row : $found.row }
   { [ propertyIsGreaterThan 0 nb.rows.length ] : $nb.rows.0 }
   { true : null }
  ]
  [ match
   { $target-row (
    ; set true target-row.is-highlighted
    ; set $target-row.record.id nb.highlighted-line-id
    !target-row.el.setAttribute data-highlighted 'true'
    [ match
     { $target-row.update-classes : !target-row.update-classes }
    ]
    [ match
     { $skip-scroll : null }
     { $target-row.el.scrollIntoView : !target-row.el.scrollIntoView [ object { behavior smooth } { block center } { inline nearest } ] }
    ]
    [ match
     { $window.setTimeout (
      ; to timer !window.setTimeout (
       ; set null nb.highlight-timer
       ; set false target-row.is-highlighted
       ; condition { propertyIs $target-row.record.id nb.highlighted-line-id } : ; set null nb.highlighted-line-id
       [ match
        { $target-row.el.removeAttribute : !target-row.el.removeAttribute data-highlighted }
       ]
       [ match
        { $target-row.update-classes : !target-row.update-classes }
       ]
      ) 2200
      ; set $timer nb.highlight-timer
     ) }
    ]
   ) }
  ]
  $target-row
 )

 ; to nb.refresh-export-statuses (
  -- Refreshes deploy status bars on export rows targeting the given lane ID (or all export rows if omitted)
  ; to { target-id } $argv
  ; each $nb.rows (
   ; to { row } $argv
   ; condition { propertyIs export row.kind } (
    ; to match-hit ; object { hit false }
    [ match
     { [ propertyIs '' target-id ] : ; set true match-hit.hit }
     { [ propertyIs undefined target-id ] : ; set true match-hit.hit }
     { [ propertyIs null target-id ] : ; set true match-hit.hit }
     { true (
      ; each $row.spec.targets (
       ; to { t } $argv
       ; condition { propertyIs $target-id t.laneId } : ; set true match-hit.hit
      )
     ) }
    ]
    ; condition { propertyIs true match-hit.hit } : !row.refresh-deploy-status
   )
  )
 )

 ; to collect-line-ids (
  -- Extracts ordered line IDs from nb.line-records
  ; to ids {}
  ; each $nb.line-records (
   ; to { rec } $argv
   !ids.push $rec.id
  )
  $ids
 )

 ; to validate-line (
  -- Validates that a Source line is parseable FieldScript without syntax errors
  ; to { text line-idx } $argv
  [ match
   { $validateFieldScriptLine : !validateFieldScriptLine $text [ object { filename $nb.lane.id } { lineIndex $line-idx } ] }
   { true : ; object { ok true } { error null } }
  ]
 )

 ; to save-row-draft (
  -- Persists a rejected unparseable Source line draft in localStorage without writing to KV
  ; to { row draft-text err-msg expr-text } $argv
  ; to draft-spec [ object
   { lineId $row.record.id }
   { lineIndex $row.index }
   { text $draft-text }
   { savedText $row.record.text }
   { error [ match { $err-msg : $err-msg } { true : 'Syntax error' } ] }
  ]
  [ match
   { [ propertyIs false [ propertyIs undefined expr-text ] ] : ; set $expr-text draft-spec.exprText }
  ]
  [ match
   { $saveLaneSourceDraft : !saveLaneSourceDraft $data $window $nb.lane.id $draft-spec }
   { true : $draft-spec }
  ]
 )

 ; to clear-row-draft (
  -- Removes any stored rejected draft for a Source row from localStorage and hides its draft notice
  ; to { row } $argv
  [ match
   { [ and { $clearLaneSourceDraft } { $row.record.id } ] (
    !clearLaneSourceDraft $data $window $nb.lane.id $row.record.id
   ) }
  ]
  [ match
   { $row.set-draft : !row.set-draft null false }
  ]
 )

 ; to commit-or-draft-row (
  -- Evaluates live Source, then saves to KV if parseable or stores a rejected draft in localStorage if unparseable
  ; to { row next-text expr-text } $argv
  ; to nb.lines $row.index $next-text
  ; to check !validate-line $next-text $row.index
  !nb.run
  [ match
   { $check.ok (
    ; set $next-text row.record.text
    !clear-row-draft $row
    !nb.save-line $row
   ) }
   { true (
    ; to draft-rec !save-row-draft $row $next-text $check.error $expr-text
    [ match
     { $row.set-draft : !row.set-draft $draft-rec true }
    ]
    null
   ) }
  ]
 )

 ; to persist-structural (
  -- Persists structural index changes alongside newly inserted/edited (or all initial unpersisted) line records
  ; to { dirty-recs removed-recs } $argv
  ; to was-init $nb.script-initialized
  ; set true nb.script-initialized
  ; to all-ids !collect-line-ids
  ; to to-write [ match
   { $was-init : $dirty-recs }
   { true : $nb.line-records }
  ]
  ; to to-remove [ match
   { $removed-recs : $removed-recs }
   { true : {} }
  ]
  !saveScriptLinesAndIndex $data $nb.lane.data $nb.lane.id $to-write $all-ids $to-remove
 )

 ; to nb.save-line (
  -- Persists a single script line record and updates its modification timestamp
  ; to { row } $argv
  [ match
   { $row.record (
    [ match
     { $nb.script-initialized (
      ; to all-ids !collect-line-ids
      !saveScriptLine $data $nb.lane.data $nb.lane.id $row.record $all-ids false
     ) }
     { true : !persist-structural { $row.record } {} }
    ]
   ) }
  ]
 )

 ; to nb.save (
  -- Persists all lane script line records to split per-line KV storage
  ; set true nb.script-initialized
  ; to saved !saveLaneScript $data $nb.lane.data $nb.lane.id $nb.line-records $window
  ; each $saved (
   ; to { rec idx } $argv
   ; to existing [ get nb.line-records $idx ]
   [ match
    { $existing : ; set $rec.updatedAt existing.updatedAt }
   ]
  )
 )

 ; to nb.renumber (
  -- Updates displayed 1-based line numbers and live row indices
  ; each $nb.rows (
   ; to { row idx } $argv
   ; to num ; add $idx 1
   ; set $idx row.index
   ; set $num row.num-el.textContent
   [ match
    { [ and { $lane-control.cache-line-number } { $row.record.id } ] (
     !lane-control.cache-line-number $nb.lane.id $row.record.id $num
    ) }
   ]
  )
  [ match
   { [ and { $nb.script-initialized } { $lane-control.refresh-line-numbers } ] (
    !lane-control.refresh-line-numbers $nb.lane.id
   ) }
  ]
 )

 ; to nb.has-table-change-script (
  -- Returns true when the notebook script contains any cross-lane table sync, export, or deploy command
  ; to found ; object { hit false }
  ; each $nb.lines (
   ; to { line-text } $argv
   ; condition { propertyIs false found.hit } (
    ; to txt [ match { $line-text : ; add '' $line-text } { true : '' } ]
    ; to trimmed [ match { $txt.trim : !txt.trim } { true : $txt } ]
    ; to is-comment [ match
     { [ propertyIs '--' trimmed ] : true }
     { [ !trimmed.startsWith '-- ' ] : true }
     { [ !trimmed.startsWith '--\t' ] : true }
     { true : false }
    ]
    ; condition { propertyIs false is-comment } (
     [ match
      { [ !txt.includes syncLaneTable ] : ; set true found.hit }
      { [ !txt.includes deployLane ] : ; set true found.hit }
      { [ !txt.includes resyncLane ] : ; set true found.hit }
      { [ !txt.includes exportLaneLine ] : ; set true found.hit }
      { [ !txt.includes setLaneLine ] : ; set true found.hit }
     ]
    )
   )
  )
  $found.hit
 )

 ; to nb.run-on-table-change (
  -- Runs the lane script when a record in a Data table changes and the script contains table-triggered sync/deploy/export logic
  ; to { change-info } $argv
  ; to has-trigger !nb.has-table-change-script
  [ match
   { $has-trigger : !nb.run null true $change-info }
   { true : null }
  ]
 )

 ; to nb.run (
  -- Evaluates all notebook lines top-to-bottom when on Source, Scope, View, or Server (skipped on Story, Input, and Data unless force-run is true for a table record change)
  ; to { visited force-run table-change run-meta } $argv
  ; to skip-for-tab [ match
   { [ propertyIs true force-run ] : false }
   { [ propertyIs story nb.active-tab ] : true }
   { [ propertyIs input nb.active-tab ] : true }
   { [ propertyIs data nb.active-tab ] : true }
   { true : false }
  ]
  [ match
   { $skip-for-tab : null }
   { true (
    ; to next-run-id ; add $nb.run-id 1
    ; set $next-run-id nb.run-id
    ; to finish !idle-tracker.begin
    [ match
     { $nb.pre-load-finish (
      !nb.pre-load-finish false
      ; set null nb.pre-load-finish
     ) }
    ]
    [ match
     { $scope-view.set-loading : !scope-view.set-loading true }
    ]
    [ match
     { $output-view.set-loading : !output-view.set-loading true }
    ]
    ; to trigger [ match
     { $run-meta.trigger : $run-meta.trigger }
     { $table-change : 'table-change' }
     { $visited : import }
     { [ propertyIs false nb.has-completed-initial-run ] : mount }
     { true : manual }
    ]
    ; to story-rec [ match
     { $createStoryRunRecorder : !createStoryRunRecorder [ object { laneId $nb.lane.id } { trigger $trigger } ] }
     { true : null }
    ]
    ; to line-ctx ; object { index null } { lineNumber null } { lineId '' }
    ; to import-lane-fn (
     ; to { target-id ...path } $argv
     [ match
      { [ propertyIs '' target-id ] : undefined }
      { [ propertyIs undefined target-id ] : undefined }
      { $lane-control (
       [ match
        { [ and { $trackStoryImportCall } { $story-rec } ] (
         ; to tgt-title [ match
          { $lane-control.get-lane-title : !lane-control.get-lane-title $target-id }
          { true : $target-id }
         ]
         !trackStoryImportCall [ object
          { recorder $story-rec }
          { lineContext $line-ctx }
          { lines $nb.lines }
          { targetId $target-id }
          { path $path }
          { laneTitle $tgt-title }
          { invokeImport ( ; to res !lane-control.get-lane-final-state $target-id $nb.lane.id , !resolveImportValue $res $path ) }
         ]
        ) }
        { true (
         ; to res !lane-control.get-lane-final-state $target-id $nb.lane.id
         !resolveImportValue $res $path
        ) }
       ]
      ) }
      { true (
       ; to no-ctrl ; object { ok false } { state null } { error 'Lane control is not available' }
       !resolveImportValue $no-ctrl $path
      ) }
     ]
    )
    ; to run-locked-map ; object
    ; to run-locked-pkgs {}
    ; to non-export-locked ; object { hit false }
    ; to export-lane-line-fn (
     ; to { first-arg second-arg third-arg } $argv
     ; to exp-res [ match
      { $lane-control.export-lane-line : !lane-control.export-lane-line $nb.lane.id $first-arg $second-arg $third-arg $visited $line-ctx.lineId }
      { true : ; object { ok false } { targets {} } { laneStatuses {} } { changedCount 0 } { needsDeployCount 0 } { error 'Lane control is not available' } }
     ]
     [ match
      { [ and { [ propertyIs true exp-res.requiresPackageUnlock ] } { $exp-res.lockedPackages } ] (
       ; each $exp-res.lockedPackages (
        ; to { lp } $argv
        ; to already-lp [ get run-locked-map $lp.packageId ]
        [ match
         { $already-lp : null }
         { true (
          ; to run-locked-map $lp.packageId true
          !run-locked-pkgs.push $lp
         ) }
        ]
       )
       ; to has-row-idx [ and { [ propertyIs false [ propertyIs null line-ctx.index ] ] } { [ propertyIs false [ propertyIs undefined line-ctx.index ] ] } { [ propertyIsGreaterThanOrEqual 0 line-ctx.index ] } ]
       ; to cur-row [ match
        { $has-row-idx : [ get nb.rows $line-ctx.index ] }
        { true : null }
       ]
       ; to is-exp-row [ match
        { $cur-row : [ propertyIs export cur-row.kind ] }
        { true : false }
       ]
       ; condition { propertyIs false is-exp-row } : ; set true non-export-locked.hit
      ) }
     ]
     [ match
      { [ and { $trackStoryExportLineCall } { $story-rec } ] (
       !trackStoryExportLineCall [ object
        { recorder $story-rec }
        { lineContext $line-ctx }
        { lines $nb.lines }
        { result $exp-res }
       ]
      ) }
     ]
     $exp-res
    )
    ; to sync-lane-table-fn (
     ; to { target-id tbl-query records key-col } $argv
     ; to sync-res [ match
      { $lane-control.sync-lane-table : !lane-control.sync-lane-table $nb.lane.id $target-id $tbl-query $records $key-col }
      { true : ; object { ok false } { changed false } { count 0 } { error 'Lane control is not available' } }
     ]
     [ match
      { [ and { $trackStoryExportTableCall } { $story-rec } ] (
       ; to tgt-title [ match
        { $lane-control.get-lane-title : !lane-control.get-lane-title $target-id }
        { true : $target-id }
       ]
       !trackStoryExportTableCall [ object
        { recorder $story-rec }
        { lineContext $line-ctx }
        { targetLaneId $target-id }
        { laneTitle $tgt-title }
        { tableName $tbl-query }
        { records $records }
        { result $sync-res }
       ]
      ) }
     ]
     $sync-res
    )
    ; to deploy-lane-fn (
     ; to { target-id deploy-opts } $argv
     [ match
      { $lane-control.deploy-lane : !lane-control.deploy-lane $nb.lane.id $target-id $deploy-opts $table-change }
      { true : ; object { ok false } { status error } { error 'Lane control is not available' } }
     ]
    )
    ; to env [ object
     { console $console }
     { data [ match { $attenuateKv : !attenuateKv $nb.lane.data } { true : $nb.lane.data } ] }
     { Math $window.Math }
     { Number $window.Number }
     { JSON $window.JSON }
     { Date $window.Date }
     { Array $window.Array }
     { fetch ( ; to { u o } $argv, [ match { [ and { $data.isProxyBacked } { $data.externalFetch } ] : !data.externalFetch $u $o } { $window.fetch : !window.fetch $u $o } { true : null } ] ) }
     { importLane $import-lane-fn }
     { exportLaneLine $export-lane-line-fn }
     { setLaneLine $export-lane-line-fn }
     { syncLaneTable $sync-lane-table-fn }
     { deployLane $deploy-lane-fn }
     { resyncLane $deploy-lane-fn }
     { tableChange [ match { $table-change : $table-change } { true : null } ] }
     { respond [ match { $createResponseHelper : !createResponseHelper } { true : null } ] }
    ]
    !inputs-view.seed-env $env
    !data-view.seed-env $env
    ; to captured-inputs [ match
     { $captureStoryEnvInputs : !captureStoryEnvInputs $inputs-view.inputs $env }
     { true : null }
    ]
    ; to run-opts [ object
     { filename $nb.lane.id }
     { initialState $env }
     { lineContext $line-ctx }
     { lineRecords $nb.line-records }
    ]
    ; to run-res ; object { val null }
    ; try (
     ; to outcome [ match
      { $nb.source-runner : !nb.source-runner.run $nb.lines $run-opts }
      { true : !runLines $nb.lines $run-opts }
     ]
     ; set $outcome run-res.val
     [ match
      { [ propertyIs $next-run-id nb.run-id ] (
       ; set $outcome.results nb.results
       ; set $outcome.sent nb.sent
       ; set $outcome.state nb.state
       ; each $outcome.results (
        ; to { res idx } $argv
        ; to row [ get nb.rows $idx ]
        [ match
         { $row (
          ; set $res.preview row.preview-el.textContent
          ; set $res.preview row.preview-el.title
          ; to cls [ match
           { $res.error : 'lane-line-preview lane-line-preview--error' }
           { [ propertyIs true res.value.requiresPackageUnlock ] : 'lane-line-preview lane-line-preview--error' }
           { $res.isComment : 'lane-line-preview lane-line-preview--comment' }
           { true : 'lane-line-preview' }
          ]
          ; set $cls row.preview-el.className
          ; condition { propertyIs export row.kind } (
           [ match
            { $row.render-deploy-status : !row.render-deploy-status $res.value }
           ]
          )
         ) }
        ]
       )
       !scope-view.render $outcome.state
       !output-view.render $outcome.sent
       [ match
        { $server-view.refresh-handlers : !server-view.refresh-handlers $outcome }
       ]
       ; to modal-already-open [ match
        { $lane-control.package-modal.is-open : [ propertyIs true lane-control.package-modal.is-open ] }
        { true : false }
       ]
       ; to should-prompt-unlock [ match
        { [ propertyIs 0 run-locked-pkgs.length ] : false }
        { $modal-already-open : false }
        { [ propertyIs true non-export-locked.hit ] : true }
        { [ propertyIs export trigger ] : true }
        { [ propertyIs 'table-change' trigger ] : true }
        { true : false }
       ]
       ; condition { and { [ propertyIs true should-prompt-unlock ] } { $lane-control.prompt-unlock-packages-for-export } } (
        !lane-control.prompt-unlock-packages-for-export [ object
         { locked-packages $run-locked-pkgs }
         { source-lane-id $nb.lane.id }
         { source-lane-title $nb.lane.title }
         { on-unlocked (
          !nb.run null false null [ object { trigger export-unlock } ]
         ) }
        ]
       )
       ; to all-blank-box ; object { val true }
       ; each $nb.lines (
        ; to { ln-txt } $argv
        ; condition { propertyIs true all-blank-box.val } (
         ; to s [ match
          { [ propertyIs null ln-txt ] : '' }
          { [ propertyIs undefined ln-txt ] : '' }
          { true : ; add '' $ln-txt }
         ]
         ; to trimmed [ match { $s.trim : !s.trim } { true : $s } ]
         ; condition { propertyIsGreaterThan 0 trimmed.length } : ; set false all-blank-box.val
        )
       )
       ; to skip-empty-mount [ ternary [ and
        { [ propertyIs mount trigger ] }
        { [ propertyIs false nb.script-initialized ] }
        { [ propertyIs true all-blank-box.val ] }
        { [ propertyIs 0 inputs-view.inputs.length ] }
       ] true false ]
       ; set true nb.has-completed-initial-run
       !$finish true
       [ match
        { [ and { [ propertyIs false skip-empty-mount ] } { $recordLaneStoryFromRun } ] (
         ; to story-entry !recordLaneStoryFromRun $data $nb.lane.data $nb.lane.id $story-rec $captured-inputs $outcome $nb.line-records [ object { trigger $trigger } ]
         [ match
          { $story-view.on-new-entry : !story-view.on-new-entry $story-entry }
         ]
        ) }
       ]
       [ match
        { $lane-control.notify-lane-idle : !lane-control.notify-lane-idle $nb.lane.id $visited }
       ]
      ) }
      { true : !$finish false }
     ]
    ) (
     ; to { err } $argv
     [ match
      { $console.error : !console.error 'Failed to run lane:' $err }
     ]
     [ match
      { [ propertyIs $next-run-id nb.run-id ] (
       [ match
        { $scope-view.set-loading : !scope-view.set-loading false }
       ]
       [ match
        { $output-view.set-loading : !output-view.set-loading false }
       ]
      ) }
     ]
     !$finish false
     null
    )
    $run-res.val
   ) }
  ]
 )

 ; to normalize-set-by (
  ; to { raw } $argv
  [ match
   { $normalizeLineSetBy : !normalizeLineSetBy $raw }
   { $raw.laneId (
    ; to lid [ match { $raw.laneId.trim : !raw.laneId.trim } { true : ; add '' $raw.laneId } ]
    ; to lnid [ match { $raw.lineId.trim : !raw.lineId.trim } { $raw.lineId : ; add '' $raw.lineId } { true : '' } ]
    [ match
     { [ propertyIs '' lid ] : null }
     { true : ; object { laneId $lid } { lineId $lnid } }
    ]
   ) }
   { true : null }
  ]
 )

 ; to resolve-lane-line-label (
  -- Resolves L<num> for a { laneId lineId } reference from an open lane or lane-control cache, triggering async lookup if closed
  ; to { target-lane-id target-line-id on-resolved } $argv
  [ match
   { [ propertyIs '' target-line-id ] : '' }
   { [ propertyIs null target-line-id ] : '' }
   { [ propertyIs undefined target-line-id ] : '' }
   { true (
    ; to open-lane [ get lane-control.by-id $target-lane-id ]
    ; to found ; object { num null }
    [ match
     { $open-lane.notebook.line-records (
      ; each $open-lane.notebook.line-records (
       ; to { r idx } $argv
       ; condition { propertyIs $target-line-id r.id } : ; set [ ; add $idx 1 ] found.num
      )
     ) }
    ]
    [ match
     { $found.num : ; add L $found.num }
     { true (
      ; to cached-num [ match
       { $lane-control.get-cached-line-number : !lane-control.get-cached-line-number $target-lane-id $target-line-id }
       { true : null }
      ]
      [ match
       { $cached-num : ; add L $cached-num }
       { true (
        [ match
         { [ and { $on-resolved } { $lane-control.resolve-stored-line-number } ] (
          !lane-control.resolve-stored-line-number $target-lane-id $target-line-id $on-resolved
         ) }
        ]
        $target-line-id
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to attach-line-info-btn (
  -- Creates and attaches the hover info button on a code or import row
  ; to { row el } $argv
  ; to info-svg '<svg class="lane-line-info-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.25"></circle><path d="M8 7.25V11.25"></path><circle cx="8" cy="4.85" r="0.6" fill="currentColor" stroke="none"></circle></svg>'
  ; to info-btn !document.createElement button
  ; assign $info-btn { type button } { className lane-line-info } { innerHTML $info-svg } { title 'Line info' }
  !info-btn.setAttribute aria-label 'Line info'
  !info-btn.addEventListener click (
   ; to line-num ; add $row.index 1
   ; to sb $row.set-by
   ; to on-sb-resolved [ match
    { $sb (
     ; to resolved-cb (
      [ match
       { $row.update-set-by-label : !row.update-set-by-label }
      ]
      ; to fresh-lbl !resolve-lane-line-label $sb.laneId $sb.lineId null
      ; to fresh-title [ match
       { $lane-control.get-lane-title : !lane-control.get-lane-title $sb.laneId }
       { true : $sb.laneId }
      ]
      ; set [ ; add 'Line info · Set by ' ; add $fresh-title ; add ' ' $fresh-lbl ] info-btn.title
     )
     $resolved-cb
    ) }
    { true : null }
   ]
   ; to sb-line-lbl [ match
    { $sb : !resolve-lane-line-label $sb.laneId $sb.lineId $on-sb-resolved }
    { true : '' }
   ]
   !info-modal.open [ object
    { lane $nb.lane }
    { lane-id $nb.lane.id }
    { host $nb.container }
    { line-number $line-num }
    { line-id $row.record.id }
    { line-text $row.record.text }
    { updated-at $row.record.updatedAt }
    { set-by $sb }
    { set-by-label $sb-line-lbl }
   ]
  )
  !el.appendChild $info-btn
  ; set $info-btn row.info-btn
  $info-btn
 )

 ; to attach-line-set-by (
  -- Attaches the "Set by <Lane> · L<num>" indicator bar and navigation button to a notebook row
  ; to { row el } $argv
  ; to set-by-el !document.createElement div
  ; assign $set-by-el { className lane-line-set-by } { hidden true }
  ; to set-by-btn !document.createElement button
  ; assign $set-by-btn { type button } { className lane-line-set-by-btn }
  !set-by-el.appendChild $set-by-btn
  ; to initial-sb !normalize-set-by $row.record.setBy
  ; assign $row { set-by $initial-sb } { set-by-el $set-by-el } { set-by-btn $set-by-btn } { is-highlighted false }

  ; to mount-set-by-el (
   [ match
    { [ propertyIs $el set-by-el.parentNode ] : null }
    { $row.editor-el : !el.insertBefore $set-by-el $row.editor-el }
    { true : !el.appendChild $set-by-el }
   ]
  )

  ; to unmount-set-by-el (
   [ match
    { $set-by-el.parentNode : !set-by-el.remove }
   ]
  )

  ; to row.update-set-by-label (
   ; to sb $row.set-by
   [ match
    { $sb (
     ; to lane-title [ match
      { $lane-control.get-lane-title : !lane-control.get-lane-title $sb.laneId }
      { true : $sb.laneId }
     ]
     ; to line-lbl !resolve-lane-line-label $sb.laneId $sb.lineId : !row.update-set-by-label
     ; to target-desc [ match
      { [ propertyIs '' line-lbl ] : $lane-title }
      { true : ; add $lane-title ; add ' · ' $line-lbl }
     ]
     ; to btn-txt ; add '← Set by ' ; add $target-desc ' ↗'
     ; to btn-ttl ; add 'Set by ' ; add $target-desc ' — click to navigate'
     ; set $btn-txt set-by-btn.textContent
     ; set $btn-ttl set-by-btn.title
     !set-by-btn.setAttribute aria-label $btn-ttl
     !el.setAttribute data-set-by-lane $sb.laneId
     !el.setAttribute data-set-by-line [ match { $sb.lineId : $sb.lineId } { true : '' } ]
     !mount-set-by-el
     ; set false set-by-el.hidden
    ) }
    { true (
     ; set '' set-by-btn.textContent
     ; set '' set-by-btn.title
     ; set true set-by-el.hidden
     !unmount-set-by-el
     [ match
      { $el.removeAttribute (
       !el.removeAttribute data-set-by-lane
       !el.removeAttribute data-set-by-line
      ) }
     ]
    ) }
   ]
   [ match
    { $row.update-classes : !row.update-classes }
   ]
  )

  ; to row.set-set-by (
   ; to { next-sb } $argv
   ; to norm !normalize-set-by $next-sb
   ; set $norm row.set-by
   [ match
    { $row.record : ; set $norm row.record.setBy }
   ]
   !row.update-set-by-label
  )

  !set-by-btn.addEventListener click (
   ; to sb $row.set-by
   [ match
    { [ and { $sb } { $lane-control.navigate-to-lane-line } ] (
     !lane-control.navigate-to-lane-line $sb.laneId $sb.lineId $nb.lane.id
    ) }
   ]
  )

  !row.update-set-by-label
  $set-by-el
 )

 ; to attach-line-draft (
  -- Attaches the rejected unsaved draft status bar (Edit draft / Discard) to a notebook row
  ; to { row el } $argv
  ; to draft-el !document.createElement div
  ; assign $draft-el { className lane-line-draft } { hidden true }
  ; to draft-main !document.createElement div
  ; set lane-line-draft-main draft-main.className
  ; to draft-badge !document.createElement span
  ; set lane-line-draft-badge draft-badge.className
  ; to draft-code !document.createElement code
  ; assign $draft-code { className lane-line-draft-code } { hidden true }
  ; to draft-err !document.createElement span
  ; assign $draft-err { className lane-line-draft-error } { hidden true }
  ; to draft-acts !document.createElement div
  ; set lane-line-draft-actions draft-acts.className
  ; to restore-btn !document.createElement button
  ; assign $restore-btn { type button } { className 'lane-line-draft-btn lane-line-draft-btn--restore' } { textContent 'Edit draft' } { title 'Load rejected draft into line editor to fix and save' } { hidden true }
  ; to discard-btn !document.createElement button
  ; assign $discard-btn { type button } { className 'lane-line-draft-btn lane-line-draft-btn--discard' } { textContent Discard } { title 'Discard rejected unsaved draft' }
  !draft-main.appendChild $draft-badge
  !draft-main.appendChild $draft-code
  !draft-main.appendChild $draft-err
  !draft-acts.appendChild $restore-btn
  !draft-acts.appendChild $discard-btn
  !draft-el.appendChild $draft-main
  !draft-el.appendChild $draft-acts
  ; assign $row { draft null } { draft-active false } { draft-el $draft-el } { draft-badge $draft-badge } { draft-code $draft-code } { draft-err $draft-err } { draft-restore-btn $restore-btn } { draft-discard-btn $discard-btn }

  ; to mount-draft-el (
   [ match
    { [ propertyIs $el draft-el.parentNode ] : null }
    { $row.editor-el : !el.insertBefore $draft-el $row.editor-el }
    { [ and { propertyIs export row.kind } { $row.deploy-bar-el } { [ propertyIs $el row.deploy-bar-el.parentNode ] } ] : !el.insertBefore $draft-el $row.deploy-bar-el }
    { true : !el.appendChild $draft-el }
   ]
  )

  ; to unmount-draft-el (
   [ match
    { $draft-el.parentNode : !draft-el.remove }
   ]
  )

  ; to row.update-draft-ui (
   ; to d $row.draft
   [ match
    { $d (
     ; to is-active [ propertyIs true row.draft-active ]
     [ match
      { $is-active (
       ; set 'Unsaved draft — syntax error (not saved)' draft-badge.textContent
       ; set '' draft-code.textContent
       ; set true draft-code.hidden
       ; set '' draft-err.textContent
       ; set true draft-err.hidden
       ; set true restore-btn.hidden
       ; set 'Discard draft' discard-btn.textContent
       ; set 'Discard unsaved draft and revert to last saved line' discard-btn.title
      ) }
      { true (
       ; set 'Unsaved draft rejected (syntax error)' draft-badge.textContent
       ; to shown-txt [ match
        { [ propertyIs false [ propertyIs undefined d.exprText ] ] : $d.exprText }
        { $d.text : $d.text }
        { true : '' }
       ]
       ; set $shown-txt draft-code.textContent
       ; set $shown-txt draft-code.title
       ; set false draft-code.hidden
       ; to err-txt [ match { $d.error : $d.error } { true : '' } ]
       ; set $err-txt draft-err.textContent
       ; set $err-txt draft-err.title
       ; set [ ternary [ propertyIs '' err-txt ] true false ] draft-err.hidden
       ; set false restore-btn.hidden
       ; set Discard discard-btn.textContent
       ; set 'Discard rejected unsaved draft from localStorage' discard-btn.title
      ) }
     ]
     !el.setAttribute data-draft-rejected 'true'
     !mount-draft-el
     ; set false draft-el.hidden
    ) }
    { true (
     ; set '' draft-badge.textContent
     ; set '' draft-code.textContent
     ; set '' draft-err.textContent
     ; set true draft-code.hidden
     ; set true draft-err.hidden
     ; set true restore-btn.hidden
     ; set true draft-el.hidden
     !unmount-draft-el
     [ match
      { $el.removeAttribute : !el.removeAttribute data-draft-rejected }
     ]
    ) }
   ]
   [ match
    { $row.update-classes : !row.update-classes }
   ]
  )

  ; to row.set-draft (
   ; to { next-draft is-active } $argv
   ; to clean-d [ match { $next-draft : $next-draft } { true : null } ]
   ; to clean-act [ match
    { [ and { $clean-d } { [ propertyIs true is-active ] } ] : true }
    { true : false }
   ]
   ; set $clean-d row.draft
   ; set $clean-act row.draft-active
   !row.update-draft-ui
  )

  !restore-btn.addEventListener click (
   ; to d $row.draft
   [ match
    { $d (
     ; to draft-txt [ match
      { [ propertyIs null d.text ] : '' }
      { [ propertyIs undefined d.text ] : '' }
      { true : $d.text }
     ]
     ; to nb.lines $row.index $draft-txt
     [ match
      { [ propertyIs code row.kind ] (
       !row.sync-input-control $draft-txt true
       [ match
        { $row.editor-el (
         ; set $draft-txt row.editor-el.value
         !scope.auto-size-textarea $row.editor-el
         [ match { $row.editor-el.focus : !row.editor-el.focus } ]
        ) }
       ]
      ) }
      { [ propertyIs export row.kind ] (
       ; to expr-val [ match
        { [ propertyIs false [ propertyIs undefined d.exprText ] ] : $d.exprText }
        { true : $draft-txt }
       ]
       ; set $expr-val row.spec.contentExpr
       ; set $expr-val row.expr-el.value
       [ match { $row.expr-el.focus : !row.expr-el.focus } ]
      ) }
     ]
     !row.set-draft $d true
     !nb.run
    ) }
   ]
  )

  !discard-btn.addEventListener click (
   ; to was-active [ propertyIs true row.draft-active ]
   !clear-row-draft $row
   ; condition { propertyIs true was-active } (
    ; to saved-txt [ match
     { [ propertyIs null row.record.text ] : '' }
     { [ propertyIs undefined row.record.text ] : '' }
     { true : $row.record.text }
    ]
    ; to nb.lines $row.index $saved-txt
    [ match
     { [ propertyIs code row.kind ] (
      !row.sync-input-control $saved-txt true
      [ match
       { $row.editor-el (
        ; set $saved-txt row.editor-el.value
        !scope.auto-size-textarea $row.editor-el
       ) }
      ]
     ) }
     { [ propertyIs export row.kind ] (
      ; to parsed-exp [ match { $parseExportLine : !parseExportLine $saved-txt } { true : null } ]
      [ match
       { $parsed-exp (
        ; set $parsed-exp row.spec
        ; set $parsed-exp.contentExpr row.expr-el.value
        !row.update-label
       ) }
      ]
     ) }
     { [ propertyIs import row.kind ] (
      ; to parsed-imp !parseImportLine $saved-txt
      [ match
       { $parsed-imp (
        ; set $parsed-imp row.spec
        ; set $parsed-imp.alias row.alias-el.value
        !row.update-label
       ) }
      ]
     ) }
    ]
    !nb.run
   )
  )

  !row.update-draft-ui
  $draft-el
 )

 ; to nb.create-import-row (
  -- Creates DOM elements and picker bindings for a cross-lane import line
  ; to { spec record } $argv
  ; to line-rec [ match
   { $record : $record }
   { true : [ object { id !generateLineId $window } { text !formatImportLine $spec } { updatedAt null } ] }
  ]
  ; to el !document.createElement div
  ; set 'lane-line lane-line--import' el.className
  ; to num-el !document.createElement span
  ; set lane-line-num num-el.className

  ; to control-el !document.createElement div
  ; set lane-import-control control-el.className
  ; to alias-el !document.createElement input
  ; assign $alias-el { type text } { className lane-import-alias } { value $spec.alias } { placeholder name } { spellcheck false } { autocomplete off }
  ; to arrow-el !document.createElement span
  ; assign $arrow-el { className lane-import-arrow } { textContent '←' }
  ; to pick-btn !document.createElement button
  ; assign $pick-btn { type button } { className lane-import-pick-btn } { title 'Pick value from another lane' }
  !control-el.appendChild $alias-el
  !control-el.appendChild $arrow-el
  !control-el.appendChild $pick-btn

  ; to preview-el !document.createElement code
  ; set lane-line-preview preview-el.className
  ; to remove-btn !document.createElement button
  ; assign $remove-btn { type button } { className lane-line-remove } { textContent '×' } { title 'Remove line' }

  !el.appendChild $num-el
  !el.appendChild $control-el
  !el.appendChild $preview-el
  !el.appendChild $remove-btn

  ; to row [ object
   { kind import }
   { spec $spec }
   { record $line-rec }
   { el $el }
   { num-el $num-el }
   { control-el $control-el }
   { alias-el $alias-el }
   { pick-btn $pick-btn }
   { preview-el $preview-el }
   { remove-btn $remove-btn }
   { info-btn null }
   { index 0 }
  ]
  !attach-line-info-btn $row $el

  ; to row.update-classes (
   ; to base 'lane-line lane-line--import'
   ; to with-sb [ ternary $row.set-by [ ; add $base ' lane-line--set-by' ] $base ]
   ; to with-dr [ ternary $row.draft [ ; add $with-sb ' lane-line--draft-rejected' ] $with-sb ]
   ; to full [ ternary [ propertyIs true row.is-highlighted ] [ ; add $with-dr ' lane-line--highlighted' ] $with-dr ]
   ; set $full row.el.className
  )
  !attach-line-set-by $row $el
  !attach-line-draft $row $el

  ; to row.update-label (
   -- Updates the picker button label to show the source lane title and optional $path (or whole lane)
   ; to cur $row.spec
   ; to has-target [ match
    { [ propertyIs '' cur.laneId ] : false }
    { true : true }
   ]
   [ match
    { $has-target (
     ; to lane-title [ match
      { $lane-control.get-lane-title : !lane-control.get-lane-title $cur.laneId }
      { true : $cur.laneId }
     ]
     ; to label [ match
      { [ propertyIsGreaterThan 0 cur.path.length ] (
       ; to joined !cur.path.join '.'
       ; add $lane-title ; add ' · $' $joined
      ) }
      { true : ; add $lane-title ' · (lane)' }
     ]
     ; set $label pick-btn.textContent
     ; set $label pick-btn.title
     ; set 'lane-import-pick-btn lane-import-pick-btn--set' pick-btn.className
    ) }
    { true (
     ; set 'Pick from lane…' pick-btn.textContent
     ; set 'Pick lane or value from another lane' pick-btn.title
     ; set lane-import-pick-btn pick-btn.className
    ) }
   ]
  )

  ; to row.apply-spec (
   -- Applies a newly chosen { alias laneId path } import spec, re-runs, and saves if parseable
   ; to { next-spec } $argv
   ; set $next-spec row.spec
   ; set $next-spec.alias alias-el.value
   !row.update-label
   ; to formatted !formatImportLine $next-spec
   !commit-or-draft-row $row $formatted
  )

  ; to row.open-picker (
   -- Opens the Scope browser picker modal to choose a source lane, property, and name
   [ match
    { $lane-control.pick-import (
     ; to pick-opts [ object
      { lane $nb.lane }
      { current-lane-id $nb.lane.id }
      { lane-id $row.spec.laneId }
      { path $row.spec.path }
      { alias $row.spec.alias }
      { on-confirm (
       ; to { chosen } $argv
       !row.apply-spec $chosen
      ) }
     ]
     !lane-control.pick-import $pick-opts
    ) }
   ]
  )

  !alias-el.addEventListener input (
   ; set $alias-el.value row.spec.alias
   ; to formatted !formatImportLine $row.spec
   !commit-or-draft-row $row $formatted
  )
  !alias-el.addEventListener keydown (
   ; to { ev } $argv
   ; condition { propertyIs Enter ev.key } (
    [ match
     { $ev.preventDefault : !ev.preventDefault }
    ]
    ; to next-idx ; add $row.index 1
    !nb.insert-line $next-idx ''
   )
  )
  !pick-btn.addEventListener click $row.open-picker
  !remove-btn.addEventListener click : !nb.remove-line $row.index
  !row.update-label
  $row
 )

 ; to nb.create-export-row (
  -- Creates DOM elements, target picker bindings, and deploy status bar for an Export to Lane line
  ; to { spec record } $argv
  ; to line-rec [ match
   { $record : $record }
   { true : [ object { id !generateLineId $window } { text !formatExportLine $spec } { updatedAt null } ] }
  ]
  ; to el !document.createElement div
  ; set 'lane-line lane-line--export' el.className
  ; to num-el !document.createElement span
  ; set lane-line-num num-el.className

  ; to control-el !document.createElement div
  ; set lane-export-control control-el.className
  ; to expr-el !document.createElement input
  ; assign $expr-el { type text } { className lane-export-expr } { value $spec.contentExpr } { placeholder '; add \'!console log  \' $message' } { spellcheck false } { autocomplete off }
  ; to arrow-el !document.createElement span
  ; assign $arrow-el { className lane-export-arrow } { textContent '→' }
  ; to pick-btn !document.createElement button
  ; assign $pick-btn { type button } { className lane-export-pick-btn } { title 'Pick target lane lines' }
  ; to nav-btn !document.createElement button
  ; assign $nav-btn { type button } { className lane-export-nav-btn } { textContent '↗' } { title 'Navigate to target line' } { hidden true }
  !control-el.appendChild $expr-el
  !control-el.appendChild $arrow-el
  !control-el.appendChild $pick-btn
  !control-el.appendChild $nav-btn

  ; to preview-el !document.createElement code
  ; set lane-line-preview preview-el.className
  ; to remove-btn !document.createElement button
  ; assign $remove-btn { type button } { className lane-line-remove } { textContent '×' } { title 'Remove line' }

  ; to deploy-bar-el !document.createElement div
  ; assign $deploy-bar-el { className lane-export-deploy-bar } { hidden true }
  ; to pills-el !document.createElement div
  ; set lane-export-deploy-pills pills-el.className
  ; to deploy-btn !document.createElement button
  ; assign $deploy-btn { type button } { className lane-export-deploy-btn } { textContent Deploy } { hidden true }
  ; to unlock-btn !document.createElement button
  ; assign $unlock-btn { type button } { className lane-export-unlock-btn } { textContent 'Unlock Package' } { hidden true }
  !deploy-bar-el.appendChild $pills-el
  !deploy-bar-el.appendChild $deploy-btn
  !deploy-bar-el.appendChild $unlock-btn

  !el.appendChild $num-el
  !el.appendChild $control-el
  !el.appendChild $preview-el
  !el.appendChild $remove-btn

  ; to row [ object
   { kind export }
   { spec $spec }
   { record $line-rec }
   { el $el }
   { num-el $num-el }
   { control-el $control-el }
   { expr-el $expr-el }
   { pick-btn $pick-btn }
   { nav-btn $nav-btn }
   { preview-el $preview-el }
   { remove-btn $remove-btn }
   { info-btn null }
   { deploy-bar-el $deploy-bar-el }
   { pills-el $pills-el }
   { deploy-btn $deploy-btn }
   { unlock-btn $unlock-btn }
   { locked-packages {} }
   { pending-unlock false }
   { last-statuses {} }
   { index 0 }
  ]
  !attach-line-info-btn $row $el
  !el.appendChild $deploy-bar-el

  ; to row.update-classes (
   ; to base 'lane-line lane-line--export'
   ; to with-sb [ ternary $row.set-by [ ; add $base ' lane-line--set-by' ] $base ]
   ; to with-dr [ ternary $row.draft [ ; add $with-sb ' lane-line--draft-rejected' ] $with-sb ]
   ; to full [ ternary [ propertyIs true row.is-highlighted ] [ ; add $with-dr ' lane-line--highlighted' ] $with-dr ]
   ; set $full row.el.className
  )
  !attach-line-set-by $row $el
  !attach-line-draft $row $el

  ; to clear-pills (
   [ match
    { $pills-el.replaceChildren : !pills-el.replaceChildren }
    { true (
     ; while { propertyIsGreaterThan 0 pills-el.children.length } (
      ; to prev-len $pills-el.children.length
      ; to cidx ; subtract $prev-len 1
      ; to child [ get pills-el.children $cidx ]
      [ match { $child.remove : !child.remove } ]
      ; condition { propertyIs $prev-len pills-el.children.length } : !pills-el.children.pop
     )
    ) }
   ]
  )

  ; to resolve-line-label (
   ; to { t } $argv
   !resolve-lane-line-label $t.laneId $t.lineId : !row.update-label
  )

  ; to row.update-label (
   -- Updates the target picker button label and navigation button with connected target lane(s) and line number(s)
   ; to targets [ match { $row.spec.targets : $row.spec.targets } { true : {} } ]
   [ match
    { [ propertyIs 0 targets.length ] (
     ; set 'Pick target lines…' pick-btn.textContent
     ; set 'Select target lane lines to overwrite' pick-btn.title
     ; set lane-export-pick-btn pick-btn.className
     ; set true nav-btn.hidden
    ) }
    { true (
     ; to labels {}
     ; each $targets (
      ; to { t } $argv
      ; to lane-title [ match
       { $lane-control.get-lane-title : !lane-control.get-lane-title $t.laneId }
       { true : $t.laneId }
      ]
      ; to line-lbl !resolve-line-label $t
      !labels.push [ ; add $lane-title ; add ' · ' $line-lbl ]
     )
     ; to full-title !labels.join ', '
     ; to first-lbl $labels.0
     ; to btn-txt [ match
      { [ propertyIs 1 labels.length ] : $first-lbl }
      { true (
       ; to extra ; subtract $labels.length 1
       ; add $first-lbl ; add ' (+' ; add $extra ' more)'
      ) }
     ]
     ; set $btn-txt pick-btn.textContent
     ; set $full-title pick-btn.title
     ; set 'lane-export-pick-btn lane-export-pick-btn--set' pick-btn.className
     ; to nav-ttl ; add 'Navigate to ' $first-lbl
     ; set $nav-ttl nav-btn.title
     !nav-btn.setAttribute aria-label $nav-ttl
     ; set false nav-btn.hidden
    ) }
   ]
  )

  ; to row.prompt-unlock (
   -- Prompts user to open or unlock exported-to packages not currently open in this session, then re-runs this lane
   [ match
    { [ and { $lane-control.prompt-unlock-packages-for-export } { [ propertyIsGreaterThan 0 row.locked-packages.length ] } ] (
     !lane-control.prompt-unlock-packages-for-export [ object
      { locked-packages $row.locked-packages }
      { source-lane-id $nb.lane.id }
      { source-lane-title $nb.lane.title }
      { on-unlocked (
       !nb.run null false null [ object { trigger export-unlock } ]
      ) }
     ]
    ) }
   ]
  )

  ; to render-statuses-list (
   ; to { statuses locked-pkgs } $argv
   !clear-pills
   ; set $statuses row.last-statuses
   [ match
    { [ propertyIs 0 statuses.length ] (
     ; set false row.pending-unlock
     ; set {} row.locked-packages
     ; set true deploy-bar-el.hidden
     ; set true deploy-btn.hidden
     ; set true unlock-btn.hidden
    ) }
    { true (
     ; set false deploy-bar-el.hidden
     ; to eff-locked {}
     ; to seen-lpkg ; object
     ; to has-lpkg [ match { $locked-pkgs : [ propertyIsGreaterThan 0 locked-pkgs.length ] } { true : false } ]
     [ match
      { $has-lpkg (
       ; each $locked-pkgs (
        ; to { lp } $argv
        [ match
         { $lp.packageId (
          ; to already [ get seen-lpkg $lp.packageId ]
          ; condition { propertyIs undefined already } (
           ; to seen-lpkg $lp.packageId true
           !eff-locked.push $lp
          )
         ) }
        ]
       )
      ) }
      { true (
       ; each $statuses (
        ; to { st } $argv
        ; condition { propertyIs package-locked st.status } (
         [ match
          { $st.packageId (
           ; to already [ get seen-lpkg $st.packageId ]
           ; condition { propertyIs undefined already } (
            ; to seen-lpkg $st.packageId true
            !eff-locked.push [ object
             { packageId $st.packageId }
             { packageName [ match { $st.packageName : $st.packageName } { true : $st.packageId } ] }
             { hasPassphrase [ propertyIs true st.hasPassphrase ] }
            ]
           )
          ) }
         ]
        )
       )
      ) }
     ]
     ; set $eff-locked row.locked-packages
     ; to has-locked [ propertyIsGreaterThan 0 eff-locked.length ]
     ; set $has-locked row.pending-unlock
     ; to need-n ; object { n 0 }
     ; each $statuses (
      ; to { st } $argv
      ; to pill !document.createElement span
      ; to ds-status [ match { $st.status : $st.status } { true : 'not-deployed' } ]
      ; to raw-lbl [ match { $st.laneTitle : $st.laneTitle } { true : $st.laneId } ]
      ; to lbl [ match
       { [ and { [ propertyIs package-locked ds-status ] } { [ propertyIs 'Locked Lane' raw-lbl ] } ] : $st.laneId }
       { true : $raw-lbl }
      ]
      ; to pkg-name [ match
       { $st.packageName : $st.packageName }
       { $st.packageId : $st.packageId }
       { true : target }
      ]
      ; to pill-info [ match
       { [ propertyIs package-locked ds-status ] (
        ; to lck-sfx [ match
         { [ propertyIs true st.hasPassphrase ] : ; add 'Package "' ; add $pkg-name '" locked' }
         { true : ; add 'Package "' ; add $pkg-name '" not open' }
        ]
        ; object { suffix $lck-sfx } { cls 'lane-export-status-pill lane-export-status-pill--locked lane-export-status-pill--nav' }
       ) }
       { [ propertyIs staged-pending-unlock ds-status ] : [ object { suffix 'Staged (unlock packages first)' } { cls 'lane-export-status-pill lane-export-status-pill--warn' } ] }
       { [ propertyIs up-to-date ds-status ] : [ object { suffix 'Up to date' } { cls 'lane-export-status-pill lane-export-status-pill--ok lane-export-status-pill--nav' } ] }
       { [ propertyIs needs-deploy ds-status ] (
        ; set [ ; add $need-n.n 1 ] need-n.n
        ; object { suffix 'Changes pending' } { cls 'lane-export-status-pill lane-export-status-pill--warn lane-export-status-pill--nav' }
       ) }
       { [ propertyIs unverified-baseline ds-status ] (
        ; set [ ; add $need-n.n 1 ] need-n.n
        ; object { suffix 'Baseline uncached' } { cls 'lane-export-status-pill lane-export-status-pill--warn lane-export-status-pill--nav' }
       ) }
       { true : [ object { suffix 'Not deployed' } { cls 'lane-export-status-pill lane-export-status-pill--nav' } ] }
      ]
      ; to target-line ; object { id '' }
      ; each $row.spec.targets (
       ; to { t } $argv
       ; condition { propertyIs '' target-line.id } (
        ; condition { propertyIs $st.laneId t.laneId } : ; set $t.lineId target-line.id
       )
      )
      ; to pill-line-lbl [ match
       { [ propertyIs package-locked ds-status ] : '' }
       { $target-line.id : !resolve-lane-line-label $st.laneId $target-line.id null }
       { true : '' }
      ]
      ; to pill-ttl [ match
       { [ propertyIs package-locked ds-status ] : [ match
        { [ propertyIs true st.hasPassphrase ] : ; add 'Click to unlock package "' ; add $pkg-name '"' }
        { true : ; add 'Click to open package "' ; add $pkg-name '"' }
       ] }
       { [ propertyIs '' pill-line-lbl ] : ; add 'Navigate to ' $lbl }
       { true : ; add 'Navigate to ' ; add $lbl ; add ' · ' $pill-line-lbl }
      ]
      ; assign $pill { className $pill-info.cls } { textContent [ ; add $lbl ; add ': ' $pill-info.suffix ] } { title $pill-ttl }
      !pill.addEventListener click (
       [ match
        { [ propertyIs package-locked ds-status ] : !row.prompt-unlock }
        { $lane-control.navigate-to-lane-line (
         !lane-control.navigate-to-lane-line $st.laneId $target-line.id $nb.lane.id
        ) }
       ]
      )
      !pills-el.appendChild $pill
     )
     [ match
      { $has-locked (
       ; set true deploy-btn.hidden
       ; set false unlock-btn.hidden
       ; to any-pass ; object { val false }
       ; each $eff-locked (
        ; to { lp } $argv
        ; condition { propertyIs true lp.hasPassphrase } : ; set true any-pass.val
       )
       ; to u-verb [ ternary $any-pass.val Unlock Open ]
       ; to u-lbl [ match
        { [ propertyIs 1 eff-locked.length ] : ; add $u-verb ' Package' }
        { true : ; add $u-verb ; add ' Packages (' ; add $eff-locked.length ')' }
       ]
       ; set $u-lbl unlock-btn.textContent
      ) }
      { true (
       ; set true unlock-btn.hidden
       [ match
        { [ propertyIsGreaterThan 0 need-n.n ] (
         ; set false deploy-btn.hidden
         ; to btn-lbl [ match
          { [ propertyIs 1 need-n.n ] : Deploy }
          { true : [ ; add 'Deploy (' ; add $need-n.n ')' ] }
         ]
         ; set $btn-lbl deploy-btn.textContent
        ) }
        { true : ; set true deploy-btn.hidden }
       ]
      ) }
     ]
    ) }
   ]
  )

  ; to row.render-deploy-status (
   -- Renders per-target-lane deploy/lock status pills and Unlock or Deploy button after Source execution or package/deploy updates
   ; to { eval-result } $argv
   [ match
    { $eval-result.laneStatuses : !render-statuses-list $eval-result.laneStatuses $eval-result.lockedPackages }
    { true (
     ; to targets [ match { $row.spec.targets : $row.spec.targets } { true : {} } ]
     ; to access-check [ match
      { [ and { [ propertyIsGreaterThan 0 targets.length ] } { $checkExportTargetsAccess } ] (
       !checkExportTargetsAccess $data $lane-control.open-package-ids $targets $nb.lane.id
      ) }
      { true : null }
     ]
     [ match
      { [ propertyIs true access-check.requiresPackageUnlock ] (
       ; to seen ; object
       ; to list {}
       ; each $targets (
        ; to { t } $argv
        ; to already [ get seen $t.laneId ]
        [ match
         { $already : null }
         { true (
          ; to seen $t.laneId true
          ; to denied [ get access-check.deniedByLaneId $t.laneId ]
          ; to raw-title [ match
           { $lane-control.get-lane-title : !lane-control.get-lane-title $t.laneId }
           { true : $t.laneId }
          ]
          ; to lane-title [ match
           { [ and { $denied } { [ propertyIs 'Locked Lane' raw-title ] } ] : $t.laneId }
           { true : $raw-title }
          ]
          [ match
           { $denied (
            !list.push [ object
             { laneId $t.laneId }
             { laneTitle $lane-title }
             { deployed false }
             { hasChanges false }
             { status 'package-locked' }
             { packageId $denied.packageId }
             { packageName $denied.packageName }
             { hasPassphrase [ propertyIs true denied.hasPassphrase ] }
             { deployStatus null }
            ]
           ) }
           { true (
            !list.push [ object
             { laneId $t.laneId }
             { laneTitle $lane-title }
             { deployed false }
             { hasChanges false }
             { status 'staged-pending-unlock' }
             { deployStatus null }
            ]
           ) }
          ]
         ) }
        ]
       )
       !render-statuses-list $list $access-check.lockedPackages
      ) }
      { true (
       ; to seen ; object
       ; to list {}
       ; each $targets (
        ; to { t } $argv
        ; to already [ get seen $t.laneId ]
        [ match
         { $already : null }
         { true (
          ; to seen $t.laneId true
          ; to lane-title [ match
           { $lane-control.get-lane-title : !lane-control.get-lane-title $t.laneId }
           { true : $t.laneId }
          ]
          ; to ds ; try (
           [ match
            { $getLaneDeployStatus : !getLaneDeployStatus $data $data $t.laneId }
            { true : null }
           ]
          ) : null
          !list.push [ object
           { laneId $t.laneId }
           { laneTitle $lane-title }
           { deployed [ match { $ds.deployed : true } { true : false } ] }
           { hasChanges [ match { $ds.hasChanges : true } { true : false } ] }
           { status [ match { $ds.status : $ds.status } { true : 'not-deployed' } ] }
           { deployStatus $ds }
          ]
         ) }
        ]
       )
       !render-statuses-list $list {}
      ) }
     ]
    ) }
   ]
  )

  ; to row.refresh-deploy-status (
   !row.render-deploy-status null
  )

  ; to row.apply-spec (
   -- Applies newly selected targets and content expression, clears any removed target set-by links, re-runs, and saves
   ; to { next-spec } $argv
   ; to prev-targets [ match { $row.spec.targets : $row.spec.targets } { true : {} } ]
   ; to next-targets [ match { $next-spec.targets : $next-spec.targets } { true : {} } ]
   ; set $next-spec row.spec
   ; set $next-spec.contentExpr expr-el.value
   [ match
    { $next-spec.contentExpr : null }
    { true : ; set '' next-spec.contentExpr }
   ]
   ; each $prev-targets (
    ; to { old-t } $argv
    ; to still-present ; object { hit false }
    ; each $next-targets (
     ; to { new-t } $argv
     ; condition { and { propertyIs $old-t.laneId new-t.laneId } { propertyIs $old-t.lineId new-t.lineId } } : ; set true still-present.hit
    )
    ; condition { propertyIs false still-present.hit } (
     [ match
      { $lane-control.clear-lane-line-set-by (
       !lane-control.clear-lane-line-set-by $old-t.laneId $old-t.lineId $nb.lane.id $row.record.id
      ) }
     ]
    )
   )
   !row.update-label
   ; to formatted !formatExportLine $next-spec
   !commit-or-draft-row $row $formatted $next-spec.contentExpr
  )

  ; to row.open-picker (
   -- Opens the Export to Lane target line picker modal
   [ match
    { $lane-control.pick-export (
     ; to pick-opts [ object
      { lane $nb.lane }
      { current-lane-id $nb.lane.id }
      { targets $row.spec.targets }
      { content-expr $expr-el.value }
      { on-confirm (
       ; to { chosen } $argv
       ; set [ match { $chosen.contentExpr : $chosen.contentExpr } { true : '' } ] expr-el.value
       !row.apply-spec $chosen
      ) }
     ]
     !lane-control.pick-export $pick-opts
    ) }
   ]
  )

  !expr-el.addEventListener input (
   ; set $expr-el.value row.spec.contentExpr
   ; to formatted !formatExportLine $row.spec
   !commit-or-draft-row $row $formatted $expr-el.value
  )
  !expr-el.addEventListener keydown (
   ; to { ev } $argv
   ; condition { propertyIs Enter ev.key } (
    [ match { $ev.preventDefault : !ev.preventDefault } ]
    ; to next-idx ; add $row.index 1
    !nb.insert-line $next-idx ''
   )
  )
  !pick-btn.addEventListener click $row.open-picker
  !nav-btn.addEventListener click (
   ; to targets [ match { $row.spec.targets : $row.spec.targets } { true : {} } ]
   ; to first-t $targets.0
   [ match
    { [ and { $first-t } { $lane-control.navigate-to-lane-line } ] (
     !lane-control.navigate-to-lane-line $first-t.laneId $first-t.lineId $nb.lane.id
    ) }
   ]
  )
  !deploy-btn.addEventListener click (
   [ match
    { $lane-control.open-export-deploy (
     !lane-control.open-export-deploy [ object
      { lane $nb.lane }
      { source-lane-id $nb.lane.id }
      { targets $row.spec.targets }
      { on-deployed (
       !row.refresh-deploy-status
      ) }
     ]
    ) }
   ]
  )
  !unlock-btn.addEventListener click $row.prompt-unlock
  !remove-btn.addEventListener click : !nb.remove-line $row.index
  !row.update-label
  $row
 )

 ; to nb.close-line-editor (
  -- Exits Edit individual line mode for the currently active row, re-enabling its line input
  ; to { restore-focus } $argv
  ; to active $nb.editing-row
  [ match
   { $active (
    ; set null nb.editing-row
    ; set false active.is-editing
    ; set false active.input-el.disabled
    [ match
     { $active.editor-el (
      !active.editor-el.remove
      ; set null active.editor-el
     ) }
    ]
    !active.update-classes
    !active.auto-size
    [ match
     { $restore-focus (
      [ match
       { $active.input-el.focus : !active.input-el.focus }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to nb.open-line-editor (
  -- Toggles Edit individual line mode for the given code row
  ; to { row } $argv
  [ match
   { [ propertyIs $row nb.editing-row ] : !nb.close-line-editor true }
   { true (
    !nb.close-line-editor false
    ; set $row nb.editing-row
    ; set true row.is-editing
    ; set true row.input-el.disabled
    ; to current-text [ get nb.lines $row.index ]
    ; to text [ match
     { [ propertyIs null current-text ] : '' }
     { [ propertyIs undefined current-text ] : '' }
     { true : $current-text }
    ]
    ; to editor-el !document.createElement textarea
    ; assign $editor-el { className lane-line-editor } { value $text } { placeholder 'FieldScript...' } { spellcheck false } { autocomplete off }
    ; set $editor-el row.editor-el
    !row.el.appendChild $editor-el
    !row.update-classes
    !scope.auto-size-textarea $editor-el
    !editor-el.addEventListener input (
     ; to next-val $editor-el.value
     !row.sync-input-control $next-val false
     !scope.auto-size-textarea $editor-el
     !commit-or-draft-row $row $next-val
    )
    !editor-el.addEventListener keydown (
     ; to { ev } $argv
     ; condition { propertyIs Escape ev.key } (
      [ match
       { $ev.preventDefault : !ev.preventDefault }
      ]
      !nb.close-line-editor true
     )
    )
    [ match
     { $editor-el.focus : !editor-el.focus }
    ]
    [ match
     { $window.requestAnimationFrame (
      !window.requestAnimationFrame : !scope.auto-size-textarea $editor-el
     ) }
    ]
    $editor-el
   ) }
  ]
 )

 ; to nb.create-row (
  -- Creates DOM elements and event bindings for a single script line or import line
  ; to { text record } $argv
  ; to line-rec [ match
   { $record : $record }
   { true : [ object { id !generateLineId $window } { text $text } { updatedAt null } ] }
  ]
  ; to import-spec !parseImportLine $text
  ; to export-spec [ match
   { $parseExportLine : !parseExportLine $text }
   { true : null }
  ]
  [ match
   { $import-spec : !nb.create-import-row $import-spec $line-rec }
   { $export-spec : !nb.create-export-row $export-spec $line-rec }
   { true (
    ; to initial-multiline !scope.has-newline $text
    ; to el !document.createElement div
    ; to num-el !document.createElement button
    ; assign $num-el { type button }
    ; to preview-el !document.createElement code
    ; set lane-line-preview preview-el.className
    ; to remove-btn !document.createElement button
    ; assign $remove-btn { type button } { className lane-line-remove } { textContent '×' } { title 'Remove line' }
    ; to row [ object
     { kind code }
     { record $line-rec }
     { el $el }
     { num-el $num-el }
     { input-el null }
     { editor-el null }
     { preview-el $preview-el }
     { remove-btn $remove-btn }
     { info-btn null }
     { is-multiline $initial-multiline }
     { is-editing false }
     { index 0 }
    ]

    ; to row.update-classes (
     -- Syncs row and line-number CSS classes for multiline, edit-individual-line, set-by, draft-rejected, and highlighted states
     ; to base-cls [ match
      { [ and { propertyIs true row.is-multiline } { propertyIs true row.is-editing } ] : 'lane-line lane-line--multiline lane-line--editing' }
      { [ propertyIs true row.is-multiline ] : 'lane-line lane-line--multiline' }
      { [ propertyIs true row.is-editing ] : 'lane-line lane-line--editing' }
      { true : lane-line }
     ]
     ; to with-sb [ ternary $row.set-by [ ; add $base-cls ' lane-line--set-by' ] $base-cls ]
     ; to with-dr [ ternary $row.draft [ ; add $with-sb ' lane-line--draft-rejected' ] $with-sb ]
     ; to line-cls [ ternary [ propertyIs true row.is-highlighted ] [ ; add $with-dr ' lane-line--highlighted' ] $with-dr ]
     ; set $line-cls row.el.className
     ; to num-cls [ match
      { [ propertyIs true row.is-editing ] : 'lane-line-num lane-line-num--editable lane-line-num--active' }
      { true : 'lane-line-num lane-line-num--editable' }
     ]
     ; set $num-cls row.num-el.className
     ; to num-title [ match
      { [ propertyIs true row.is-editing ] : 'Exit individual line editor' }
      { true : 'Edit individual line' }
     ]
     ; set $num-title row.num-el.title
    )

    ; to row.auto-size (
     -- Auto-sizes multiline row input and any open individual line editor textarea
     ; condition { propertyIs true row.is-multiline } : !scope.auto-size-textarea $row.input-el
     [ match
      { $row.editor-el : !scope.auto-size-textarea $row.editor-el }
     ]
    )

    ; to row.build-input-el (
     -- Creates either a single-line <input> or multiline <textarea> for this code row
     ; to { value multiline } $argv
     ; to ctrl [ match
      { $multiline (
       ; to ta !document.createElement textarea
       ; assign $ta { className 'lane-line-input lane-line-input--multiline' } { value $value } { placeholder 'FieldScript...' } { spellcheck false } { autocomplete off }
       !scope.auto-size-textarea $ta
       $ta
      ) }
      { true (
       ; to inp !document.createElement input
       ; assign $inp { type text } { className lane-line-input } { value $value } { placeholder 'FieldScript...' } { spellcheck false } { autocomplete off }
       $inp
      ) }
     ]
     ; set $row.is-editing ctrl.disabled
     !ctrl.addEventListener input (
      ; to next-val $ctrl.value
      ; to still-multi !scope.has-newline $next-val
      [ match
       { [ propertyIs $row.is-multiline still-multi ] (
        ; condition { propertyIs true row.is-multiline } : !scope.auto-size-textarea $ctrl
       ) }
       { true : !row.sync-input-control $next-val true }
      ]
      !commit-or-draft-row $row $next-val
     )
     [ match
      { $multiline : null }
      { true (
       !ctrl.addEventListener keydown (
        ; to { ev } $argv
        ; condition { propertyIs Enter ev.key } (
         !ev.preventDefault
         ; to next-idx ; add $row.index 1
         !nb.insert-line $next-idx ''
        )
       )
       !ctrl.addEventListener paste (
        ; to { ev } $argv
        ; to clip [ match
         { $ev.clipboardData : !ev.clipboardData.getData text/plain }
         { true : '' }
        ]
        ; to no-crlf !clip.replaceAll '\r\n' '\n'
        ; to normalized !no-crlf.replaceAll '\r' '\n'
        ; to parts !normalized.split '\n'
        ; condition { propertyIsGreaterThan 1 parts.length } (
         ; to last-idx ; subtract $parts.length 1
         ; to last-item [ get parts $last-idx ]
         ; condition { propertyIs '' last-item } : !parts.pop
        )
        ; condition { propertyIsGreaterThan 1 parts.length } (
         [ match
          { $ev.preventDefault : !ev.preventDefault }
         ]
         !nb.paste-lines $row $parts
        )
       )
      ) }
     ]
     $ctrl
    )

    ; to row.sync-input-control (
     -- Syncs row input value and swaps between <input> and <textarea> when newline presence changes
     ; to { next-val restore-focus } $argv
     ; to needs-multiline !scope.has-newline $next-val
     [ match
      { [ propertyIs $row.is-multiline needs-multiline ] (
       ; set $next-val row.input-el.value
       ; condition { propertyIs true row.is-multiline } : !scope.auto-size-textarea $row.input-el
      ) }
      { true (
       ; to old-input $row.input-el
       ; to sel-start $old-input.selectionStart
       ; to sel-end $old-input.selectionEnd
       ; set $needs-multiline row.is-multiline
       ; to next-input !row.build-input-el $next-val $needs-multiline
       ; set $next-input row.input-el
       !row.el.insertBefore $next-input $row.preview-el
       !old-input.remove
       !row.update-classes
       ; condition { propertyIs true needs-multiline } : !scope.auto-size-textarea $next-input
       [ match
        { $restore-focus (
         [ match
          { $next-input.focus : !next-input.focus }
         ]
         [ match
          { [ propertyIs null sel-start ] : null }
          { [ propertyIs undefined sel-start ] : null }
          { $next-input.setSelectionRange (
           ; to end-pos [ match
            { [ propertyIs null sel-end ] : $sel-start }
            { [ propertyIs undefined sel-end ] : $sel-start }
            { true : $sel-end }
           ]
           !next-input.setSelectionRange $sel-start $end-pos
          ) }
         ]
        ) }
       ]
      ) }
     ]
    )

    ; to input-el !row.build-input-el $text $initial-multiline
    ; set $input-el row.input-el
    !el.appendChild $num-el
    !el.appendChild $input-el
    !el.appendChild $preview-el
    !el.appendChild $remove-btn
    !attach-line-info-btn $row $el
    !attach-line-set-by $row $el
    !attach-line-draft $row $el
    !row.update-classes
    !num-el.addEventListener click : !nb.open-line-editor $row
    !remove-btn.addEventListener click : !nb.remove-line $row.index
    $row
   ) }
  ]
 )

 ; to nb.insert-row (
  -- Inserts a line into state and DOM at the given index without running or saving
  ; to { index text record } $argv
  ; to initial [ match
   { [ propertyIs undefined text ] : '' }
   { true : $text }
  ]
  ; to line-rec [ match
   { $record : $record }
   { true : [ object { id !generateLineId $window } { text $initial } { updatedAt null } ] }
  ]
  ; to row !nb.create-row $initial $line-rec
  !nb.lines.splice $index 0 $initial
  !nb.line-records.splice $index 0 $line-rec
  !nb.rows.splice $index 0 $row
  ; to next-idx ; add $index 1
  ; to next-row [ get nb.rows $next-idx ]
  [ match
   { $next-row : !lines-el.insertBefore $row.el $next-row.el }
   { true : !lines-el.appendChild $row.el }
  ]
  [ match
   { $row.auto-size : !row.auto-size }
  ]
  $row
 )

 ; to nb.paste-lines (
  -- Splits multi-line pasted text across the current row and inserts additional rows after it
  ; to { row parts } $argv
  ; to input-el $row.input-el
  ; to existing $input-el.value
  ; to raw-start $input-el.selectionStart
  ; to start [ match
   { [ propertyIs null raw-start ] : $existing.length }
   { [ propertyIs undefined raw-start ] : $existing.length }
   { true : $raw-start }
  ]
  ; to raw-end $input-el.selectionEnd
  ; to end [ match
   { [ propertyIs null raw-end ] : $start }
   { [ propertyIs undefined raw-end ] : $start }
   { true : $raw-end }
  ]
  ; to before !existing.slice 0 $start
  ; to after !existing.slice $end
  ; to { first ...rest } $parts
  ; to first-line ; add $before $first
  ; set $first-line input-el.value
  ; to nb.lines $row.index $first-line
  ; to dirty-recs {}
  ; to first-check !validate-line $first-line $row.index
  ; to pending-drafts {}
  [ match
   { $first-check.ok (
    ; set $first-line row.record.text
    !clear-row-draft $row
    !dirty-recs.push $row.record
   ) }
   { true (
    !pending-drafts.push [ object { row $row } { text $first-line } { error $first-check.error } ]
   ) }
  ]
  ; to last-rest-idx ; subtract $rest.length 1
  ; to last-pasted [ get rest $last-rest-idx ]
  ; to caret-pos $last-pasted.length
  ; to last-line ; add $last-pasted $after
  ; to rest $last-rest-idx $last-line
  ; to base-idx ; add $row.index 1
  ; to last-row ; each $rest (
   ; to { line-text offset } $argv
   ; to target-idx ; add $base-idx $offset
   ; to paste-check !validate-line $line-text $target-idx
   [ match
    { $paste-check.ok (
     ; to inserted !nb.insert-row $target-idx $line-text
     !dirty-recs.push $inserted.record
     $inserted
    ) }
    { true (
     ; to safe-rec [ object { id !generateLineId $window } { text '' } { updatedAt null } ]
     ; to inserted !nb.insert-row $target-idx $line-text $safe-rec
     !dirty-recs.push $safe-rec
     !pending-drafts.push [ object { row $inserted } { text $line-text } { error $paste-check.error } ]
     $inserted
    ) }
   ]
  )
  !nb.renumber
  ; each $pending-drafts (
   ; to { pd } $argv
   ; to d-rec !save-row-draft $pd.row $pd.text $pd.error
   [ match
    { $pd.row.set-draft : !pd.row.set-draft $d-rec true }
   ]
  )
  [ match
   { $last-row.input-el.focus : !last-row.input-el.focus }
  ]
  [ match
   { $last-row.input-el.setSelectionRange : !last-row.input-el.setSelectionRange $caret-pos $caret-pos }
  ]
  !nb.run
  !persist-structural $dirty-recs {}
  $last-row
 )

 ; to nb.insert-line (
  -- Inserts a line at the given index, focuses it, re-runs, and persists if parseable (or stores a rejected draft)
  ; to { index text } $argv
  ; to initial [ match
   { [ propertyIs undefined text ] : '' }
   { true : $text }
  ]
  ; to ins-check !validate-line $initial $index
  ; to row [ match
   { $ins-check.ok : !nb.insert-row $index $initial }
   { true (
    ; to safe-rec [ object { id !generateLineId $window } { text '' } { updatedAt null } ]
    !nb.insert-row $index $initial $safe-rec
   ) }
  ]
  !nb.renumber
  [ match
   { [ propertyIs false ins-check.ok ] (
    ; to d-rec !save-row-draft $row $initial $ins-check.error
    [ match
     { $row.set-draft : !row.set-draft $d-rec true }
    ]
   ) }
  ]
  [ match
   { $row.input-el.focus : !row.input-el.focus }
  ]
  !nb.run
  !persist-structural { $row.record } {}
  $row
 )

 ; to nb.add-line (
  -- Appends a line at the bottom of the lane notebook
  ; to { text } $argv
  !nb.insert-line $nb.lines.length $text
 )

 ; to nb.insert-import (
  -- Inserts an import line at the given index, renumbers, runs, and persists
  ; to { index spec } $argv
  ; to line-text !formatImportLine $spec
  ; to row !nb.insert-row $index $line-text
  !nb.renumber
  !nb.run
  !persist-structural { $row.record } {}
  $row
 )

 ; to nb.add-import (
  -- Appends a new import line and opens the lane value picker
  ; to empty-spec ; object { alias '' } { laneId '' } { path {} }
  ; to row !nb.insert-import $nb.lines.length $empty-spec
  !row.open-picker
  $row
 )

 ; to nb.insert-export (
  -- Inserts an export line at the given index, renumbers, runs, and persists
  ; to { index spec } $argv
  ; to line-text !formatExportLine $spec
  ; to row !nb.insert-row $index $line-text
  !nb.renumber
  !nb.run
  !persist-structural { $row.record } {}
  $row
 )

 ; to nb.add-export (
  -- Appends a new Export to Lane line and opens the target line picker
  ; to empty-spec ; object { targets {} } { contentExpr '' }
  ; to row !nb.insert-export $nb.lines.length $empty-spec
  !row.open-picker
  $row
 )

 ; to nb.apply-external-rejected-draft (
  -- Displays a rejected draft notice on an open target row without modifying its active or saved FieldScript
  ; to { line-id draft } $argv
  ; to found ; object { row null }
  ; each $nb.rows (
   ; to { r } $argv
   ; condition { propertyIs $line-id r.record.id } : ; set $r found.row
  )
  ; to target-row $found.row
  [ match
   { [ and { $target-row } { $target-row.set-draft } ] : !target-row.set-draft $draft false }
  ]
  $target-row
 )

 ; to nb.apply-external-line-update (
  -- Applies a line text update written by another lane to an open row without re-writing KV, then re-runs Source if active
  ; to { line-id next-text updated-at visited set-by } $argv
  ; to found ; object { row null }
  ; each $nb.rows (
   ; to { r } $argv
   ; condition { propertyIs $line-id r.record.id } : ; set $r found.row
  )
  ; to target-row $found.row
  [ match
   { $target-row (
    ; to nb.lines $target-row.index $next-text
    ; set $next-text target-row.record.text
    ; set $updated-at target-row.record.updatedAt
    !clear-row-draft $target-row
    [ match
     { [ and { $set-by } { $target-row.set-set-by } ] : !target-row.set-set-by $set-by }
    ]
    [ match
     { [ propertyIs code target-row.kind ] (
      !target-row.sync-input-control $next-text false
      [ match
       { $target-row.editor-el (
        ; set $next-text target-row.editor-el.value
        !scope.auto-size-textarea $target-row.editor-el
       ) }
      ]
     ) }
     { [ propertyIs import target-row.kind ] (
      ; to parsed-imp !parseImportLine $next-text
      [ match
       { $parsed-imp (
        ; set $parsed-imp target-row.spec
        ; set $parsed-imp.alias target-row.alias-el.value
        !target-row.update-label
       ) }
      ]
     ) }
     { [ propertyIs export target-row.kind ] (
      ; to parsed-exp [ match { $parseExportLine : !parseExportLine $next-text } { true : null } ]
      [ match
       { $parsed-exp (
        ; set $parsed-exp target-row.spec
        ; set $parsed-exp.contentExpr target-row.expr-el.value
        !target-row.update-label
       ) }
      ]
     ) }
    ]
    [ match
     { [ propertyIs story nb.active-tab ] : null }
     { [ propertyIs input nb.active-tab ] : null }
     { [ propertyIs data nb.active-tab ] : null }
     { true : !nb.run $visited false null [ object { trigger export } ] }
    ]
   ) }
  ]
  $target-row
 )

 ; to nb.set-line-quiet (
  -- Updates a line by exact line ID or trimmed prefix in-place and persists to KV without re-running Source (preserving active View DOM)
  ; to { target next-text insert-if-missing } $argv
  ; to clean-target [ match { $target.trim : !target.trim } { $target : ; add '' $target } { true : '' } ]
  ; to text-str [ match
   { [ propertyIs null next-text ] : '' }
   { [ propertyIs undefined next-text ] : '' }
   { true : ; add '' $next-text }
  ]
  ; to found ; object { row null }
  ; each $nb.rows (
   ; to { r } $argv
   ; condition { propertyIs null found.row } (
    ; to is-id [ propertyIs $clean-target r.record.id ]
    ; to r-txt [ match { $r.record.text.trim : !r.record.text.trim } { true : '' } ]
    ; to is-pfx [ match
     { [ propertyIs '' clean-target ] : false }
     { [ !r-txt.startsWith $clean-target ] : true }
     { true : false }
    ]
    ; to is-hit [ match { $is-id : true } { $is-pfx : true } { true : false } ]
    ; condition { propertyIs true is-hit } : ; set $r found.row
   )
  )
  [ match
   { $found.row (
    ; to r $found.row
    ; to q-check !validate-line $text-str $r.index
    [ match
     { $q-check.ok (
      ; to nb.lines $r.index $text-str
      ; set $text-str r.record.text
      !clear-row-draft $r
      [ match
       { [ propertyIs code r.kind ] (
        !r.sync-input-control $text-str false
        [ match
         { $r.editor-el (
          ; set $text-str r.editor-el.value
          !scope.auto-size-textarea $r.editor-el
         ) }
        ]
       ) }
      ]
      !nb.save-line $r
      ; object { ok true } { lineId $r.record.id } { index $r.index } { inserted false }
     ) }
     { true (
      ; to d-rec !save-row-draft $r $text-str $q-check.error
      [ match
       { $r.set-draft : !r.set-draft $d-rec false }
      ]
      ; object { ok false } { syntaxError true } { lineId $r.record.id } { index $r.index } { error $q-check.error }
     ) }
    ]
   ) }
   { $insert-if-missing (
    ; to q-ins-check !validate-line $text-str $nb.lines.length
    [ match
     { $q-ins-check.ok (
      ; to inserted !nb.insert-row $nb.lines.length $text-str
      !nb.renumber
      !persist-structural { $inserted.record } {}
      ; object { ok true } { lineId $inserted.record.id } { index $inserted.index } { inserted true }
     ) }
     { true : ; object { ok false } { syntaxError true } { error $q-ins-check.error } }
    ]
   ) }
   { true : ; object { ok false } { error 'Target line not found' } }
  ]
 )

 ; to nb.remove-line (
  -- Removes the line at the given index, clears any exported set-by links and rejected drafts, renumbers, re-runs, and persists
  ; to { index } $argv
  ; to row [ get nb.rows $index ]
  [ match
   { $row (
    ; condition { propertyIs $row nb.editing-row } : !nb.close-line-editor false
    !clear-row-draft $row
    ; to removed-rec $row.record
    ; to was-export [ propertyIs export row.kind ]
    ; to exp-targets [ match { $row.spec.targets : $row.spec.targets } { true : {} } ]
    !row.el.remove
    !nb.lines.splice $index 1
    !nb.line-records.splice $index 1
    !nb.rows.splice $index 1
    ; condition { propertyIs true was-export } (
     ; each $exp-targets (
      ; to { old-t } $argv
      [ match
       { $lane-control.clear-lane-line-set-by (
        !lane-control.clear-lane-line-set-by $old-t.laneId $old-t.lineId $nb.lane.id $removed-rec.id
       ) }
      ]
     )
    )
    !nb.renumber
    !nb.run
    ; to removed-ids [ match { $removed-rec.id : { $removed-rec.id } } { true : {} } ]
    !persist-structural {} $removed-ids
   ) }
  ]
 )

 ; to restore-stored-drafts (
  -- Attaches any stored rejected drafts from localStorage onto loaded rows without overwriting saved FieldScript
  ; to { was-init } $argv
  ; to drafts-map [ match
   { $loadLaneSourceDrafts : !loadLaneSourceDrafts $data $window $nb.lane.id }
   { true : ; object }
  ]
  ; to drafts-list [ match
   { $listLaneSourceDrafts : !listLaneSourceDrafts $data $window $nb.lane.id }
   { $window.Object.values : !window.Object.values $drafts-map }
   { true : {} }
  ]
  ; condition { propertyIsGreaterThan 0 drafts-list.length } (
   ; each $nb.rows (
    ; to { r idx } $argv
    ; to direct [ get drafts-map $r.record.id ]
    ; to matched-draft [ match
     { $direct : $direct }
     { [ and { [ propertyIs false was-init ] } { [ propertyIs 1 nb.rows.length ] } { [ propertyIs 0 idx ] } { [ propertyIs '' r.record.text ] } ] (
      ; to by-idx ; object { item null }
      ; each $drafts-list (
       ; to { cand } $argv
       ; condition { and { [ propertyIs null by-idx.item ] } { [ propertyIs 0 cand.lineIndex ] } } : ; set $cand by-idx.item
      )
      [ match
       { $by-idx.item (
        ; set $by-idx.item.lineId r.record.id
        $by-idx.item
       ) }
       { true : null }
      ]
     ) }
     { true : null }
    ]
    [ match
     { $matched-draft (
      ; to d-check !validate-line $matched-draft.text $idx
      [ match
       { $d-check.ok : !clear-row-draft $r }
       { $r.set-draft : !r.set-draft $matched-draft false }
      ]
     ) }
    ]
   )
  )
 )

 ; to nb.sync-records (
  -- Replaces notebook lines and records in-place, persists them without clobbering existing timestamps, and re-runs Source if active
  ; to { next-records } $argv
  !nb.close-line-editor false
  ; each $nb.rows (
   ; to { row } $argv
   !row.el.remove
  )
  ; set 0 nb.lines.length
  ; set 0 nb.line-records.length
  ; set 0 nb.rows.length
  ; each $next-records (
   ; to { rec idx } $argv
   ; to raw-txt [ match { [ propertyIs null rec.text ] : '' } { [ propertyIs undefined rec.text ] : '' } { true : $rec.text } ]
   ; to sync-check !validate-line $raw-txt $idx
   ; to safe-rec [ match
    { $sync-check.ok : $rec }
    { true : [ object { id $rec.id } { text '' } { updatedAt $rec.updatedAt } { setBy $rec.setBy } ] }
   ]
   ; to row !nb.create-row $safe-rec.text $safe-rec
   !nb.lines.push $safe-rec.text
   !nb.line-records.push $safe-rec
   !nb.rows.push $row
   !lines-el.appendChild $row.el
   [ match
    { [ propertyIs false sync-check.ok ] (
     ; to d-rec !save-row-draft $row $raw-txt $sync-check.error
     [ match
      { $row.set-draft : !row.set-draft $d-rec false }
     ]
    ) }
   ]
  )
  !nb.renumber
  !restore-stored-drafts true
  ; set true nb.script-initialized
  !saveLaneScript $data $nb.lane.data $nb.lane.id $nb.line-records $window null
  [ match
   { [ propertyIs story nb.active-tab ] : null }
   { [ propertyIs input nb.active-tab ] : null }
   { [ propertyIs data nb.active-tab ] : null }
   { true : !nb.run }
  ]
  $nb.line-records
 )

 !add-btn.addEventListener click (
  ; condition { propertyIs false nb.is-loading-script } : !nb.insert-line $nb.lines.length ''
 )
 !add-import-btn.addEventListener click (
  ; condition { propertyIs false nb.is-loading-script } : !nb.add-import
 )
 !add-export-btn.addEventListener click (
  ; condition { propertyIs false nb.is-loading-script } : !nb.add-export
 )

 [ match
  { [ propertyIs true nb.disposed ] : !nb.dispose }
  { true (
   ; try (
    ; to loaded !loadLaneScript $data $lane.data $lane.id $window
    [ match
     { [ propertyIs true nb.disposed ] : !nb.dispose }
     { true (
      ; set $loaded.initialized nb.script-initialized
      ; each $loaded.records (
       ; to { rec } $argv
       ; to row !nb.create-row $rec.text $rec
       !nb.lines.push $rec.text
       !nb.line-records.push $rec
       !nb.rows.push $row
       !lines-el.appendChild $row.el
      )
      !nb.renumber
      !restore-stored-drafts $loaded.initialized
      ; set false nb.is-loading-script
      ; set true source-loading-el.hidden
      ; set false add-btn.disabled
      ; set false add-import-btn.disabled
      ; set false add-export-btn.disabled
      [ match
       { $lane-control.sync-export-links : !lane-control.sync-export-links }
      ]
      !nb.apply-tab-ui
      !nb.run
     ) }
    ]
   ) (
    ; to { err } $argv
    [ match
     { $console.error : !console.error 'Failed to load lane script:' $err }
    ]
    ; set false nb.is-loading-script
    ; set true source-loading-el.hidden
    ; set false add-btn.disabled
    ; set false add-import-btn.disabled
    ; set false add-export-btn.disabled
    !nb.apply-tab-ui
    null
   )
  ) }
 ]
 ; set false nb.is-loading-script
 ; set true source-loading-el.hidden
 ; set false add-btn.disabled
 ; set false add-import-btn.disabled
 ; set false add-export-btn.disabled
 ; set null nb.load-task
 ; condition { propertyIs $nb lane.notebook } : ; set null lane.load-task
 )

 [ match
  { [ and { [ propertyIs true defer-load ] } { $idle-tracker.spawn } ] (
   ; to bg-task !idle-tracker.spawn $load-notebook-body
   ; set $bg-task nb.load-task
   ; set $bg-task lane.load-task
   $nb
  ) }
  { $idle-tracker.spawn (
   ; to fg-task !idle-tracker.spawn $load-notebook-body
   !fg-task.wait
   $nb
  ) }
  { true (
   !$load-notebook-body
   $nb
  ) }
 ]
)
$scope
