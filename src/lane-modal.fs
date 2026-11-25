-- file lane-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a full-screen modal for browsing, opening, and closing known lanes
 ; to { lane-control } $argv
 ; to backdrop !document.createElement div
 ; set lane-modal-backdrop backdrop.className
 ; to panel !document.createElement div
 ; set lane-modal panel.className
 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-modal-title-wrap title-wrap.className
 ; to heading !document.createElement div
 ; assign $heading { className lane-modal-title } { textContent 'Open Lane' }
 ; to count-el !document.createElement div
 ; set lane-modal-count count-el.className
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 ; to toolbar !document.createElement div
 ; set lane-modal-toolbar toolbar.className
 ; to search-input !document.createElement input
 ; assign $search-input { type text } { className lane-modal-search } { placeholder 'Filter lanes by title or ID...' } { spellcheck false } { autocomplete off }
 ; to clear-btn !document.createElement button
 ; assign $clear-btn { type button } { className 'lane-modal-action lane-modal-action--close lane-modal-clear' } { textContent Clear } { title 'Clear selected lane' }
 ; set true clear-btn.hidden
 ; to pkg-bar !document.createElement div
 ; set lane-modal-packages pkg-bar.className
 ; to list-el !document.createElement div
 ; set lane-modal-list list-el.className

 !title-wrap.appendChild $heading
 !title-wrap.appendChild $count-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn
 !toolbar.appendChild $search-input
 !toolbar.appendChild $clear-btn
 !panel.appendChild $header
 !panel.appendChild $toolbar
 !panel.appendChild $pkg-bar
 !panel.appendChild $list-el
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { heading-el $heading }
  { search-input $search-input }
  { clear-btn $clear-btn }
  { pkg-bar $pkg-bar }
  { list-el $list-el }
  { count-el $count-el }
  { close-btn $close-btn }
  { is-open false }
  { mode open }
  { selected-id null }
  { on-select null }
  { query '' }
  { package-filter '' }
  { known {} }
  { pkg-pill-els {} }
  { pkg-pills {} }
  { row-els {} }
  { items {} }
 ]

 ; to modal.close (
  -- Closes the full-screen lanes modal and resets picker session state
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   ; set null modal.selected-id
   ; set null modal.on-select
   !backdrop.remove
  )
 )

 ; to emit-selection (
  -- Closes the picker modal and forwards the chosen lane ID (or null when cleared) to on-select
  ; to { chosen } $argv
  ; to cb $modal.on-select
  !modal.close
  [ match
   { $cb : !$cb $chosen }
  ]
 )

 ; to modal.render-packages (
  -- Renders open package filter pills and package creation/unlock shortcuts above the lane list
  ; while { propertyIsGreaterThan 0 modal.pkg-pill-els.length } (
   ; to old-pill !modal.pkg-pill-els.pop
   !old-pill.remove
  )
  ; set 0 modal.pkg-pills.length
  ; to all-active [ propertyIs '' modal.package-filter ]
  ; to all-btn !document.createElement button
  ; assign $all-btn { type button } { className [ ternary $all-active 'lane-modal-pkg-pill lane-modal-pkg-pill--active' lane-modal-pkg-pill ] } { textContent 'All open' }
  !all-btn.addEventListener click (
   ; set '' modal.package-filter
   !modal.render-packages
   !modal.render
  )
  !pkg-bar.appendChild $all-btn
  !modal.pkg-pill-els.push $all-btn
  !modal.pkg-pills.push ; object { id '' } { el $all-btn }

  ; to pkgs [ match
   { $lane-control.open-packages : $lane-control.open-packages }
   { true : {} }
  ]
  ; each $pkgs (
   ; to { pkg } $argv
   ; to is-act [ propertyIs $pkg.id modal.package-filter ]
   ; to pbtn !document.createElement button
   ; assign $pbtn { type button } { className [ ternary $is-act 'lane-modal-pkg-pill lane-modal-pkg-pill--active' lane-modal-pkg-pill ] } { textContent $pkg.name } { title $pkg.id }
   !pbtn.addEventListener click (
    ; set $pkg.id modal.package-filter
    !modal.render-packages
    !modal.render
   )
   !pkg-bar.appendChild $pbtn
   !modal.pkg-pill-els.push $pbtn
   !modal.pkg-pills.push ; object { id $pkg.id } { el $pbtn }
  )

  [ match
   { $lane-control.package-modal (
    ; to create-pkg-btn !document.createElement button
    ; assign $create-pkg-btn { type button } { className lane-modal-pkg-action } { textContent '+ Package' }
    !create-pkg-btn.addEventListener click (
     !lane-control.package-modal.open-create-package [ object { on-created (
      ; to { res } $argv
      ; to known !lane-control.list-known
      ; set $known modal.known
      [ match
       { $res.pkg.id : ; set $res.pkg.id modal.package-filter }
      ]
      !modal.render-packages
      !modal.render
     ) } ]
    )
    !pkg-bar.appendChild $create-pkg-btn
    !modal.pkg-pill-els.push $create-pkg-btn

    ; to open-pkg-btn !document.createElement button
    ; assign $open-pkg-btn { type button } { className lane-modal-pkg-action } { textContent 'Open Pkg' }
    !open-pkg-btn.addEventListener click (
     !lane-control.package-modal.open-unlock-package [ object { on-opened (
      ; to { res } $argv
      ; to known !lane-control.list-known
      ; set $known modal.known
      !modal.render-packages
      !modal.render
     ) } ]
    )
    !pkg-bar.appendChild $open-pkg-btn
    !modal.pkg-pill-els.push $open-pkg-btn
   ) }
  ]
 )

 ; to modal.render (
  -- Renders filtered known lanes with Open/Close controls and package badges
  ; while { propertyIsGreaterThan 0 modal.row-els.length } (
   ; to old-el !modal.row-els.pop
   !old-el.remove
  )
  ; set 0 modal.items.length
  ; to q-trimmed !modal.query.trim
  ; to q !q-trimmed.toLowerCase
  ; to pkg-filter $modal.package-filter
  ; to matches {}
  ; each $modal.known (
   ; to { entry } $argv
   ; to entry-pkg [ match
    { $entry.packageId : $entry.packageId }
    { true : default }
   ]
   ; to pkg-ok [ match
    { [ propertyIs '' pkg-filter ] : true }
    { [ propertyIs $pkg-filter entry-pkg ] : true }
    { true : false }
   ]
   ; to hay-raw ; add $entry.title ; add ' ' $entry.id
   ; to hay !hay-raw.toLowerCase
   ; to hit [ match
    { [ propertyIs false pkg-ok ] : false }
    { [ propertyIs '' q ] : true }
    { [ !hay.includes $q ] : true }
    { true : false }
   ]
   [ match
    { $hit : !matches.push $entry }
   ]
  )
  ; to total $modal.known.length
  ; to shown $matches.length
  ; to has-filter [ match
   { [ propertyIs '' q ] : [ match { [ propertyIs '' pkg-filter ] : false } { true : true } ] }
   { true : true }
  ]
  ; to count-label [ match
   { [ propertyIs false has-filter ] (
    ; to noun [ match
     { [ propertyIs 1 total ] : ' lane' }
     { true : ' lanes' }
    ]
    ; add $total $noun
   ) }
   { true : ; add $shown ; add ' of ' ; add $total ' lanes' }
  ]
  ; set $count-label count-el.textContent

  [ match
   { [ propertyIs 0 shown ] (
    ; to empty-el !document.createElement div
    ; set lane-modal-empty empty-el.className
    ; to empty-msg [ match
     { [ propertyIs 0 total ] : 'No saved lanes yet. Click + Lane to create one.' }
     { true : 'No matching lanes.' }
    ]
    ; set $empty-msg empty-el.textContent
    !list-el.appendChild $empty-el
    !modal.row-els.push $empty-el
   ) }
   { true (
    ; each $matches (
     ; to { entry } $argv
     ; to row-el !document.createElement div
     ; set lane-modal-item row-el.className
     ; to info-el !document.createElement div
     ; set lane-modal-item-info info-el.className
     ; to item-title !document.createElement div
     ; assign $item-title { className lane-modal-item-title } { textContent $entry.title }
     ; to item-id !document.createElement div
     ; assign $item-id { className lane-modal-item-id } { textContent $entry.id }
     !info-el.appendChild $item-title
     !info-el.appendChild $item-id
     ; to actions-el !document.createElement div
     ; set lane-modal-item-actions actions-el.className
     ; to pkg-label [ match
      { $entry.packageName : $entry.packageName }
      { $entry.packageId : $entry.packageId }
      { true : Default }
     ]
     ; to pkg-badge !document.createElement span
     ; assign $pkg-badge { className lane-modal-item-pkg } { textContent $pkg-label }
     !actions-el.appendChild $pkg-badge
     ; to open-lane [ get lane-control.by-id $entry.id ]
     ; to item-record [ object
      { entry $entry }
      { el $row-el }
      { is-open [ ternary $open-lane true false ] }
     ]
     [ match
      { [ propertyIs pick modal.mode ] (
       ; to is-selected [ match
        { $modal.selected-id : [ propertyIs $modal.selected-id entry.id ] }
        { true : false }
       ]
       ; set [ ternary $is-selected 'lane-modal-item lane-modal-item--selected' lane-modal-item ] row-el.className
       ; set $is-selected item-record.is-selected
       [ match
        { $is-selected (
         ; to sel-badge !document.createElement span
         ; assign $sel-badge { className 'lane-modal-badge lane-modal-badge--selected' } { textContent Selected }
         ; to item-clear-btn !document.createElement button
         ; assign $item-clear-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent Clear }
         !item-clear-btn.addEventListener click : !emit-selection null
         !actions-el.appendChild $sel-badge
         !actions-el.appendChild $item-clear-btn
         ; set $item-clear-btn item-record.clear-btn
        ) }
        { true (
         [ match
          { $open-lane (
           ; to badge !document.createElement span
           ; assign $badge { className lane-modal-badge } { textContent Open }
           !actions-el.appendChild $badge
          ) }
         ]
         ; to item-select-btn !document.createElement button
         ; assign $item-select-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Select }
         !item-select-btn.addEventListener click : !emit-selection $entry.id
         !actions-el.appendChild $item-select-btn
         ; set $item-select-btn item-record.select-btn
        ) }
       ]
      ) }
      { true [ match
       { $open-lane (
        ; to badge !document.createElement span
        ; assign $badge { className lane-modal-badge } { textContent Open }
        ; to item-close-btn !document.createElement button
        ; assign $item-close-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent Close }
        !item-close-btn.addEventListener click (
         !lane-control.close $entry.id
         !modal.render
        )
        !actions-el.appendChild $badge
        !actions-el.appendChild $item-close-btn
        ; set $item-close-btn item-record.close-btn
       ) }
       { true (
        ; to item-open-btn !document.createElement button
        ; assign $item-open-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Open }
        !item-open-btn.addEventListener click (
         ; to opened !lane-control.open $entry.id
         !lane-control.update-url
         !modal.close
         [ match
          { $lane-control.scroll-lane-into-view : !lane-control.scroll-lane-into-view $opened }
         ]
        )
        !actions-el.appendChild $item-open-btn
        ; set $item-open-btn item-record.open-btn
       ) }
      ] }
     ]
     !row-el.appendChild $info-el
     !row-el.appendChild $actions-el
     !list-el.appendChild $row-el
     !modal.row-els.push $row-el
     !modal.items.push $item-record
    )
   ) }
  ]
 )

 ; to show-modal (
  -- Shared modal presentation logic: clears query, loads known lanes, mounts backdrop, renders, and focuses search
  ; set '' modal.query
  ; set '' search-input.value
  ; set '' modal.package-filter
  ; to known !lane-control.list-known
  ; set $known modal.known
  ; condition { propertyIs false modal.is-open } (
   ; set true modal.is-open
   [ match
    { $document.body.appendChild : !document.body.appendChild $backdrop }
   ]
  )
  !modal.render-packages
  !modal.render
  [ match
   { $search-input.focus : !search-input.focus }
  ]
  $modal
 )

 ; to modal.open (
  -- Loads all known lanes from KV and displays the full-screen Open Lane modal
  ; set open modal.mode
  ; set 'Open Lane' heading.textContent
  ; set true clear-btn.hidden
  ; set null modal.selected-id
  ; set null modal.on-select
  !show-modal
 )

 ; to modal.open-picker (
  -- Loads all known lanes from KV and displays the full-screen modal in Select Lane picker mode
  ; to { opts } $argv
  ; set pick modal.mode
  ; to picker-title [ match
   { $opts.title : $opts.title }
   { true : 'Select Lane' }
  ]
  ; set $picker-title heading.textContent
  ; to normalized-id [ match
   { [ propertyIs undefined opts.current-value ] : null }
   { [ propertyIs null opts.current-value ] : null }
   { true (
    ; to raw-str ; add '' $opts.current-value
    ; to trimmed !raw-str.trim
    [ match
     { [ propertyIs '' trimmed ] : null }
     { true : $trimmed }
    ]
   ) }
  ]
  ; set $normalized-id modal.selected-id
  ; set [ ternary $normalized-id false true ] clear-btn.hidden
  ; set [ match { $opts.on-select : $opts.on-select } { true : null } ] modal.on-select
  !show-modal
 )

 !close-btn.addEventListener click $modal.close
 !clear-btn.addEventListener click : !emit-selection null
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
 )
 !search-input.addEventListener input (
  ; set $search-input.value modal.query
  !modal.render
 )
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.close
   )
  ) }
 ]

 $modal
)
$scope
