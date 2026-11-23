-- file lane-scope.fs
; to scope ; object
; to scope.mount (
 -- Mounts a multi-column Miller-column browser of a lane's final total scope
 ; to { lane container options } $argv
 ; to on-select [ match
  { $options.on-select : $options.on-select }
  { true : null }
 ]
 ; to view [ object
  { lane $lane }
  { container $container }
  { on-select $on-select }
  { state ; object }
  { selected-path {} }
  { columns {} }
  { col-els {} }
  { crumb-els {} }
 ]

 ; to root-el !document.createElement div
 ; set lane-scope root-el.className
 ; to breadcrumb-el !document.createElement div
 ; set lane-scope-breadcrumb breadcrumb-el.className
 ; to columns-el !document.createElement div
 ; set lane-scope-columns columns-el.className

 !root-el.appendChild $breadcrumb-el
 !root-el.appendChild $columns-el
 !container.appendChild $root-el
 ; assign $view { element $root-el } { breadcrumb-el $breadcrumb-el } { columns-el $columns-el }

 ; to view.select (
  -- Updates the selected property path and re-renders the multi-column browser
  ; to { next-path } $argv
  ; set $next-path view.selected-path
  !view.render $view.state
  [ match
   { $view.on-select (
    ; to last-idx ; subtract $view.columns.length 1
    ; to last-col [ get view.columns $last-idx ]
    !view.on-select $view.selected-path $last-col
   ) }
  ]
 )

 ; to view.render-breadcrumb (
  -- Renders clickable $path breadcrumbs above the columns
  ; while { propertyIsGreaterThan 0 view.crumb-els.length } (
   ; to old-el !view.crumb-els.pop
   !old-el.remove
  )
  ; to root-btn !document.createElement button
  ; assign $root-btn { type button } { className lane-scope-crumb } { textContent scope }
  !root-btn.addEventListener click : !view.select {}
  !breadcrumb-el.appendChild $root-btn
  !view.crumb-els.push $root-btn

  ; to prefix {}
  ; each $view.selected-path (
   ; to { seg idx } $argv
   ; to sep !document.createElement span
   ; to sep-text [ match
    { [ propertyIs 0 idx ] : ' $' }
    { true : '.' }
   ]
   ; assign $sep { className lane-scope-crumb-sep } { textContent $sep-text }
   !breadcrumb-el.appendChild $sep
   !view.crumb-els.push $sep

   !prefix.push $seg
   ; to target-path !prefix.slice 0
   ; to seg-btn !document.createElement button
   ; assign $seg-btn { type button } { className lane-scope-crumb } { textContent $seg }
   !seg-btn.addEventListener click : !view.select $target-path
   !breadcrumb-el.appendChild $seg-btn
   !view.crumb-els.push $seg-btn
  )
 )

 ; to view.render-entries-col (
  -- Renders a column listing an object's or scope's properties
  ; to { col } $argv
  ; to col-el !document.createElement div
  ; set lane-scope-col col-el.className

  ; to header-el !document.createElement div
  ; set lane-scope-col-header header-el.className
  ; to title-el !document.createElement span
  ; assign $title-el { className lane-scope-col-title } { textContent $col.title }
  ; to meta-el !document.createElement span
  ; assign $meta-el { className lane-scope-col-meta } { textContent $col.valueSummary }
  !header-el.appendChild $title-el
  !header-el.appendChild $meta-el
  !col-el.appendChild $header-el

  -- For functions or dates/regexps, show a compact value preview above properties
  ; to show-banner [ match
   { [ propertyIs function col.valueType ] : true }
   { [ propertyIs date col.valueType ] : true }
   { [ propertyIs regexp col.valueType ] : true }
   { true : false }
  ]
  ; condition { propertyIs true show-banner } (
   ; to banner-el !document.createElement div
   ; assign $banner-el { className lane-scope-col-banner } { textContent $col.valueDetail }
   !col-el.appendChild $banner-el
  )

  ; to list-el !document.createElement div
  ; set lane-scope-list list-el.className
  ; to items {}

  [ match
   { [ propertyIs 0 col.entries.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-scope-empty } { textContent '(no properties)' }
    !list-el.appendChild $empty-el
   ) }
   { true (
    ; to flags ; object { shown-proto false }
    ; each $col.entries (
     ; to { entry } $argv
     ; condition { propertyIs true entry.inherited } (
      ; condition { propertyIs false flags.shown-proto } (
       ; set true flags.shown-proto
       ; to divider-el !document.createElement div
       ; assign $divider-el { className lane-scope-divider } { textContent prototype }
       !list-el.appendChild $divider-el
      )
     )

     ; to item-btn !document.createElement button
     ; to is-selected [ propertyIs $entry.key col.selectedKey ]
     ; to cls-base 'lane-scope-item'
     ; to cls-1 [ match
      { $is-selected : ; add $cls-base ' lane-scope-item--selected' }
      { true : $cls-base }
     ]
     ; to cls-2 [ match
      { $entry.inherited : ; add $cls-1 ' lane-scope-item--inherited' }
      { [ propertyIs false entry.enumerable ] : ; add $cls-1 ' lane-scope-item--nonenum' }
      { true : $cls-1 }
     ]
     ; assign $item-btn { type button } { className $cls-2 }
     !item-btn.setAttribute aria-selected [ ternary $is-selected 'true' 'false' ]

     ; to key-el !document.createElement span
     ; assign $key-el { className lane-scope-item-key } { textContent $entry.key }

     ; to right-el !document.createElement span
     ; set lane-scope-item-right right-el.className
     ; to hint-el !document.createElement span
     ; assign $hint-el { className lane-scope-item-hint } { textContent $entry.summary }
     !right-el.appendChild $hint-el

     [ match
      { $entry.expandable (
       ; to arrow-el !document.createElement span
       ; assign $arrow-el { className lane-scope-item-arrow } { textContent '▸' }
       !right-el.appendChild $arrow-el
      ) }
     ]

     !item-btn.appendChild $key-el
     !item-btn.appendChild $right-el

     ; to next-path !col.path.concat { $entry.key }
     !item-btn.addEventListener click : !view.select $next-path

     !list-el.appendChild $item-btn
     ; to item-rec [ object
      { key $entry.key }
      { entry $entry }
      { el $item-btn }
      { selected $is-selected }
     ]
     !items.push $item-rec
    )
   ) }
  ]

  !col-el.appendChild $list-el
  ; object { kind entries } { data $col } { el $col-el } { items $items }
 )

 ; to view.render-value-col (
  -- Renders a detail column showing a selected property's type and value
  ; to { col } $argv
  ; to col-el !document.createElement div
  ; set 'lane-scope-col lane-scope-col--value' col-el.className

  ; to header-el !document.createElement div
  ; set lane-scope-col-header header-el.className
  ; to title-el !document.createElement span
  ; assign $title-el { className lane-scope-col-title } { textContent $col.title }
  ; to badge-el !document.createElement span
  ; assign $badge-el { className lane-scope-type-badge } { textContent $col.valueType }
  !header-el.appendChild $title-el
  !header-el.appendChild $badge-el
  !col-el.appendChild $header-el

  ; to box-el !document.createElement div
  ; set lane-scope-value-box box-el.className

  ; to joined !col.path.join '.'
  ; to expr ; add '$' $joined
  ; to path-el !document.createElement div
  ; assign $path-el { className lane-scope-value-path } { textContent $expr }
  !box-el.appendChild $path-el

  ; to code-el !document.createElement pre
  ; to code-cls [ match
   { $col.error : 'lane-scope-value-code lane-scope-value-code--error' }
   { true : 'lane-scope-value-code' }
  ]
  ; assign $code-el { className $code-cls } { textContent $col.valueDetail }
  !box-el.appendChild $code-el

  !col-el.appendChild $box-el
  ; object { kind value } { data $col } { el $col-el } { value-el $code-el } { type-el $badge-el } { path-el $path-el } { items {} }
 )

 ; to view.render (
  -- Resolves and renders all Miller columns for the given final scope state
  ; to { next-state } $argv
  [ match
   { $next-state : ; set $next-state view.state }
  ]
  ; to resolved !resolveScopeColumns $view.state $view.selected-path
  ; set $resolved.path view.selected-path

  !view.render-breadcrumb

  ; while { propertyIsGreaterThan 0 view.col-els.length } (
   ; to old-el !view.col-els.pop
   !old-el.remove
  )
  ; set 0 view.columns.length

  ; each $resolved.columns (
   ; to { col } $argv
   ; to rendered [ match
    { [ propertyIs value col.kind ] : !view.render-value-col $col }
    { true : !view.render-entries-col $col }
   ]
   !columns-el.appendChild $rendered.el
   !view.col-els.push $rendered.el
   !view.columns.push $rendered
  )

  ; condition { propertyIsGreaterThan 0 columns-el.scrollWidth } (
   ; set $columns-el.scrollWidth columns-el.scrollLeft
  )
  $view.columns
 )

 $view
)
$scope
