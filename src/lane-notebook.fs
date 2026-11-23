-- file lane-notebook.fs
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
; to scope.mount (
 -- Mounts a persistent, live-evaluated FieldScript notebook inside a lane container
 ; to { lane container } $argv
 ; to nb [ object
  { lane $lane }
  { container $container }
  { lines {} }
  { rows {} }
  { results {} }
  { state ; object }
  { run-id 0 }
 ]
 ; to root-el !document.createElement div
 ; set lane-notebook root-el.className
 ; to lines-el !document.createElement div
 ; set lane-lines lines-el.className
 ; to add-btn !document.createElement button
 ; assign $add-btn { type button } { className lane-add-line } { textContent '+' } { title 'Add line' }
 !root-el.appendChild $lines-el
 !root-el.appendChild $add-btn
 !container.appendChild $root-el
 ; assign $nb { element $root-el } { lines-el $lines-el } { add-btn $add-btn }

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
  -- Evaluates all notebook lines top-to-bottom and updates per-line JSON previews
  ; to next-run-id ; add $nb.run-id 1
  ; set $next-run-id nb.run-id
  ; to env [ object
   { console $console }
   { data $nb.lane.data }
   { Math $window.Math }
   { JSON $window.JSON }
   { Date $window.Date }
  ]
  ; to run-opts [ object
   { filename $nb.lane.id }
   { initialState $env }
  ]
  ; to outcome !runLines $nb.lines $run-opts
  ; condition { propertyIs $next-run-id nb.run-id } (
   ; set $outcome.results nb.results
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
  )
  $outcome
 )

 ; to nb.create-row (
  -- Creates DOM elements and event bindings for a single script line
  ; to { text } $argv
  ; to el !document.createElement div
  ; set lane-line el.className
  ; to num-el !document.createElement span
  ; set lane-line-num num-el.className
  ; to input-el !document.createElement input
  ; assign $input-el { type text } { className lane-line-input } { value $text } { placeholder 'FieldScript...' } { spellcheck false } { autocomplete off }
  ; to preview-el !document.createElement code
  ; set lane-line-preview preview-el.className
  ; to remove-btn !document.createElement button
  ; assign $remove-btn { type button } { className lane-line-remove } { textContent '×' } { title 'Remove line' }
  !el.appendChild $num-el
  !el.appendChild $input-el
  !el.appendChild $preview-el
  !el.appendChild $remove-btn
  ; to row [ object
   { el $el }
   { num-el $num-el }
   { input-el $input-el }
   { preview-el $preview-el }
   { remove-btn $remove-btn }
   { index 0 }
  ]
  !input-el.addEventListener input (
   ; to nb.lines $row.index $input-el.value
   !nb.run
   !nb.save
  )
  !input-el.addEventListener keydown (
   ; to { ev } $argv
   ; condition { propertyIs Enter ev.key } (
    !ev.preventDefault
    ; to next-idx ; add $row.index 1
    !nb.insert-line $next-idx ''
   )
  )
  !remove-btn.addEventListener click : !nb.remove-line $row.index
  $row
 )

 ; to nb.insert-line (
  -- Inserts a line at the given index, focuses it, re-runs, and persists
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

 ; to nb.remove-line (
  -- Removes the line at the given index, renumbers, re-runs, and persists
  ; to { index } $argv
  ; to row [ get nb.rows $index ]
  [ match
   { $row (
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
 !nb.run
 ; set $nb lane.notebook
 $nb
)
$scope
