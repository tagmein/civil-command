-- file lane-rails.fs
; to scope ; object
; to scope.create (
 -- Creates always-open fixed top, left, and right rails and a floating non-interactive hover preview for minimized lanes
 ; to { lane-control } $argv
 ; to fs-enter-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M1.5 3.5V1.5H3.5M6.5 1.5H8.5V3.5M8.5 6.5V8.5H6.5M3.5 8.5H1.5V6.5"></path></svg>'
 ; to fs-exit-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--fullscreen-exit" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M1.5 3.5H3.5V1.5M6.5 1.5V3.5H8.5M8.5 6.5H6.5V8.5M3.5 8.5V6.5H1.5"></path></svg>'
 ; to search-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--search" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4.25" cy="4.25" r="2.5"></circle><path d="M6.05 6.05L8.6 8.6"></path></svg>'
 ; to session-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--session" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="2.75" cy="2.5" r="1.25"></circle><circle cx="7.25" cy="2.5" r="1.25"></circle><circle cx="2.75" cy="7.5" r="1.25"></circle><path d="M2.75 3.75V6.25M7.25 3.75C7.25 5.3 5.5 5.5 2.75 5.5"></path></svg>'
 ; to packages-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--packages" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 1.4L8.5 3.2L5 5L1.5 3.2Z"></path><path d="M1.5 5L5 6.8L8.5 5"></path><path d="M1.5 6.8L5 8.6L8.5 6.8"></path></svg>'
 ; to wrench-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--preferences" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M8.6 3.3A2.1 2.1 0 0 1 5.7 5.5L2.5 8.7A0.85 0.85 0 0 1 1.3 7.5L4.5 4.3A2.1 2.1 0 0 1 6.7 1.4L5.6 2.5L7.5 4.4Z"></path></svg>'

 ; to top-rail !document.createElement aside
 ; set top-rail top-rail.className
 !top-rail.setAttribute role region
 !top-rail.setAttribute aria-label 'Top command rail'

 ; to fullscreen-btn !document.createElement button
 ; assign $fullscreen-btn { type button } { className 'top-rail-icon top-rail-icon--fullscreen' } { textContent '' }

 ; to search-btn !document.createElement button
 ; assign $search-btn { type button } { className 'top-rail-icon top-rail-icon--search' } { textContent '' } { title 'Open lane' } { innerHTML $search-svg }
 !search-btn.setAttribute aria-label 'Open lane'

 ; to session-btn !document.createElement button
 ; assign $session-btn { type button } { className 'top-rail-icon top-rail-icon--session' } { textContent '' } { title Sessions } { innerHTML $session-svg }
 !session-btn.setAttribute aria-label Sessions
 !session-btn.setAttribute aria-haspopup menu
 !session-btn.setAttribute aria-expanded 'false'

 ; to packages-btn !document.createElement button
 ; assign $packages-btn { type button } { className 'top-rail-icon top-rail-icon--packages' } { textContent '' } { title Packages } { innerHTML $packages-svg }
 !packages-btn.setAttribute aria-label Packages
 !packages-btn.setAttribute aria-haspopup menu
 !packages-btn.setAttribute aria-expanded 'false'

 ; to preferences-btn !document.createElement button
 ; assign $preferences-btn { type button } { className 'top-rail-icon top-rail-icon--preferences' } { textContent '' } { title Preferences } { innerHTML $wrench-svg }
 !preferences-btn.setAttribute aria-label Preferences
 !preferences-btn.setAttribute aria-haspopup menu
 !preferences-btn.setAttribute aria-expanded 'false'

 !top-rail.appendChild $fullscreen-btn
 !top-rail.appendChild $search-btn
 !top-rail.appendChild $session-btn
 !top-rail.appendChild $packages-btn
 !top-rail.appendChild $preferences-btn

 ; to session-menu !document.createElement div
 ; assign $session-menu { className 'top-rail-menu top-rail-menu--session' } { hidden true }
 !session-menu.setAttribute role menu
 !session-menu.setAttribute aria-label 'Sessions menu'

 ; to session-status-el !document.createElement div
 ; assign $session-status-el { className top-rail-menu-status } { textContent 'Session' }

 ; to session-draft-row !document.createElement div
 ; assign $session-draft-row { className top-rail-menu-draft-row } { hidden true }
 ; to session-save-btn !document.createElement button
 ; assign $session-save-btn { type button } { className 'top-rail-menu-chip top-rail-menu-chip--save' } { textContent Save }
 ; to session-draft-fork-btn !document.createElement button
 ; assign $session-draft-fork-btn { type button } { className top-rail-menu-chip } { textContent Fork }
 ; to session-abandon-btn !document.createElement button
 ; assign $session-abandon-btn { type button } { className 'top-rail-menu-chip top-rail-menu-chip--danger' } { textContent Abandon }
 !session-draft-row.appendChild $session-save-btn
 !session-draft-row.appendChild $session-draft-fork-btn
 !session-draft-row.appendChild $session-abandon-btn

 ; to session-new-btn !document.createElement button
 ; assign $session-new-btn { type button } { className 'top-rail-menu-item top-rail-menu-item--primary' } { textContent '+ New session' }
 !session-new-btn.setAttribute role menuitem

 ; to session-fork-btn !document.createElement button
 ; assign $session-fork-btn { type button } { className top-rail-menu-item } { textContent 'Fork current session' }
 !session-fork-btn.setAttribute role menuitem

 ; to session-manage-btn !document.createElement button
 ; assign $session-manage-btn { type button } { className top-rail-menu-item } { textContent 'Open / switch session…' }
 !session-manage-btn.setAttribute role menuitem

 ; to session-history-btn !document.createElement button
 ; assign $session-history-btn { type button } { className top-rail-menu-item } { textContent 'Session history…' }
 !session-history-btn.setAttribute role menuitem

 ; to session-recent-div !document.createElement div
 ; assign $session-recent-div { className top-rail-menu-divider } { hidden true }

 ; to session-recent-title !document.createElement div
 ; assign $session-recent-title { className top-rail-menu-section-title } { textContent 'Switch session' } { hidden true }

 ; to session-recent-el !document.createElement div
 ; set top-rail-menu-pkgs session-recent-el.className

 !session-menu.appendChild $session-status-el
 !session-menu.appendChild $session-draft-row
 !session-menu.appendChild $session-new-btn
 !session-menu.appendChild $session-fork-btn
 !session-menu.appendChild $session-manage-btn
 !session-menu.appendChild $session-history-btn
 !session-menu.appendChild $session-recent-div
 !session-menu.appendChild $session-recent-title
 !session-menu.appendChild $session-recent-el

 ; to packages-menu !document.createElement div
 ; assign $packages-menu { className 'top-rail-menu top-rail-menu--packages' } { hidden true }
 !packages-menu.setAttribute role menu
 !packages-menu.setAttribute aria-label 'Packages menu'

 ; to pkg-menu-title !document.createElement div
 ; assign $pkg-menu-title { className top-rail-menu-section-title } { textContent 'Included packages' }

 ; to pkg-menu-list !document.createElement div
 ; set top-rail-menu-pkgs pkg-menu-list.className

 ; to pkg-menu-div !document.createElement div
 ; set top-rail-menu-divider pkg-menu-div.className

 ; to pkg-create-btn !document.createElement button
 ; assign $pkg-create-btn { type button } { className 'top-rail-menu-item top-rail-menu-item--primary' } { textContent '+ Create package…' }
 !pkg-create-btn.setAttribute role menuitem

 ; to pkg-open-btn !document.createElement button
 ; assign $pkg-open-btn { type button } { className top-rail-menu-item } { textContent 'Open package by ID…' }
 !pkg-open-btn.setAttribute role menuitem

 ; to pkg-page-btn !document.createElement button
 ; assign $pkg-page-btn { type button } { className top-rail-menu-item } { textContent 'Packages page…' }
 !pkg-page-btn.setAttribute role menuitem

 !packages-menu.appendChild $pkg-menu-title
 !packages-menu.appendChild $pkg-menu-list
 !packages-menu.appendChild $pkg-menu-div
 !packages-menu.appendChild $pkg-create-btn
 !packages-menu.appendChild $pkg-open-btn
 !packages-menu.appendChild $pkg-page-btn

 ; to pref-menu !document.createElement div
 ; assign $pref-menu { className 'top-rail-menu top-rail-menu--preferences' } { hidden true }
 !pref-menu.setAttribute role menu
 !pref-menu.setAttribute aria-label 'Preferences menu'

 ; to pref-status-el !document.createElement div
 ; assign $pref-status-el { className top-rail-menu-status } { textContent 'No preferences lane set' }

 ; to pref-open-btn !document.createElement button
 ; assign $pref-open-btn { type button } { className 'top-rail-menu-item top-rail-menu-item--primary' } { textContent 'Open preferences lane' } { hidden true }
 !pref-open-btn.setAttribute role menuitem

 ; to pref-set-btn !document.createElement button
 ; assign $pref-set-btn { type button } { className top-rail-menu-item } { textContent 'Set preferences lane' }
 !pref-set-btn.setAttribute role menuitem

 ; to pref-create-btn !document.createElement button
 ; assign $pref-create-btn { type button } { className top-rail-menu-item } { textContent 'Create preference lane' }
 !pref-create-btn.setAttribute role menuitem

 !pref-menu.appendChild $pref-status-el
 !pref-menu.appendChild $pref-open-btn
 !pref-menu.appendChild $pref-set-btn
 !pref-menu.appendChild $pref-create-btn

 ; to left-rail !document.createElement aside
 ; set 'side-rail side-rail--left' left-rail.className
 !left-rail.setAttribute role region
 !left-rail.setAttribute aria-label 'Left minimized lanes rail'

 ; to right-rail !document.createElement aside
 ; set 'side-rail side-rail--right' right-rail.className
 !right-rail.setAttribute role region
 !right-rail.setAttribute aria-label 'Right minimized lanes rail'

 ; to preview-el !document.createElement div
 ; set side-rail-preview preview-el.className
 !preview-el.setAttribute aria-hidden 'true'
 ; set true preview-el.hidden

 ; to preview-frame !document.createElement div
 ; set side-rail-preview-frame preview-frame.className
 ; to preview-header !document.createElement div
 ; set 'side-rail-preview-header lane-header' preview-header.className
 ; to preview-body !document.createElement div
 ; set 'side-rail-preview-body lane-body' preview-body.className
 !preview-frame.appendChild $preview-header
 !preview-frame.appendChild $preview-body
 !preview-el.appendChild $preview-frame

 [ match
  { $document.body (
   !document.body.appendChild $top-rail
   !document.body.appendChild $session-menu
   !document.body.appendChild $packages-menu
   !document.body.appendChild $pref-menu
   !document.body.appendChild $left-rail
   !document.body.appendChild $right-rail
   !document.body.appendChild $preview-el
  ) }
 ]

 ; to rails [ object
  { top-rail $top-rail }
  { fullscreen-btn $fullscreen-btn }
  { search-btn $search-btn }
  { session-btn $session-btn }
  { session-menu $session-menu }
  { session-status-el $session-status-el }
  { session-draft-row $session-draft-row }
  { session-save-btn $session-save-btn }
  { session-draft-fork-btn $session-draft-fork-btn }
  { session-abandon-btn $session-abandon-btn }
  { session-new-btn $session-new-btn }
  { session-fork-btn $session-fork-btn }
  { session-manage-btn $session-manage-btn }
  { session-history-btn $session-history-btn }
  { session-recent-el $session-recent-el }
  { session-recent-els {} }
  { session-recent-items {} }
  { is-session-open false }
  { packages-btn $packages-btn }
  { packages-menu $packages-menu }
  { pkg-menu-list $pkg-menu-list }
  { pkg-create-btn $pkg-create-btn }
  { pkg-open-btn $pkg-open-btn }
  { pkg-page-btn $pkg-page-btn }
  { pkg-els {} }
  { pkg-items {} }
  { is-packages-open false }
  { preferences-btn $preferences-btn }
  { preferences-menu $pref-menu }
  { preferences-status-el $pref-status-el }
  { preferences-open-btn $pref-open-btn }
  { preferences-set-btn $pref-set-btn }
  { preferences-create-btn $pref-create-btn }
  { is-fullscreen false }
  { is-preferences-open false }
  { left-rail $left-rail }
  { right-rail $right-rail }
  { preview-el $preview-el }
  { preview-frame $preview-frame }
  { preview-header $preview-header }
  { preview-body $preview-body }
  { left-items {} }
  { right-items {} }
  { by-id ; object }
  { preview-lane null }
 ]

 ; to sync-preview-width (
  -- Applies or clears lane width classes and custom properties on the floating preview containers
  ; to { rendered } $argv
  ; to has-width [ match
   { [ propertyIs null rendered ] : false }
   { [ propertyIs undefined rendered ] : false }
   { true : true }
  ]
  ; to px-str [ match
   { $has-width : ; add $rendered px }
   { true : '' }
  ]
  ; set [ ternary $has-width 'side-rail-preview-header lane-header lane-header--sized' 'side-rail-preview-header lane-header' ] preview-header.className
  ; set [ ternary $has-width 'side-rail-preview-body lane-body lane-body--sized' 'side-rail-preview-body lane-body' ] preview-body.className
  ; each { $preview-header $preview-body } (
   ; to { box } $argv
   [ match
    { $box.style (
     ; set $px-str box.style.width
     ; set $px-str box.style.maxWidth
     ; set [ ternary $has-width 100px '' ] box.style.minWidth
     [ match
      { $box.style.setProperty (
       [ match
        { $has-width : !box.style.setProperty '--lane-width' $px-str }
        { true (
         [ match
          { $box.style.removeProperty : !box.style.removeProperty '--lane-width' }
         ]
        ) }
       ]
      ) }
      { true : ; set $px-str box.style.--lane-width }
     ]
    ) }
   ]
  )
 )

 ; to restore-node (
  -- Re-inserts a previewed child node back into its owning container before an optional reference node
  ; to { container node ref } $argv
  [ match
   { $container (
    [ match
     { $node (
      [ match
       { $ref (
        [ match
         { $container.insertBefore : !container.insertBefore $node $ref }
         { true : !container.appendChild $node }
        ]
       ) }
       { true : !container.appendChild $node }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to rails.hide-preview (
  -- Hides the floating hover preview and returns the live lane DOM nodes back to their owning lane cells
  ; to lane $rails.preview-lane
  [ match
   { $lane (
    ; set null rails.preview-lane
    !restore-node $lane.element $lane.header-top $lane.header-resizer
    [ match
     { $lane.body (
      ; to body-ref [ match
       { $lane.body-resizer : $lane.body-resizer }
       { $lane.minimized-placeholder : $lane.minimized-placeholder }
       { true : null }
      ]
      [ match
       { $lane.notebook.element : !restore-node $lane.body $lane.notebook.element $body-ref }
      ]
      [ match
       { $lane.notebook.output-view.element : !restore-node $lane.body $lane.notebook.output-view.element $body-ref }
      ]
     ) }
    ]
    !sync-preview-width null
    ; set side-rail-preview preview-el.className
    ; set true preview-el.hidden
   ) }
  ]
 )

 ; to rails.show-preview (
  -- Shows a floating non-interactive preview of a minimized lane anchored next to its rail icon
  ; to { lane icon-el side } $argv
  [ match
   { $lane (
    ; condition { propertyIs true lane.is-minimized } (
     !rails.hide-preview
     ; set $lane rails.preview-lane
     !sync-preview-width $lane.rendered-width
     [ match
      { $lane.header-top : !preview-header.appendChild $lane.header-top }
     ]
     [ match
      { $lane.notebook.element : !preview-body.appendChild $lane.notebook.element }
     ]
     [ match
      { $lane.notebook.output-view.element : !preview-body.appendChild $lane.notebook.output-view.element }
     ]
     ; to side-cls ; add 'side-rail-preview side-rail-preview--' $side
     ; set $side-cls preview-el.className
     ; set false preview-el.hidden
     ; to desired-top [ match
      { $icon-el.getBoundingClientRect (
       ; to rect !icon-el.getBoundingClientRect
       [ match
        { [ propertyIsGreaterThanOrEqual 0 rect.top ] : $rect.top }
        { true : 24 }
       ]
      ) }
      { true : 24 }
     ]
     ; to clamped-top [ match
      { $preview-el.getBoundingClientRect (
       [ match
        { [ propertyIsGreaterThan 0 window.innerHeight ] (
         ; to prect !preview-el.getBoundingClientRect
         ; to ph [ match
          { [ propertyIsGreaterThan 0 prect.height ] : $prect.height }
          { true : 0 }
         ]
         ; to raw-max ; subtract [ ; subtract $window.innerHeight $ph ] 8
         ; to max-top !window.Math.max 24 $raw-max
         !window.Math.max 24 [ !window.Math.min $desired-top $max-top ]
        ) }
        { true : !window.Math.max 24 $desired-top }
       ]
      ) }
      { true : !window.Math.max 24 $desired-top }
     ]
     [ match
      { $preview-el.style : ; set [ ; add [ !window.Math.round $clamped-top ] px ] preview-el.style.top }
     ]
    )
   ) }
  ]
 )

 ; to rails.update (
  -- Refreshes a minimized lane's rail icon initial and accessible labels after a title change
  ; to { lane } $argv
  [ match
   { $lane (
    ; to item [ get rails.by-id $lane.id ]
    [ match
     { $item (
      ; to initial !getLaneInitial $lane.title $lane.id
      ; set $initial item.icon-el.textContent
      ; set $lane.title item.icon-el.title
      !item.icon-el.setAttribute aria-label [ ; add 'Restore ' $lane.title ]
     ) }
    ]
   ) }
  ]
 )

 ; to rails.remove (
  -- Removes a minimized lane's icon from whichever rail holds it and hides its preview if active
  ; to { id } $argv
  [ match
   { $rails.preview-lane (
    ; condition { propertyIs $id rails.preview-lane.id } : !rails.hide-preview
   ) }
  ]
  ; to item [ get rails.by-id $id ]
  [ match
   { $item (
    !item.icon-el.remove
    ; to list [ ternary [ propertyIs left item.side ] $rails.left-items $rails.right-items ]
    ; to idx !list.indexOf $item
    ; condition { propertyIsGreaterThanOrEqual 0 idx } : !list.splice $idx 1
    !window.Reflect.deleteProperty $rails.by-id $id
   ) }
  ]
  $item
 )

 ; to rails.add (
  -- Adds or moves a minimized lane's 26px initial icon into the left or right rail
  ; to { lane raw-side } $argv
  ; to side !normalizeLaneMinimizeSide $raw-side
  [ match
   { $lane (
    [ match
     { $side (
      ; to existing [ get rails.by-id $lane.id ]
      [ match
       { $existing (
        [ match
         { [ propertyIs $side existing.side ] (
          !rails.update $lane
          $existing
         ) }
         { true (
          !rails.remove $lane.id
          !rails.add $lane $side
         ) }
        ]
       ) }
       { true (
        ; to initial !getLaneInitial $lane.title $lane.id
        ; to icon-el !document.createElement button
        ; assign $icon-el { type button } { className side-rail-icon } { textContent $initial } { title $lane.title }
        !icon-el.setAttribute data-lane-id $lane.id
        !icon-el.setAttribute data-rail-side $side
        !icon-el.setAttribute aria-label [ ; add 'Restore ' $lane.title ]
        !icon-el.addEventListener mouseenter : !rails.show-preview $lane $icon-el $side
        !icon-el.addEventListener mouseleave (
         ; condition { propertyIs $lane rails.preview-lane } : !rails.hide-preview
        )
        !icon-el.addEventListener click : !lane-control.restore $lane.id
        ; to target-rail [ ternary [ propertyIs left side ] $left-rail $right-rail ]
        ; to target-list [ ternary [ propertyIs left side ] $rails.left-items $rails.right-items ]
        !target-rail.appendChild $icon-el
        ; to item [ object { lane $lane } { side $side } { icon-el $icon-el } ]
        !target-list.push $item
        ; to rails.by-id $lane.id $item
        $item
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to rails.clear (
  -- Clears all minimized rail icons and hides any active hover preview
  !rails.hide-preview
  ; while { propertyIsGreaterThan 0 rails.left-items.length } (
   ; to item !rails.left-items.pop
   !item.icon-el.remove
  )
  ; while { propertyIsGreaterThan 0 rails.right-items.length } (
   ; to item !rails.right-items.pop
   !item.icon-el.remove
  )
  ; to rails.by-id ; object
 )

 ; to is-fullscreen (
  -- Returns true when the document is currently in fullscreen mode
  [ match
   { $document.fullscreenElement : true }
   { $document.webkitFullscreenElement : true }
   { true : false }
  ]
 )

 ; to rails.sync-fullscreen (
  -- Syncs the top-rail fullscreen button icon and accessibility attributes with current fullscreen state
  ; to active !is-fullscreen
  ; set $active rails.is-fullscreen
  ; to label [ ternary $active 'Exit full screen' 'Full screen' ]
  ; to icon-html [ ternary $active $fs-exit-svg $fs-enter-svg ]
  ; assign $fullscreen-btn { innerHTML $icon-html } { title $label }
  !fullscreen-btn.setAttribute aria-label $label
  !fullscreen-btn.setAttribute aria-pressed [ ternary $active 'true' 'false' ]
  !fullscreen-btn.setAttribute data-fullscreen [ ternary $active 'true' 'false' ]
  $active
 )

 ; to rails.toggle-fullscreen (
  -- Toggles fullscreen on the root html element (document.documentElement) and syncs the corner icon
  ; to active !is-fullscreen
  ; try (
   [ match
    { $active (
     [ match
      { $document.exitFullscreen : !document.exitFullscreen }
      { $document.webkitExitFullscreen : !document.webkitExitFullscreen }
     ]
    ) }
    { true (
     ; to root $document.documentElement
     [ match
      { $root (
       [ match
        { $root.requestFullscreen : !root.requestFullscreen }
        { $root.webkitRequestFullscreen : !root.webkitRequestFullscreen }
       ]
      ) }
     ]
    ) }
   ]
  ) : null
  !rails.sync-fullscreen
 )

 ; to is-node-inside (
  -- Returns true when target equals root or is contained inside root
  ; to { root target } $argv
  [ match
   { [ propertyIs $root target ] : true }
   { $root.contains : !root.contains $target }
   { true : false }
  ]
 )

 ; to sync-session-btn-class (
  ; to dirty [ propertyIs true lane-control.session-dirty ]
  ; to base [ match
   { $rails.is-session-open : 'top-rail-icon top-rail-icon--session top-rail-icon--active' }
   { true : 'top-rail-icon top-rail-icon--session' }
  ]
  ; set [ ternary $dirty [ ; add $base ' top-rail-icon--dirty' ] $base ] session-btn.className
 )

 ; to rails.sync-session-menu (
  -- Syncs the dedicated Sessions dropdown status, draft Save/Fork/Abandon row, and 1-click recent sessions
  ; to sid $lane-control.session-id
  ; to sname [ match
   { $lane-control.session-meta.name : $lane-control.session-meta.name }
   { $sid : $sid }
   { true : Session }
  ]
  ; to ver [ match
   { $lane-control.session-meta.version : ; add v $lane-control.session-meta.version }
   { true : v1 }
  ]
  ; to dirty [ propertyIs true lane-control.session-dirty ]
  ; to status-txt [ match
   { $dirty : ; add $sname ; add ' · ' ; add $ver '* (unsaved)' }
   { true : ; add $sname ; add ' · ' $ver }
  ]
  ; to status-ttl [ match
   { $sid : ; add $sname ; add ' (' ; add $sid ')' }
   { true : Session }
  ]
  ; set $status-txt session-status-el.textContent
  ; set $status-ttl session-status-el.title
  ; set [ ternary $dirty false true ] session-draft-row.hidden
  !sync-session-btn-class

  ; while { propertyIsGreaterThan 0 rails.session-recent-els.length } (
   ; to old-el !rails.session-recent-els.pop
   !old-el.remove
  )
  ; set 0 rails.session-recent-items.length

  ; to recents [ match
   { $lane-control.recent-sessions : $lane-control.recent-sessions }
   { true : {} }
  ]
  ; to shown ; object { count 0 }
  ; each $recents (
   ; to { rec } $argv
   ; to is-cur [ propertyIs $sid rec.id ]
   ; condition { propertyIs false is-cur } (
    ; condition { propertyIsLessThan 5 shown.count } (
     ; set [ ; add $shown.count 1 ] shown.count
     ; to rec-name [ match { $rec.name : $rec.name } { true : $rec.id } ]
     ; to rbtn !document.createElement button
     ; assign $rbtn { type button } { className top-rail-menu-item } { textContent $rec-name } { title [ ; add 'Switch to ' $rec.id ] }
     !rbtn.setAttribute role menuitem
     !rbtn.addEventListener click (
      !rails.close-session-menu
      [ match
       { $lane-control.switch-session : !lane-control.switch-session $rec.id }
      ]
     )
     !session-recent-el.appendChild $rbtn
     !rails.session-recent-els.push $rbtn
     !rails.session-recent-items.push ; object { rec $rec } { btn $rbtn }
    )
   )
  )
  ; to has-recents [ propertyIsGreaterThan 0 shown.count ]
  ; set [ ternary $has-recents false true ] session-recent-div.hidden
  ; set [ ternary $has-recents false true ] session-recent-title.hidden
 )

 ; to rails.close-session-menu (
  -- Closes the Sessions dropdown menu
  ; set true session-menu.hidden
  ; set false rails.is-session-open
  !sync-session-btn-class
  !session-btn.setAttribute aria-expanded 'false'
 )

 ; to rails.open-session-menu (
  -- Opens the Sessions dropdown menu anchored under the session button
  !rails.close-packages-menu
  !rails.close-preferences-menu
  [ match
   { $lane-control.ensure-session : !lane-control.ensure-session }
  ]
  ; set true rails.is-session-open
  !rails.sync-session-menu
  [ match
   { $session-btn.getBoundingClientRect (
    ; to rect !session-btn.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] (
      ; to half ; divide $rect.width 2
      ; to center-x !window.Math.round ; add $rect.left $half
      [ match
       { $session-menu.style : ; set [ ; add $center-x px ] session-menu.style.left }
      ]
     ) }
    ]
   ) }
  ]
  ; set false session-menu.hidden
  !session-btn.setAttribute aria-expanded 'true'
 )

 ; to rails.toggle-session-menu (
  -- Toggles the Sessions dropdown menu open or closed
  [ match
   { $rails.is-session-open : !rails.close-session-menu }
   { true : !rails.open-session-menu }
  ]
 )

 ; to rails.sync-packages-menu (
  -- Syncs the dedicated Packages dropdown with the current session's included packages
  ; while { propertyIsGreaterThan 0 rails.pkg-els.length } (
   ; to old-el !rails.pkg-els.pop
   !old-el.remove
  )
  ; set 0 rails.pkg-items.length

  ; to pkgs [ match
   { $lane-control.open-packages : $lane-control.open-packages }
   { true : {} }
  ]
  ; each $pkgs (
   ; to { pkg } $argv
   ; to row !document.createElement div
   ; set top-rail-menu-pkg-row row.className
   ; to is-active [ propertyIs $lane-control.active-package-id pkg.id ]
   ; to dot-btn !document.createElement button
   ; assign $dot-btn { type button } { className [ ternary $is-active 'top-rail-menu-pkg-dot top-rail-menu-pkg-dot--active' top-rail-menu-pkg-dot ] } { textContent [ ternary $is-active '●' '○' ] } { title [ ternary $is-active 'Active package' 'Set active package' ] }
   !dot-btn.addEventListener click (
    [ match
     { $lane-control.set-active-package : !lane-control.set-active-package $pkg.id }
    ]
   )
   ; to btn-cls [ ternary $is-active 'top-rail-menu-item top-rail-menu-pkg-btn top-rail-menu-pkg-btn--active' 'top-rail-menu-item top-rail-menu-pkg-btn' ]
   ; to pkg-btn !document.createElement button
   ; assign $pkg-btn { type button } { className $btn-cls } { textContent $pkg.name } { title [ ; add 'Open package page: ' $pkg.id ] }
   !pkg-btn.setAttribute role menuitem
   !pkg-btn.addEventListener click (
    !rails.close-packages-menu
    [ match
     { $lane-control.package-modal.open-packages : !lane-control.package-modal.open-packages $pkg.id }
    ]
   )
   ; to close-pkg-btn !document.createElement button
   ; assign $close-pkg-btn { type button } { className top-rail-menu-pkg-close } { textContent '×' } { title [ ; add 'Close package ' $pkg.name ] }
   !close-pkg-btn.setAttribute aria-label [ ; add 'Close package ' $pkg.name ]
   !close-pkg-btn.addEventListener click (
    [ match
     { $lane-control.close-package : !lane-control.close-package $pkg.id }
    ]
   )
   !row.appendChild $dot-btn
   !row.appendChild $pkg-btn
   !row.appendChild $close-pkg-btn
   !pkg-menu-list.appendChild $row
   !rails.pkg-els.push $row
   !rails.pkg-items.push ; object { pkg $pkg } { row $row } { dot-btn $dot-btn } { btn $pkg-btn } { close-btn $close-pkg-btn } { active $is-active }
  )
 )

 ; to rails.close-packages-menu (
  -- Closes the Packages dropdown menu
  ; set true packages-menu.hidden
  ; set false rails.is-packages-open
  ; set 'top-rail-icon top-rail-icon--packages' packages-btn.className
  !packages-btn.setAttribute aria-expanded 'false'
 )

 ; to rails.open-packages-menu (
  -- Opens the Packages dropdown menu anchored under the packages button
  !rails.close-session-menu
  !rails.close-preferences-menu
  [ match
   { $lane-control.ensure-session : !lane-control.ensure-session }
  ]
  !rails.sync-packages-menu
  [ match
   { $packages-btn.getBoundingClientRect (
    ; to rect !packages-btn.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] (
      ; to half ; divide $rect.width 2
      ; to center-x !window.Math.round ; add $rect.left $half
      [ match
       { $packages-menu.style : ; set [ ; add $center-x px ] packages-menu.style.left }
      ]
     ) }
    ]
   ) }
  ]
  ; set false packages-menu.hidden
  ; set true rails.is-packages-open
  ; set 'top-rail-icon top-rail-icon--packages top-rail-icon--active' packages-btn.className
  !packages-btn.setAttribute aria-expanded 'true'
 )

 ; to rails.toggle-packages-menu (
  -- Toggles the Packages dropdown menu open or closed
  [ match
   { $rails.is-packages-open : !rails.close-packages-menu }
   { true : !rails.open-packages-menu }
  ]
 )

 ; to rails.sync-preferences-menu (
  -- Syncs the preferences dropdown label and Open preferences lane visibility with global active preferences lane
  ; to pref-id $lane-control.preferences-lane-id
  [ match
   { $pref-id (
    ; to pref-title [ match
     { $lane-control.get-lane-title : !lane-control.get-lane-title $pref-id }
     { true : $pref-id }
    ]
    ; to status-txt ; add 'Preferences: ' $pref-title
    ; to status-ttl ; add $pref-title ; add ' (' ; add $pref-id ')'
    ; set $status-txt pref-status-el.textContent
    ; set $status-ttl pref-status-el.title
    ; set false pref-open-btn.hidden
   ) }
   { true (
    ; set 'No preferences lane set' pref-status-el.textContent
    ; set '' pref-status-el.title
    ; set true pref-open-btn.hidden
   ) }
  ]
 )

 ; to rails.close-preferences-menu (
  -- Closes the preferences dropdown menu
  ; set true pref-menu.hidden
  ; set false rails.is-preferences-open
  ; set 'top-rail-icon top-rail-icon--preferences' preferences-btn.className
  !preferences-btn.setAttribute aria-expanded 'false'
 )

 ; to rails.open-preferences-menu (
  -- Refreshes and opens the preferences dropdown menu anchored under the wrench button
  !rails.close-session-menu
  !rails.close-packages-menu
  [ match
   { $lane-control.load-catalog : !lane-control.load-catalog }
  ]
  !rails.sync-preferences-menu
  [ match
   { $preferences-btn.getBoundingClientRect (
    ; to rect !preferences-btn.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] (
      ; to half ; divide $rect.width 2
      ; to center-x !window.Math.round ; add $rect.left $half
      [ match
       { $pref-menu.style : ; set [ ; add $center-x px ] pref-menu.style.left }
      ]
     ) }
    ]
   ) }
  ]
  ; set false pref-menu.hidden
  ; set true rails.is-preferences-open
  ; set 'top-rail-icon top-rail-icon--preferences top-rail-icon--active' preferences-btn.className
  !preferences-btn.setAttribute aria-expanded 'true'
 )

 ; to rails.toggle-preferences-menu (
  -- Toggles the preferences dropdown menu open or closed
  [ match
   { $rails.is-preferences-open : !rails.close-preferences-menu }
   { true : !rails.open-preferences-menu }
  ]
 )

 !fullscreen-btn.addEventListener click (
  !rails.close-preferences-menu
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.toggle-fullscreen
 )
 !search-btn.addEventListener click (
  !rails.close-preferences-menu
  !rails.close-session-menu
  !rails.close-packages-menu
  [ match
   { $lane-control.lane-modal.open : !lane-control.lane-modal.open }
  ]
 )
 !session-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.toggle-session-menu
 )
 !session-save-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.save-session-draft : !lane-control.save-session-draft }
  ]
 )
 !session-draft-fork-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.fork-session : !lane-control.fork-session }
  ]
 )
 !session-abandon-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.abandon-session-draft : !lane-control.abandon-session-draft }
  ]
 )
 !session-new-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.new-session : !lane-control.new-session }
  ]
 )
 !session-fork-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.fork-session : !lane-control.fork-session }
  ]
 )
 !session-manage-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.session-modal.open-switch-session : !lane-control.session-modal.open-switch-session }
  ]
 )
 !session-history-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.session-modal.open-history : !lane-control.session-modal.open-history }
  ]
 )
 !packages-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.toggle-packages-menu
 )
 !pkg-create-btn.addEventListener click (
  !rails.close-packages-menu
  [ match
   { $lane-control.package-modal.open-create-package : !lane-control.package-modal.open-create-package }
  ]
 )
 !pkg-open-btn.addEventListener click (
  !rails.close-packages-menu
  [ match
   { $lane-control.package-modal.open-unlock-package : !lane-control.package-modal.open-unlock-package }
  ]
 )
 !pkg-page-btn.addEventListener click (
  !rails.close-packages-menu
  [ match
   { $lane-control.package-modal.open-packages : !lane-control.package-modal.open-packages }
  ]
 )
 !preferences-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.toggle-preferences-menu
 )
 !pref-open-btn.addEventListener click (
  !rails.close-preferences-menu
  [ match
   { $lane-control.open-preferences-lane : !lane-control.open-preferences-lane }
  ]
 )
 !pref-set-btn.addEventListener click (
  !rails.close-preferences-menu
  [ match
   { $lane-control.pick-lane (
    ; to pick-opts [ object
     { title 'Set Preferences Lane' }
     { current-value $lane-control.preferences-lane-id }
     { on-select (
      ; to { chosen-id } $argv
      [ match
       { $lane-control.set-preferences-lane : !lane-control.set-preferences-lane $chosen-id }
      ]
     ) }
    ]
    !lane-control.pick-lane $pick-opts
   ) }
  ]
 )
 !pref-create-btn.addEventListener click (
  !rails.close-preferences-menu
  [ match
   { $lane-control.create-preferences-lane : !lane-control.create-preferences-lane }
  ]
 )
 [ match
  { $document.addEventListener (
   !document.addEventListener fullscreenchange $rails.sync-fullscreen
   !document.addEventListener webkitfullscreenchange $rails.sync-fullscreen
   !document.addEventListener click (
    ; to { ev } $argv
    ; to target [ match
     { $ev.target : $ev.target }
     { true : null }
    ]
    ; condition { propertyIs true rails.is-preferences-open } (
     ; to in-menu [ match
      { $target : !is-node-inside $pref-menu $target }
      { true : false }
     ]
     ; to in-btn [ match
      { $target : !is-node-inside $preferences-btn $target }
      { true : false }
     ]
     ; condition { propertyIs false in-menu } (
      ; condition { propertyIs false in-btn } : !rails.close-preferences-menu
     )
    )
    ; condition { propertyIs true rails.is-session-open } (
     ; to in-smenu [ match
      { $target : !is-node-inside $session-menu $target }
      { true : false }
     ]
     ; to in-sbtn [ match
      { $target : !is-node-inside $session-btn $target }
      { true : false }
     ]
     ; condition { propertyIs false in-smenu } (
      ; condition { propertyIs false in-sbtn } : !rails.close-session-menu
     )
    )
    ; condition { propertyIs true rails.is-packages-open } (
     ; to in-pmenu [ match
      { $target : !is-node-inside $packages-menu $target }
      { true : false }
     ]
     ; to in-pbtn [ match
      { $target : !is-node-inside $packages-btn $target }
      { true : false }
     ]
     ; condition { propertyIs false in-pmenu } (
      ; condition { propertyIs false in-pbtn } : !rails.close-packages-menu
     )
    )
   )
  ) }
 ]
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs Escape ev.key } (
     ; condition { propertyIs true rails.is-preferences-open } : !rails.close-preferences-menu
     ; condition { propertyIs true rails.is-session-open } : !rails.close-session-menu
     ; condition { propertyIs true rails.is-packages-open } : !rails.close-packages-menu
    )
   )
  ) }
 ]
 !rails.sync-fullscreen
 !rails.sync-session-menu
 !rails.sync-packages-menu
 !rails.sync-preferences-menu

 $rails
)
$scope
