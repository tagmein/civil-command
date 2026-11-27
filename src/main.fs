-- file main.fs
; to window $document.defaultView
; to crypto $window.crypto
; to history $window.history
; to location $window.location
[ assign document.body.style
 { backgroundColor #202020 }
 { fontFamily '"IBM Plex Mono", monospace, Arial, "Noto Sans", Verdana, sans-serif' }
 { fontSize 13px }
]
[ match
 { $document.documentElement.style : ; set '#383838 transparent' document.documentElement.style.scrollbarColor }
]
; to read-scroll-left (
 -- Reads the current horizontal scroll offset in pixels
 ; to root $document.documentElement
 [ match
  { { propertyIsGreaterThanOrEqual 0 window.scrollX } : !window.Math.round $window.scrollX }
  { { propertyIsGreaterThanOrEqual 0 root.scrollLeft } : !window.Math.round $root.scrollLeft }
  { true : 0 }
 ]
)
; to restore-scroll-left (
 -- Restores horizontal scroll offset from #scroll.left=<px> in location.hash
 ; to opts !parseHashOptions $location.hash
 ; to left $opts.scroll.left
 [ match
  { { propertyIsGreaterThanOrEqual 0 left } (
   ; to y [ match
    { { propertyIsGreaterThanOrEqual 0 window.scrollY } : $window.scrollY }
    { true : 0 }
   ]
   [ match
    { $window.scrollTo : !window.scrollTo $left $y }
   ]
   [ match
    { $document.documentElement : ; set $left document.documentElement.scrollLeft }
   ]
  ) }
 ]
)
; to sync-scroll-hash (
 -- Softly updates location.hash with scroll.left via history.replaceState without adding history entries
 ; to opts !parseHashOptions $location.hash
 ; to left !read-scroll-left
 [ match
  { { propertyIsGreaterThan 0 left } (
   [ match
    { $opts.scroll : null }
    { true : ; to opts.scroll ; object }
   ]
   ; set $left opts.scroll.left
  ) }
  { $opts.scroll (
   !window.Reflect.deleteProperty $opts.scroll left
   ; to remaining !window.Object.keys $opts.scroll
   ; condition { propertyIs 0 remaining.length } : !window.Reflect.deleteProperty $opts scroll
  ) }
 ]
 ; to next-hash !formatHashOptions $opts
 ; to current-hash [ match
  { $location.hash : $location.hash }
  { true : '' }
 ]
 [ match
  { [ propertyIs $current-hash next-hash ] : null }
  { $history.replaceState (
   ; to pathname [ match
    { $location.pathname : $location.pathname }
    { true : '/' }
   ]
   ; to search [ match
    { $location.search : $location.search }
    { true : '' }
   ]
   ; to next-url ; add [ ; add $pathname $search ] $next-hash
   !history.replaceState null '' $next-url
  ) }
 ]
)
; to release-scroll-width (
 -- Releases temporary body minWidth and syncs clamped scroll position to location.hash
 ; set '' document.body.style.minWidth
 !sync-scroll-hash
)
; to prime-scroll-width (
 -- Extends body minWidth early so hash scroll position can be applied immediately before lanes load, then releases after 10s
 ; to opts !parseHashOptions $location.hash
 ; to left $opts.scroll.left
 [ match
  { { propertyIsGreaterThan 0 left } (
   ; to root $document.documentElement
   ; to viewport-width [ match
    { { propertyIsGreaterThanOrEqual 0 window.innerWidth } : $window.innerWidth }
    { { propertyIsGreaterThanOrEqual 0 root.clientWidth } : $root.clientWidth }
    { true : 0 }
   ]
   ; to min-w ; add [ ; add $left $viewport-width ] px
   ; set $min-w document.body.style.minWidth
   !restore-scroll-left
   [ match
    { $window.setTimeout : !window.setTimeout $release-scroll-width 10000 }
   ]
  ) }
 ]
)
!prime-scroll-width
; to message !document.createElement div
; set 'Civil Command\n\nHome\n ' message.textContent
!document.body.appendChild $message
; to boot-loading-el !document.createElement div
; assign $boot-loading-el { className cc-loading } { textContent 'Loading workspace…' } { hidden false }
!document.body.appendChild $boot-loading-el
!console.log $data
; to state ; object
= ; set [ !data.get @1 ] state @1
 session
= ; to @1 !document.createElement @2
 table table
 tableHead thead
 tableHeadRow tr
 tableHeadRowAdd th
 tableHeadRowControls div
 tableHeadRowAddButton button
 tableHeadRowOpenButton button
 tableBody tbody
 tableBodyRow tr
 tableBodyRowSpacer td
=
; set lanes-table table.className
; set lane-controls tableHeadRowControls.className
; set lane-controls-body tableBodyRowSpacer.className
; assign $tableHeadRowAddButton { type button } { className lane-control-btn } { textContent '+ Lane' }
; assign $tableHeadRowOpenButton { type button } { className lane-control-btn } { textContent Open }
= !@2+.appendChild $@1
 tableHeadRowAddButton tableHeadRowControls
 tableHeadRowOpenButton tableHeadRowControls
 tableHeadRowControls tableHeadRowAdd
 tableHeadRowAdd tableHeadRow
 tableHeadRow tableHead
 tableHead table
 tableBodyRowSpacer tableBodyRow
 tableBodyRow tableBody
 tableBody table
 table document body
=
; to lane-control ; load /src/lane-control.fs
; to lane-control.create-lane (
 -- Creates header and notebook body cells for a lane column, optionally inserting before an existing lane and pre-applying minimized classes
 ; to { before-lane minimized-side } $argv
 ; to is-min [ match
  { $minimized-side : true }
  { true : false }
 ]
 ; to header !document.createElement th
 ; set [ ternary $is-min 'lane-header lane-header--minimized' lane-header ] header.className
 [ match
  { $before-lane.element (
   [ match
    { $tableHeadRow.insertBefore : !tableHeadRow.insertBefore $header $before-lane.element }
    { true : !tableHeadRow.appendChild $header }
   ]
  ) }
  { true : !tableHeadRow.appendChild $header }
 ]
 ; to body !document.createElement td
 ; set [ ternary $is-min 'lane-body lane-body--minimized' lane-body ] body.className
 [ match
  { $before-lane.body (
   [ match
    { $tableBodyRow.insertBefore : !tableBodyRow.insertBefore $body $before-lane.body }
    { true : !tableBodyRow.appendChild $body }
   ]
  ) }
  { true : !tableBodyRow.appendChild $body }
 ]
 ; object { header $header } { body $body }
)
; to lane-control.move-lane-dom (
 -- Repositions an existing lane's header and body DOM cells before another lane (or at the end when before-lane is null)
 ; to { lane before-lane } $argv
 [ match
  { $lane.element (
   [ match
    { $before-lane.element (
     [ match
      { $tableHeadRow.insertBefore : !tableHeadRow.insertBefore $lane.element $before-lane.element }
      { true : !tableHeadRow.appendChild $lane.element }
     ]
    ) }
    { true : !tableHeadRow.appendChild $lane.element }
   ]
  ) }
 ]
 [ match
  { $lane.body (
   [ match
    { $before-lane.body (
     [ match
      { $tableBodyRow.insertBefore : !tableBodyRow.insertBefore $lane.body $before-lane.body }
      { true : !tableBodyRow.appendChild $lane.body }
     ]
    ) }
    { true : !tableBodyRow.appendChild $lane.body }
   ]
  ) }
 ]
)
; to lane-modal $lane-control.lane-modal
; to lanes $lane-control.lanes
; to scroll-timer null
; to on-scroll (
 -- Debounces scroll hash updates when setTimeout is available
 [ match
  { $window.setTimeout (
   [ match
    { $scroll-timer : !window.clearTimeout $scroll-timer }
   ]
   ; to scroll-timer !window.setTimeout $sync-scroll-hash 100
  ) }
  { true : !sync-scroll-hash }
 ]
)
!console.log Lane Control $lane-control
[ match
 { $lane-control.mount-workspace-summary : !lane-control.mount-workspace-summary $tableBodyRowSpacer }
]
; set true boot-loading-el.hidden
!boot-loading-el.remove
!window.addEventListener scroll $on-scroll
!window.addEventListener hashchange $restore-scroll-left
!tableHeadRowAddButton.addEventListener click $lane-control.add
!tableHeadRowOpenButton.addEventListener click $lane-modal.open
!lane-control.init
