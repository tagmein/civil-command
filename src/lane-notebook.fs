-- file lane-notebook.fs
; to lane-inputs ; load /src/lane-inputs.fs
; to lane-scope ; load /src/lane-scope.fs
; to lane-data ; load /src/lane-data.fs
; to lane-output ; load /src/lane-output.fs
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
 ; to { lane container lane-control initial-tab } $argv
 ; to starting-tab !normalizeLaneTab $initial-tab
 ; set $starting-tab lane.tab
 ; to idle-tracker !createIdleTracker
 ; to nb [ object
  { lane $lane }
  { container $container }
  { lane-control $lane-control }
  { active-tab $starting-tab }
  { lines {} }
  { rows {} }
  { results {} }
  { sent {} }
  { state ; object }
  { run-id 0 }
  { editing-row null }
  { idle-tracker $idle-tracker }
 ]
 ; to root-el !document.createElement div
 ; set lane-notebook root-el.className

 ; to tabs-el !document.createElement div
 ; set lane-tabs tabs-el.className
 !tabs-el.setAttribute role tablist

 ; to source-tab !document.createElement button
 ; assign $source-tab { type button } { className 'lane-tab lane-tab--active' } { textContent Source }
 !source-tab.setAttribute role tab
 !source-tab.setAttribute data-tab source
 !source-tab.setAttribute aria-selected 'true'

 ; to input-tab !document.createElement button
 ; assign $input-tab { type button } { className lane-tab } { textContent Input }
 !input-tab.setAttribute role tab
 !input-tab.setAttribute data-tab input
 !input-tab.setAttribute aria-selected 'false'

 ; to scope-tab !document.createElement button
 ; assign $scope-tab { type button } { className lane-tab } { textContent Scope }
 !scope-tab.setAttribute role tab
 !scope-tab.setAttribute data-tab scope
 !scope-tab.setAttribute aria-selected 'false'

 ; to data-tab !document.createElement button
 ; assign $data-tab { type button } { className lane-tab } { textContent Data }
 !data-tab.setAttribute role tab
 !data-tab.setAttribute data-tab data
 !data-tab.setAttribute aria-selected 'false'

 ; to view-tab !document.createElement button
 ; assign $view-tab { type button } { className lane-tab } { textContent View }
 !view-tab.setAttribute role tab
 !view-tab.setAttribute data-tab view
 !view-tab.setAttribute aria-selected 'false'

 !tabs-el.appendChild $source-tab
 !tabs-el.appendChild $input-tab
 !tabs-el.appendChild $scope-tab
 !tabs-el.appendChild $data-tab
 !tabs-el.appendChild $view-tab

 ; to source-panel !document.createElement div
 ; set lane-tab-panel source-panel.className
 !source-panel.setAttribute role tabpanel
 !source-panel.setAttribute data-panel source
 ; set false source-panel.hidden

 ; to input-panel !document.createElement div
 ; set lane-tab-panel input-panel.className
 !input-panel.setAttribute role tabpanel
 !input-panel.setAttribute data-panel input
 ; set true input-panel.hidden

 ; to scope-panel !document.createElement div
 ; set lane-tab-panel scope-panel.className
 !scope-panel.setAttribute role tabpanel
 !scope-panel.setAttribute data-panel scope
 ; set true scope-panel.hidden

 ; to data-panel !document.createElement div
 ; set lane-tab-panel data-panel.className
 !data-panel.setAttribute role tabpanel
 !data-panel.setAttribute data-panel data
 ; set true data-panel.hidden

 ; to lines-el !document.createElement div
 ; set lane-lines lines-el.className
 ; to actions-el !document.createElement div
 ; set lane-line-actions actions-el.className
 ; to add-btn !document.createElement button
 ; assign $add-btn { type button } { className lane-add-line } { textContent '+' } { title 'Add line' }
 ; to add-import-btn !document.createElement button
 ; assign $add-import-btn { type button } { className lane-add-import } { textContent '+ Import' } { title 'Import value from another lane' }
 !actions-el.appendChild $add-btn
 !actions-el.appendChild $add-import-btn
 !source-panel.appendChild $lines-el
 !source-panel.appendChild $actions-el

 !root-el.appendChild $tabs-el
 !root-el.appendChild $source-panel
 !root-el.appendChild $input-panel
 !root-el.appendChild $scope-panel
 !root-el.appendChild $data-panel
 !container.appendChild $root-el

 ; to tabs ; object { source $source-tab } { input $input-tab } { scope $scope-tab } { data $data-tab } { view $view-tab }
 ; to inputs-view !lane-inputs.mount $lane $input-panel
 ; to scope-view !lane-scope.mount $lane $scope-panel
 ; to data-view !lane-data.mount $lane $data-panel $lane-control
 ; to output-view !lane-output.mount $lane $container
 ; assign $nb { element $root-el } { tabs-el $tabs-el } { tabs $tabs } { source-panel $source-panel } { input-panel $input-panel } { scope-panel $scope-panel } { data-panel $data-panel } { lines-el $lines-el } { actions-el $actions-el } { add-btn $add-btn } { add-import-btn $add-import-btn } { inputs-view $inputs-view } { inputs $inputs-view.inputs } { scope-view $scope-view } { data-view $data-view } { tables $data-view.tables } { output-view $output-view }

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

 ; to nb.refresh-import-labels (
  -- Updates display labels on all import rows (e.g. after another lane is renamed)
  ; each $nb.rows (
   ; to { row } $argv
   ; condition { propertyIs import row.kind } : !row.update-label
  )
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

 ; to nb.apply-tab-ui (
  -- Updates tab button active styles, panel visibility, and View output mode for the current active tab
  ; to active $nb.active-tab
  ; to is-source [ propertyIs source active ]
  ; to is-input [ propertyIs input active ]
  ; to is-scope [ propertyIs scope active ]
  ; to is-data [ propertyIs data active ]
  ; to is-view [ propertyIs view active ]

  ; set [ ternary $is-source 'lane-tab lane-tab--active' lane-tab ] source-tab.className
  ; set [ ternary $is-input 'lane-tab lane-tab--active' lane-tab ] input-tab.className
  ; set [ ternary $is-scope 'lane-tab lane-tab--active' lane-tab ] scope-tab.className
  ; set [ ternary $is-data 'lane-tab lane-tab--active' lane-tab ] data-tab.className
  ; set [ ternary $is-view 'lane-tab lane-tab--active' lane-tab ] view-tab.className
  !source-tab.setAttribute aria-selected [ ternary $is-source 'true' 'false' ]
  !input-tab.setAttribute aria-selected [ ternary $is-input 'true' 'false' ]
  !scope-tab.setAttribute aria-selected [ ternary $is-scope 'true' 'false' ]
  !data-tab.setAttribute aria-selected [ ternary $is-data 'true' 'false' ]
  !view-tab.setAttribute aria-selected [ ternary $is-view 'true' 'false' ]

  ; set [ ternary $is-source false true ] source-panel.hidden
  ; set [ ternary $is-input false true ] input-panel.hidden
  ; set [ ternary $is-scope false true ] scope-panel.hidden
  ; set [ ternary $is-data false true ] data-panel.hidden
  !output-view.set-always-visible $is-view
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

 ; to nb.set-tab (
  -- Switches the active lane tab, updates lane route URL unless skipped, and runs Source on Source, Scope, and View (never on Input or Data)
  ; to { tab skip-url } $argv
  ; to next-tab !normalizeLaneTab $tab
  ; set $next-tab nb.active-tab
  ; set $next-tab nb.lane.tab
  !nb.apply-tab-ui
  [ match
   { $skip-url : null }
   { $lane-control.update-url : !lane-control.update-url }
  ]
  [ match
   { [ propertyIs input next-tab ] : null }
   { [ propertyIs data next-tab ] : null }
   { true : !nb.run }
  ]
  $next-tab
 )

 !source-tab.addEventListener click : !nb.set-tab source
 !input-tab.addEventListener click : !nb.set-tab input
 !scope-tab.addEventListener click : !nb.set-tab scope
 !data-tab.addEventListener click : !nb.set-tab data
 !view-tab.addEventListener click : !nb.set-tab view

 ; to nb.save (
  -- Persists the lane script lines to the lane's KV namespace
  ; to serialized !window.JSON.stringify $nb.lines
  !nb.lane.data.set script $serialized
 )

 ; to nb.renumber (
  -- Updates displayed 1-based line numbers and live row indices
  ; each $nb.rows (
   ; to { row idx } $argv
   ; to num ; add $idx 1
   ; set $idx row.index
   ; set $num row.num-el.textContent
  )
 )

 ; to nb.run (
  -- Evaluates all notebook lines top-to-bottom when on Source or Scope (skipped on Input and Data)
  ; to { visited } $argv
  [ match
   { [ propertyIs input nb.active-tab ] : null }
   { [ propertyIs data nb.active-tab ] : null }
   { true (
    ; to next-run-id ; add $nb.run-id 1
    ; set $next-run-id nb.run-id
    ; to finish !idle-tracker.begin
    ; to import-lane-fn (
     ; to { target-id ...path } $argv
     [ match
      { [ propertyIs '' target-id ] : undefined }
      { [ propertyIs undefined target-id ] : undefined }
      { $lane-control (
       ; to res !lane-control.get-lane-final-state $target-id $nb.lane.id
       !resolveImportValue $res $path
      ) }
      { true (
       ; to no-ctrl ; object { ok false } { state null } { error 'Lane control is not available' }
       !resolveImportValue $no-ctrl $path
      ) }
     ]
    )
    ; to env [ object
     { console $console }
     { data $nb.lane.data }
     { Math $window.Math }
     { JSON $window.JSON }
     { Date $window.Date }
     { importLane $import-lane-fn }
    ]
    !inputs-view.seed-env $env
    !data-view.seed-env $env
    ; to run-opts [ object
     { filename $nb.lane.id }
     { initialState $env }
    ]
    ; to outcome !runLines $nb.lines $run-opts
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
          { $res.isComment : 'lane-line-preview lane-line-preview--comment' }
          { true : 'lane-line-preview' }
         ]
         ; set $cls row.preview-el.className
        ) }
       ]
      )
      !scope-view.render $outcome.state
      !output-view.render $outcome.sent
      !$finish true
      [ match
       { $lane-control.notify-lane-idle : !lane-control.notify-lane-idle $nb.lane.id $visited }
      ]
     ) }
     { true : !$finish false }
    ]
    $outcome
   ) }
  ]
 )

 ; to nb.create-import-row (
  -- Creates DOM elements and picker bindings for a cross-lane import line
  ; to { spec } $argv
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
   { el $el }
   { num-el $num-el }
   { control-el $control-el }
   { alias-el $alias-el }
   { pick-btn $pick-btn }
   { preview-el $preview-el }
   { remove-btn $remove-btn }
   { index 0 }
  ]

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
   -- Applies a newly chosen { alias laneId path } import spec, re-runs, and saves
   ; to { next-spec } $argv
   ; set $next-spec row.spec
   ; set $next-spec.alias alias-el.value
   !row.update-label
   ; to formatted !formatImportLine $next-spec
   ; to nb.lines $row.index $formatted
   !nb.run
   !nb.save
  )

  ; to row.open-picker (
   -- Opens the Scope browser picker modal to choose a source lane, property, and name
   [ match
    { $lane-control.pick-import (
     ; to pick-opts [ object
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
   ; to nb.lines $row.index $formatted
   !nb.run
   !nb.save
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
     ; to nb.lines $row.index $next-val
     !row.sync-input-control $next-val false
     !scope.auto-size-textarea $editor-el
     !nb.run
     !nb.save
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
  ; to { text } $argv
  ; to import-spec !parseImportLine $text
  [ match
   { $import-spec : !nb.create-import-row $import-spec }
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
     { el $el }
     { num-el $num-el }
     { input-el null }
     { editor-el null }
     { preview-el $preview-el }
     { remove-btn $remove-btn }
     { is-multiline $initial-multiline }
     { is-editing false }
     { index 0 }
    ]

    ; to row.update-classes (
     -- Syncs row and line-number CSS classes for multiline and edit-individual-line states
     ; to line-cls [ match
      { [ and { propertyIs true row.is-multiline } { propertyIs true row.is-editing } ] : 'lane-line lane-line--multiline lane-line--editing' }
      { [ propertyIs true row.is-multiline ] : 'lane-line lane-line--multiline' }
      { [ propertyIs true row.is-editing ] : 'lane-line lane-line--editing' }
      { true : lane-line }
     ]
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
      ; to nb.lines $row.index $next-val
      ; to still-multi !scope.has-newline $next-val
      [ match
       { [ propertyIs $row.is-multiline still-multi ] (
        ; condition { propertyIs true row.is-multiline } : !scope.auto-size-textarea $ctrl
       ) }
       { true : !row.sync-input-control $next-val true }
      ]
      !nb.run
      !nb.save
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
    !row.update-classes
    !num-el.addEventListener click : !nb.open-line-editor $row
    !remove-btn.addEventListener click : !nb.remove-line $row.index
    $row
   ) }
  ]
 )

 ; to nb.insert-row (
  -- Inserts a line into state and DOM at the given index without running or saving
  ; to { index text } $argv
  ; to initial [ match
   { [ propertyIs undefined text ] : '' }
   { true : $text }
  ]
  ; to row !nb.create-row $initial
  !nb.lines.splice $index 0 $initial
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
  ; to last-rest-idx ; subtract $rest.length 1
  ; to last-pasted [ get rest $last-rest-idx ]
  ; to caret-pos $last-pasted.length
  ; to last-line ; add $last-pasted $after
  ; to rest $last-rest-idx $last-line
  ; to base-idx ; add $row.index 1
  ; to last-row ; each $rest (
   ; to { line-text offset } $argv
   ; to target-idx ; add $base-idx $offset
   !nb.insert-row $target-idx $line-text
  )
  !nb.renumber
  [ match
   { $last-row.input-el.focus : !last-row.input-el.focus }
  ]
  [ match
   { $last-row.input-el.setSelectionRange : !last-row.input-el.setSelectionRange $caret-pos $caret-pos }
  ]
  !nb.run
  !nb.save
  $last-row
 )

 ; to nb.insert-line (
  -- Inserts a line at the given index, focuses it, re-runs, and persists
  ; to { index text } $argv
  ; to row !nb.insert-row $index $text
  !nb.renumber
  [ match
   { $row.input-el.focus : !row.input-el.focus }
  ]
  !nb.run
  !nb.save
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
  !nb.save
  $row
 )

 ; to nb.add-import (
  -- Appends a new import line and opens the lane value picker
  ; to empty-spec ; object { alias '' } { laneId '' } { path {} }
  ; to row !nb.insert-import $nb.lines.length $empty-spec
  !row.open-picker
  $row
 )

 ; to nb.remove-line (
  -- Removes the line at the given index, renumbers, re-runs, and persists
  ; to { index } $argv
  ; to row [ get nb.rows $index ]
  [ match
   { $row (
    ; condition { propertyIs $row nb.editing-row } : !nb.close-line-editor false
    !row.el.remove
    !nb.lines.splice $index 1
    !nb.rows.splice $index 1
    !nb.renumber
    !nb.run
    !nb.save
   ) }
  ]
 )

 !add-btn.addEventListener click : !nb.insert-line $nb.lines.length ''
 !add-import-btn.addEventListener click $nb.add-import

 ; to stored !lane.data.get script
 ; to initial-lines !scope.parse-stored $stored
 ; each $initial-lines (
  ; to { line-text } $argv
  ; to row !nb.create-row $line-text
  !nb.lines.push $line-text
  !nb.rows.push $row
  !lines-el.appendChild $row.el
 )
 !nb.renumber
 ; set $nb lane.notebook
 !nb.apply-tab-ui
 !nb.run
 $nb
)
$scope
