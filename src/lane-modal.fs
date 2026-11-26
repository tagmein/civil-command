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
 ; to selected-section !document.createElement div
 ; assign $selected-section { className lane-multiselect-bar } { hidden true }
 ; to selected-label-el !document.createElement span
 ; assign $selected-label-el { className lane-multiselect-label } { textContent 'Selected (0)' }
 ; to selected-chips-el !document.createElement div
 ; set lane-multiselect-chips selected-chips-el.className
 !selected-section.appendChild $selected-label-el
 !selected-section.appendChild $selected-chips-el
 ; to list-el !document.createElement div
 ; set lane-modal-list list-el.className
 ; to footer !document.createElement div
 ; assign $footer { className 'lane-config-footer lane-modal-footer' } { hidden true }
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to apply-btn !document.createElement button
 ; assign $apply-btn { type button } { className 'lane-modal-action lane-config-btn--save lane-modal-apply' } { textContent Apply }
 !footer.appendChild $cancel-btn
 !footer.appendChild $apply-btn

 !title-wrap.appendChild $heading
 !title-wrap.appendChild $count-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn
 !toolbar.appendChild $search-input
 !toolbar.appendChild $clear-btn
 !panel.appendChild $header
 !panel.appendChild $toolbar
 !panel.appendChild $pkg-bar
 !panel.appendChild $selected-section
 !panel.appendChild $list-el
 !panel.appendChild $footer
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { heading-el $heading }
  { search-input $search-input }
  { clear-btn $clear-btn }
  { pkg-bar $pkg-bar }
  { selected-section $selected-section }
  { selected-label-el $selected-label-el }
  { selected-chips-el $selected-chips-el }
  { list-el $list-el }
  { footer $footer }
  { cancel-btn $cancel-btn }
  { apply-btn $apply-btn }
  { count-el $count-el }
  { close-btn $close-btn }
  { is-open false }
  { lane null }
  { target-lane null }
  { mode open }
  { multiple false }
  { selected-id null }
  { selected-ids {} }
  { on-select null }
  { query '' }
  { package-filter '' }
  { known {} }
  { pkg-pill-els {} }
  { pkg-pills {} }
  { selected-chip-els {} }
  { selected-chips {} }
  { row-els {} }
  { items {} }
 ]

 ; to normalize-lane-id (
  ; to { raw-val } $argv
  [ match
   { [ propertyIs undefined raw-val ] : null }
   { [ propertyIs null raw-val ] : null }
   { true (
    ; to raw-str ; add '' $raw-val
    ; to trimmed !raw-str.trim
    [ match
     { [ propertyIs '' trimmed ] : null }
     { true : $trimmed }
    ]
   ) }
  ]
 )

 ; to find-selected-id-idx (
  ; to { target-id } $argv
  ; to found ; object { idx -1 }
  ; each $modal.selected-ids (
   ; to { item-id idx } $argv
   ; condition { propertyIs -1 found.idx } (
    ; condition { propertyIs $target-id item-id } : ; set $idx found.idx
   )
  )
  $found.idx
 )

 ; to lookup-known-title (
  ; to { target-id } $argv
  ; to open-lane [ get lane-control.by-id $target-id ]
  ; to cat-entry [ get lane-control.catalog $target-id ]
  ; to known-box ; object { title '' }
  ; each $modal.known (
   ; to { kentry } $argv
   ; condition { propertyIs '' known-box.title } (
    ; condition { propertyIs $target-id kentry.id } (
     [ match
      { $kentry.title : ; set $kentry.title known-box.title }
     ]
    )
   )
  )
  [ match
   { $open-lane.title : $open-lane.title }
   { [ propertyIs false [ propertyIs '' known-box.title ] ] : $known-box.title }
   { $cat-entry.title : $cat-entry.title }
   { $lane-control.get-lane-title : !lane-control.get-lane-title $target-id }
   { true : $target-id }
  ]
 )

 ; to modal.clear-selected-chips (
  ; while { propertyIsGreaterThan 0 modal.selected-chip-els.length } (
   ; to old-chip !modal.selected-chip-els.pop
   !old-chip.remove
  )
  ; set 0 modal.selected-chips.length
 )

 ; to modal.close (
  -- Closes the lanes modal and resets picker session state
  ; condition { propertyIs true modal.is-open } (
   ; to prev-lane $modal.lane
   ; set false modal.is-open
   ; set false modal.multiple
   ; set null modal.lane
   ; set null modal.target-lane
   ; set null modal.selected-id
   ; set 0 modal.selected-ids.length
   ; set null modal.on-select
   !modal.clear-selected-chips
   ; set true selected-section.hidden
   ; set true footer.hidden
   !backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $modal }
   ]
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

 ; to modal.apply (
  -- Applies the current multiselect lane ID list, closes the modal, and forwards the array to on-select
  ; condition { propertyIs true modal.is-open } (
   ; condition { propertyIs true modal.multiple } (
    ; to out {}
    ; each $modal.selected-ids (
     ; to { sid } $argv
     !out.push $sid
    )
    !emit-selection $out
   )
  )
 )

 ; to modal.toggle-id (
  -- Adds or removes a lane ID in the multiselect draft list without saving until Apply is clicked
  ; to { raw-id } $argv
  ; to clean-id !normalize-lane-id $raw-id
  [ match
   { $clean-id (
    ; to idx !find-selected-id-idx $clean-id
    [ match
     { [ propertyIsGreaterThan -1 idx ] : !modal.selected-ids.splice $idx 1 }
     { true : !modal.selected-ids.push $clean-id }
    ]
    !modal.render
   ) }
  ]
 )

 ; to modal.render-selected-chips (
  -- Renders the multiselect Selected (N) chips bar with one-click item removal
  !modal.clear-selected-chips
  [ match
   { [ propertyIs true modal.multiple ] (
    ; set false selected-section.hidden
    ; to sel-count $modal.selected-ids.length
    ; set [ ; add 'Selected (' ; add $sel-count ')' ] selected-label-el.textContent
    ; set [ ternary [ propertyIsGreaterThan 0 sel-count ] false true ] clear-btn.hidden
    ; set 'Clear all selected lanes' clear-btn.title
    [ match
     { [ propertyIs 0 sel-count ] (
      ; to none-el !document.createElement span
      ; assign $none-el { className lane-multiselect-empty } { textContent 'None selected' }
      !selected-chips-el.appendChild $none-el
      !modal.selected-chip-els.push $none-el
     ) }
     { true (
      ; each $modal.selected-ids (
       ; to { sid idx } $argv
       ; to stitle !lookup-known-title $sid
       ; to has-sep [ match
        { [ propertyIs '' stitle ] : false }
        { [ propertyIs $sid stitle ] : false }
        { true : true }
       ]
       ; to chip-el !document.createElement span
       ; set lane-multiselect-chip chip-el.className
       ; to lbl-el !document.createElement span
       ; assign $lbl-el { className lane-multiselect-chip-label } { textContent [ ternary $has-sep $stitle $sid ] }
       !chip-el.appendChild $lbl-el
       [ match
        { $has-sep (
         ; to cid-el !document.createElement span
         ; assign $cid-el { className lane-multiselect-chip-id } { textContent $sid }
         !chip-el.appendChild $cid-el
        ) }
       ]
       ; to rm-btn !document.createElement button
       ; assign $rm-btn { type button } { className lane-multiselect-chip-remove } { textContent '×' } { title [ ; add 'Remove ' [ ternary $has-sep $stitle $sid ] ] }
       !rm-btn.addEventListener click : !modal.toggle-id $sid
       !chip-el.appendChild $rm-btn
       !selected-chips-el.appendChild $chip-el
       !modal.selected-chip-els.push $chip-el
       !modal.selected-chips.push [ object
        { id $sid }
        { title $stitle }
        { index $idx }
        { el $chip-el }
        { label-el $lbl-el }
        { remove-btn $rm-btn }
       ]
      )
     ) }
    ]
   ) }
   { true (
    ; set true selected-section.hidden
   ) }
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
  -- Renders filtered known lanes with Open/Close or single/multi Select controls and package badges
  !modal.render-selected-chips
  ; set [ ternary $modal.multiple false true ] footer.hidden
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
      { [ propertyIs pick modal.mode ] [ match
       { [ propertyIs true modal.multiple ] (
        ; to sel-idx !find-selected-id-idx $entry.id
        ; to is-selected [ propertyIsGreaterThan -1 sel-idx ]
        ; set [ ternary $is-selected 'lane-modal-item lane-modal-item--selected lane-modal-item--multiselect' 'lane-modal-item lane-modal-item--multiselect' ] row-el.className
        !row-el.setAttribute aria-selected [ ternary $is-selected 'true' 'false' ]
        ; set $is-selected item-record.is-selected
        [ match
         { $is-selected (
          ; to sel-badge !document.createElement span
          ; assign $sel-badge { className 'lane-modal-badge lane-modal-badge--selected' } { textContent Selected }
          ; to item-remove-btn !document.createElement button
          ; assign $item-remove-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent Remove }
          !item-remove-btn.addEventListener click : !modal.toggle-id $entry.id
          !row-el.addEventListener click (
           ; to { ev } $argv
           ; to is-btn [ propertyIs $item-remove-btn ev.target ]
           ; condition { propertyIs false is-btn } : !modal.toggle-id $entry.id
          )
          !actions-el.appendChild $sel-badge
          !actions-el.appendChild $item-remove-btn
          ; set $item-remove-btn item-record.remove-btn
          ; set $item-remove-btn item-record.clear-btn
          ; set $item-remove-btn item-record.toggle-btn
         ) }
         { true (
          [ match
           { $open-lane (
            ; to badge !document.createElement span
            ; assign $badge { className lane-modal-badge } { textContent Open }
            !actions-el.appendChild $badge
           ) }
          ]
          ; to item-add-btn !document.createElement button
          ; assign $item-add-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent '+ Add' }
          !item-add-btn.addEventListener click : !modal.toggle-id $entry.id
          !row-el.addEventListener click (
           ; to { ev } $argv
           ; to is-btn [ propertyIs $item-add-btn ev.target ]
           ; condition { propertyIs false is-btn } : !modal.toggle-id $entry.id
          )
          !actions-el.appendChild $item-add-btn
          ; set $item-add-btn item-record.add-btn
          ; set $item-add-btn item-record.select-btn
          ; set $item-add-btn item-record.toggle-btn
         ) }
        ]
       ) }
       { true (
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
      ] }
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
        ; to item-locate-btn !document.createElement button
        ; assign $item-locate-btn { type button } { className 'lane-modal-action lane-modal-action--locate' } { textContent Locate }
        !item-locate-btn.addEventListener click (
         !modal.close
         [ match
          { $lane-control.locate-lane : !lane-control.locate-lane $entry.id }
          { $lane-control.locate : !lane-control.locate $entry.id }
         ]
        )
        !actions-el.appendChild $badge
        !actions-el.appendChild $item-close-btn
        !actions-el.appendChild $item-locate-btn
        ; set $item-close-btn item-record.close-btn
        ; set $item-locate-btn item-record.locate-btn
       ) }
       { true (
        ; to item-open-btn !document.createElement button
        ; assign $item-open-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Open }
        !item-open-btn.addEventListener click (
         [ match
          { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Loading…' }
         ]
         ; to opened null
         ; try (
          ; set [ !lane-control.open $entry.id ] opened
          !lane-control.update-url
         ) : null
         [ match
          { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
         ]
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
  ; condition { propertyIs true modal.is-open } (
   [ match
    { [ and { $modal.lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $modal.lane $modal }
   ]
  )
  ; to next-lane $modal.target-lane
  ; set $next-lane modal.lane
  ; set true modal.is-open
  [ match
   { [ and { $next-lane } { $lane-control.mount-lane-modal } ] : !lane-control.mount-lane-modal $next-lane $modal }
   { $next-lane.body.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-modal-backdrop--lane' backdrop.className
    !next-lane.body.appendChild $backdrop
   ) }
   { $lane-control.mount-lane-modal : !lane-control.mount-lane-modal null $modal }
   { $document.body.appendChild (
    ; set lane-modal-backdrop backdrop.className
    !document.body.appendChild $backdrop
   ) }
  ]
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
  ; set false modal.multiple
  ; set null modal.target-lane
  ; set 'Open Lane' heading.textContent
  ; set true clear-btn.hidden
  ; set 'Clear selected lane' clear-btn.title
  ; set null modal.selected-id
  ; set 0 modal.selected-ids.length
  ; set null modal.on-select
  !show-modal
 )

 ; to modal.open-picker (
  -- Loads all known lanes from KV and displays the modal in single or multiple Select Lane picker mode (scoped to opts.lane when provided)
  ; to { opts } $argv
  ; set pick modal.mode
  ; to is-multi [ ternary $opts.multiple true false ]
  ; set $is-multi modal.multiple
  ; to target-lane [ match
   { $opts.lane : $opts.lane }
   { [ and { $opts.lane-id } { $lane-control.resolve-lane } ] : !lane-control.resolve-lane $opts.lane-id }
   { $opts.lane-id : [ get lane-control.by-id $opts.lane-id ] }
   { true : null }
  ]
  ; set $target-lane modal.target-lane
  ; to picker-title [ match
   { $opts.title : $opts.title }
   { $is-multi : 'Select Lanes' }
   { true : 'Select Lane' }
  ]
  ; set $picker-title heading.textContent
  ; set 0 modal.selected-ids.length
  [ match
   { $is-multi (
    ; set null modal.selected-id
    ; to raw-list [ match
     { [ !window.Array.isArray $opts.current-values ] : $opts.current-values }
     { [ !window.Array.isArray $opts.current-value ] : $opts.current-value }
     { true : {} }
    ]
    ; each $raw-list (
     ; to { raw-item } $argv
     ; to clean-id !normalize-lane-id $raw-item
     [ match
      { $clean-id (
       ; to dup-idx !find-selected-id-idx $clean-id
       ; condition { propertyIs -1 dup-idx } : !modal.selected-ids.push $clean-id
      ) }
     ]
    )
    ; set [ ternary [ propertyIsGreaterThan 0 modal.selected-ids.length ] false true ] clear-btn.hidden
    ; set 'Clear all selected lanes' clear-btn.title
   ) }
   { true (
    ; to normalized-id !normalize-lane-id $opts.current-value
    ; set $normalized-id modal.selected-id
    ; set [ ternary $normalized-id false true ] clear-btn.hidden
    ; set 'Clear selected lane' clear-btn.title
   ) }
  ]
  ; set [ match { $opts.on-select : $opts.on-select } { true : null } ] modal.on-select
  !show-modal
 )

 !close-btn.addEventListener click $modal.close
 !cancel-btn.addEventListener click $modal.close
 !apply-btn.addEventListener click $modal.apply
 !clear-btn.addEventListener click (
  [ match
   { [ propertyIs true modal.multiple ] (
    ; set 0 modal.selected-ids.length
    !modal.render
   ) }
   { true : !emit-selection null }
  ]
 )
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
