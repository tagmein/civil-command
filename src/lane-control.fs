-- file lane-control.fs
; to lane-notebook ; load /src/lane-notebook.fs
; to scope ; object { lanes {} } { lane-ids {} } { by-id ; object } { catalog ; object }
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
; to scope.mount (
 -- Mounts a lane DOM header, close button, notebook body, and registers it on scope
 ; to { id title lane-data } $argv
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
 ; to meta-el !document.createElement div
 ; set lane-header-meta meta-el.className
 ; to title-el !document.createElement div
 ; set $title title-el.textContent
 ; to id-el !document.createElement div
 ; set $id id-el.textContent
 ; assign id-el.style { fontFamily '"IBM Plex Mono", monospace' } { fontSize 10px } { fontWeight normal } { opacity '0.65' }
 !meta-el.appendChild $title-el
 !meta-el.appendChild $id-el
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-close-btn } { textContent '×' } { title 'Close lane' }
 !close-btn.addEventListener click : !scope.close $id
 !header-top.appendChild $meta-el
 !header-top.appendChild $close-btn
 !element.appendChild $header-top
 ; to lane [ object
  { id $id }
  { title $title }
  { data $lane-data }
  { element $element }
  { body $body-el }
  { close-btn $close-btn }
 ]
 !scope.lanes.push $lane
 ; set $scope.lanes.length lane.number
 !scope.lane-ids.push $id
 ; to scope.by-id $id $lane
 [ match
  { $body-el (
   !body-el.setAttribute data-lane-id $id
   !lane-notebook.mount $lane $body-el
  ) }
 ]
 $lane
)
; to scope.update-url (
 -- Updates browser URL pathname to reflect current lane IDs
 ; to joined !scope.lane-ids.join /
 ; to url ; add / $joined
 !history.pushState null '' $url
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
 -- Loads or initializes a lane by ID, registers it, and mounts it if not already open
 ; to { id } $argv
 ; to existing [ get scope.by-id $id ]
 [ match
  { $existing : $existing }
  { true (
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
   ; to lane !scope.mount $id $title $lane-data
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
 -- Synchronizes mounted lanes from the current URL pathname
 !scope.clear
 ; to raw-segments !location.pathname.split /
 ; to non-empty !raw-segments.filter $window.Boolean
 ; to pending-ids !non-empty.map $window.decodeURIComponent
 ; each $pending-ids (
  ; to { next-id } $argv
  !scope.open $next-id
 )
)
; to scope.init (
 -- Subscribes to popstate and performs initial URL sync
 !window.addEventListener popstate $scope.sync
 !scope.sync
)
!console.log $scope
$scope
