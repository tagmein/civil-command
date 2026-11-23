-- file lane-inputs.fs
; to scope ; object
; to scope.parse-stored (
 -- Parses persisted lane input declarations into an array of { name type } records
 ; to { stored } $argv
 ; to out {}
 [ match
  { [ propertyIs null stored ] : $out }
  { [ propertyIs undefined stored ] : $out }
  { [ !stored.startsWith '[' ] (
   ; to parsed !window.JSON.parse $stored
   [ match
    { [ !window.Array.isArray $parsed ] (
     ; each $parsed (
      ; to { item } $argv
      [ match
       { $item (
        ; to raw-name [ match
         { [ propertyIs null item.name ] : '' }
         { [ propertyIs undefined item.name ] : '' }
         { true : ; add '' $item.name }
        ]
        ; to clean-type !normalizePrimitiveType $item.type
        ; to entry ; object { name $raw-name } { type $clean-type }
        !out.push $entry
       ) }
      ]
     )
     $out
    ) }
    { true : $out }
   ]
  ) }
  { true : $out }
 ]
)
; to scope.mount (
 -- Mounts the Input tab table of assumed primitive scope variables for a lane
 ; to { lane container } $argv
 ; to view [ object
  { lane $lane }
  { container $container }
  { inputs {} }
  { rows {} }
 ]
 ; to root-el !document.createElement div
 ; set lane-inputs root-el.className
 ; to table-el !document.createElement table
 ; set lane-inputs-table table-el.className
 ; to head-el !document.createElement thead
 ; to head-row !document.createElement tr
 ; to name-th !document.createElement th
 ; assign $name-th { className lane-inputs-th } { textContent Name }
 ; to type-th !document.createElement th
 ; assign $type-th { className lane-inputs-th } { textContent Type }
 ; to act-th !document.createElement th
 ; assign $act-th { className 'lane-inputs-th lane-inputs-th--actions' } { textContent '' }
 !head-row.appendChild $name-th
 !head-row.appendChild $type-th
 !head-row.appendChild $act-th
 !head-el.appendChild $head-row
 ; to body-el !document.createElement tbody
 ; set lane-inputs-body body-el.className
 !table-el.appendChild $head-el
 !table-el.appendChild $body-el

 ; to empty-el !document.createElement div
 ; assign $empty-el { className lane-inputs-empty } { textContent 'No inputs declared.' }

 ; to add-btn !document.createElement button
 ; assign $add-btn { type button } { className lane-add-input } { textContent '+ Input' } { title 'Add assumed input variable' }

 !root-el.appendChild $table-el
 !root-el.appendChild $empty-el
 !root-el.appendChild $add-btn
 !container.appendChild $root-el
 ; assign $view { element $root-el } { table-el $table-el } { body-el $body-el } { empty-el $empty-el } { add-btn $add-btn }

 ; to view.save (
  -- Persists the lane's assumed input variables to KV without running Source
  ; to serialized !window.JSON.stringify $view.inputs
  !view.lane.data.set inputs $serialized
 )

 ; to view.reindex (
  -- Updates row indices and toggles the empty-state notice
  ; each $view.rows (
   ; to { row idx } $argv
   ; set $idx row.index
  )
  ; to has-rows [ propertyIsGreaterThan 0 view.rows.length ]
  ; set $has-rows empty-el.hidden
 )

 ; to view.create-row (
  -- Creates a table row for a single assumed primitive input variable
  ; to { entry } $argv
  ; to tr !document.createElement tr
  ; set lane-input-row tr.className

  ; to name-td !document.createElement td
  ; set lane-input-cell name-td.className
  ; to name-el !document.createElement input
  ; assign $name-el { type text } { className lane-input-name } { value $entry.name } { placeholder 'variable' } { spellcheck false } { autocomplete off }
  !name-td.appendChild $name-el

  ; to type-td !document.createElement td
  ; set lane-input-cell type-td.className
  ; to type-el !document.createElement select
  ; set lane-input-type type-el.className
  ; each $primitiveTypes (
   ; to { type-name } $argv
   ; to opt !document.createElement option
   ; assign $opt { value $type-name } { textContent $type-name }
   !type-el.appendChild $opt
  )
  ; set $entry.type type-el.value
  !type-td.appendChild $type-el

  ; to act-td !document.createElement td
  ; set 'lane-input-cell lane-input-cell--actions' act-td.className
  ; to remove-btn !document.createElement button
  ; assign $remove-btn { type button } { className lane-input-remove } { textContent '×' } { title 'Remove input' }
  !act-td.appendChild $remove-btn

  !tr.appendChild $name-td
  !tr.appendChild $type-td
  !tr.appendChild $act-td

  ; to row [ object
   { el $tr }
   { name-el $name-el }
   { type-el $type-el }
   { remove-btn $remove-btn }
   { entry $entry }
   { index 0 }
  ]

  !name-el.addEventListener input (
   ; set $name-el.value entry.name
   !view.save
  )
  !name-el.addEventListener keydown (
   ; to { ev } $argv
   ; condition { propertyIs Enter ev.key } (
    [ match
     { $ev.preventDefault : !ev.preventDefault }
    ]
    ; to next-idx ; add $row.index 1
    !view.insert-input $next-idx '' string
   )
  )
  !type-el.addEventListener change (
   ; to clean-type !normalizePrimitiveType $type-el.value
   ; set $clean-type entry.type
   ; set $clean-type type-el.value
   !view.save
  )
  !remove-btn.addEventListener click : !view.remove-input $row.index
  $row
 )

 ; to view.insert-input (
  -- Inserts an assumed input row at the given index, focuses its name field, and saves
  ; to { index name type } $argv
  ; to clean-name [ match
   { [ propertyIs undefined name ] : '' }
   { [ propertyIs null name ] : '' }
   { true : ; add '' $name }
  ]
  ; to clean-type !normalizePrimitiveType $type
  ; to entry ; object { name $clean-name } { type $clean-type }
  ; to row !view.create-row $entry
  !view.inputs.splice $index 0 $entry
  !view.rows.splice $index 0 $row
  ; to next-idx ; add $index 1
  ; to next-row [ get view.rows $next-idx ]
  [ match
   { $next-row : !body-el.insertBefore $row.el $next-row.el }
   { true : !body-el.appendChild $row.el }
  ]
  !view.reindex
  [ match
   { $row.name-el.focus : !row.name-el.focus }
  ]
  !view.save
  $row
 )

 ; to view.add-input (
  -- Appends a new assumed input row at the end of the table
  ; to { name type } $argv
  !view.insert-input $view.inputs.length $name $type
 )

 ; to view.remove-input (
  -- Removes the assumed input row at the given index and saves
  ; to { index } $argv
  ; to row [ get view.rows $index ]
  [ match
   { $row (
    !row.el.remove
    !view.inputs.splice $index 1
    !view.rows.splice $index 1
    !view.reindex
    !view.save
   ) }
  ]
 )

 ; to view.seed-env (
  -- Seeds an execution environment object with default values for declared primitive inputs
  ; to { env } $argv
  ; each $view.inputs (
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
  $env
 )

 !add-btn.addEventListener click : !view.insert-input $view.inputs.length '' string

 ; to stored !lane.data.get inputs
 ; to initial-inputs !scope.parse-stored $stored
 ; each $initial-inputs (
  ; to { entry } $argv
  ; to row !view.create-row $entry
  !view.inputs.push $entry
  !view.rows.push $row
  !body-el.appendChild $row.el
 )
 !view.reindex
 $view
)
$scope
