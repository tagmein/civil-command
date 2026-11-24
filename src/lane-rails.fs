-- file lane-rails.fs
; to scope ; object
; to scope.create (
 -- Creates always-open fixed left and right side rails and a floating non-interactive hover preview for minimized lanes
 ; to { lane-control } $argv
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
   !document.body.appendChild $left-rail
   !document.body.appendChild $right-rail
   !document.body.appendChild $preview-el
  ) }
 ]

 ; to rails [ object
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
        { true : 8 }
       ]
      ) }
      { true : 8 }
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
         ; to max-top !window.Math.max 8 $raw-max
         !window.Math.max 8 [ !window.Math.min $desired-top $max-top ]
        ) }
        { true : !window.Math.max 8 $desired-top }
       ]
      ) }
      { true : !window.Math.max 8 $desired-top }
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

 $rails
)
$scope
