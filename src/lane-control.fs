-- file lane-control.fs
; to lane-notebook ; load /src/lane-notebook.fs
; to lane-inputs ; load /src/lane-inputs.fs
; to lane-config-modal ; load /src/lane-config-modal.fs
; to lane-import-modal ; load /src/lane-import-modal.fs
; to confirm-modal-mod ; load /src/confirm-modal.fs
; to row-picker-modal-mod ; load /src/lane-row-picker-modal.fs
; to scope ; object { lanes {} } { lane-ids {} } { by-id ; object } { catalog ; object } { active-imports ; object }
; to config-modal !lane-config-modal.create $scope
; set $config-modal scope.config-modal
; to import-modal !lane-import-modal.create $scope
; set $import-modal scope.import-modal
; to confirm-modal !confirm-modal-mod.create
; set $confirm-modal scope.confirm-modal
; to row-picker-modal !row-picker-modal-mod.create
; set $row-picker-modal scope.row-picker-modal
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
; to scope.rename (
 -- Updates a lane's title in live state, DOM header, lane KV, and persistent catalog
 ; to { id title } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   ; set $title lane.title
   ; set $title lane.title-el.textContent
   !lane.data.set title $title
   !scope.register $id $title
   !scope.refresh-import-labels $id
  ) }
 ]
 $lane
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
 -- Mounts a lane DOM header, gear config button, reload button, close button, notebook body, and registers it on scope
 ; to { id title lane-data initial-tab initial-subroute } $argv
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
 ; to reload-btn !document.createElement button
 ; assign $reload-btn { type button } { className lane-reload-btn } { textContent '↻' } { title 'Reload lane' }
 !reload-btn.setAttribute aria-label 'Reload lane'
 !reload-btn.addEventListener click : !scope.reload $id
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-close-btn } { textContent '×' } { title 'Close lane' }
 !close-btn.addEventListener click : !scope.close $id
 !header-top.appendChild $config-btn
 !header-top.appendChild $meta-el
 !header-top.appendChild $reload-btn
 !header-top.appendChild $close-btn
 !element.appendChild $header-top
 ; to lane [ object
  { id $id }
  { tab $tab }
  { subroute $subroute }
  { title $title }
  { title-el $title-el }
  { data $lane-data }
  { element $element }
  { body $body-el }
  { config-btn $config-btn }
  { reload-btn $reload-btn }
  { close-btn $close-btn }
 ]
 !scope.lanes.push $lane
 ; set $scope.lanes.length lane.number
 !scope.lane-ids.push $id
 ; to scope.by-id $id $lane
 [ match
  { $body-el (
   !body-el.setAttribute data-lane-id $id
   !lane-notebook.mount $lane $body-el $scope $tab
  ) }
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
 -- Reloads an open lane from scratch from persisted KV storage (title, script, inputs, tables, output) while preserving its position and selected tab
 ; to { id } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   ; to raw-tab [ match
    { $lane.notebook.active-tab : $lane.notebook.active-tab }
    { true : $lane.tab }
   ]
   ; to current-tab !normalizeLaneTab $raw-tab
   ; set $current-tab lane.tab
   ; to stored-title !lane.data.get title
   [ match
    { $stored-title (
     ; set $stored-title lane.title
     ; set $stored-title lane.title-el.textContent
     !scope.register $id $stored-title
     !scope.refresh-import-labels $id
    ) }
   ]
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
     !lane-notebook.mount $lane $lane.body $scope $current-tab
     [ match
      { [ propertyIs input current-tab ] : !scope.notify-lane-idle $id }
      { [ propertyIs data current-tab ] : !scope.notify-lane-idle $id }
     ]
    ) }
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
   ; to lane !scope.mount $id $title $lane-data $normalized-tab $subroute
   $lane
  ) }
 ]
)
; to scope.clear (
 -- Removes all mounted lane elements and resets lane collections
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
