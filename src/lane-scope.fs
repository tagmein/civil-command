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
  { filter-query '' }
  { filter-col-idx null }
  { last-filter-col-idx 0 }
  { show-proto true }
  { copy-timer null }
  { is-loading [ match { $options.initial-loading : true } { true : false } ] }
  { has-rendered false }
 ]

 ; to root-el !document.createElement div
 ; set lane-scope root-el.className

 ; to toolbar-el !document.createElement div
 ; set lane-scope-toolbar toolbar-el.className

 ; to filter-wrap !document.createElement div
 ; set lane-scope-filter-wrap filter-wrap.className
 ; to filter-input !document.createElement input
 ; assign $filter-input { type text } { className lane-scope-filter-input } { placeholder 'Filter scope…' } { spellcheck false } { autocomplete off }
 !filter-input.setAttribute aria-label 'Filter scope names'
 ; to filter-count-el !document.createElement span
 ; assign $filter-count-el { className lane-scope-filter-count } { hidden true }
 ; to filter-clear-btn !document.createElement button
 ; assign $filter-clear-btn { type button } { className lane-scope-filter-clear } { textContent '×' } { title 'Clear filter (Esc)' } { hidden true }
 !filter-clear-btn.setAttribute aria-label 'Clear scope filter'
 !filter-wrap.appendChild $filter-input
 !filter-wrap.appendChild $filter-count-el
 !filter-wrap.appendChild $filter-clear-btn

 ; to proto-btn !document.createElement button
 ; assign $proto-btn { type button } { className 'lane-scope-proto-btn lane-scope-proto-btn--active' } { textContent proto } { title 'Toggle inherited prototype properties' }
 !proto-btn.setAttribute aria-pressed true

 !toolbar-el.appendChild $filter-wrap
 !toolbar-el.appendChild $proto-btn

 ; to breadcrumb-el !document.createElement div
 ; set lane-scope-breadcrumb breadcrumb-el.className
 ; to crumb-list-el !document.createElement div
 ; set lane-scope-crumb-list crumb-list-el.className
 ; to copy-btn !document.createElement button
 ; assign $copy-btn { type button } { className lane-scope-copy-btn } { textContent Copy } { title 'Copy FieldScript $path' } { hidden true }
 !breadcrumb-el.appendChild $crumb-list-el
 !breadcrumb-el.appendChild $copy-btn

 ; to columns-el !document.createElement div
 ; set lane-scope-columns columns-el.className
 ; to loading-el !document.createElement div
 ; assign $loading-el { className 'cc-loading cc-loading--scope' } { textContent 'Loading scope…' } { hidden [ ternary $view.is-loading false true ] }
 [ match
  { [ propertyIs true view.is-loading ] : !columns-el.appendChild $loading-el }
 ]

 !root-el.appendChild $toolbar-el
 !root-el.appendChild $breadcrumb-el
 !root-el.appendChild $columns-el
 !container.appendChild $root-el
 [ assign $view
  { element $root-el }
  { toolbar-el $toolbar-el }
  { filter-input $filter-input }
  { filter-count-el $filter-count-el }
  { filter-clear-btn $filter-clear-btn }
  { proto-btn $proto-btn }
  { breadcrumb-el $breadcrumb-el }
  { crumb-list-el $crumb-list-el }
  { copy-btn $copy-btn }
  { columns-el $columns-el }
  { loading-el $loading-el }
 ]

 ; to view.set-loading (
  -- Toggles in-flight scope loading indicator when columns have not yet rendered
  ; to { loading } $argv
  ; to next-loading [ ternary $loading true false ]
  ; set $next-loading view.is-loading
  [ match
   { $next-loading (
    [ match
     { [ and { [ propertyIs false view.has-rendered ] } { [ propertyIs 0 view.col-els.length ] } ] (
      ; set false loading-el.hidden
      [ match
       { [ and { $columns-el.children } { $columns-el.children.indexOf } ] (
        ; to lidx !columns-el.children.indexOf $loading-el
        ; condition { propertyIsLessThan 0 lidx } : !columns-el.appendChild $loading-el
       ) }
       { true : !columns-el.appendChild $loading-el }
      ]
     ) }
    ]
   ) }
   { true (
    ; set true loading-el.hidden
    !loading-el.remove
    [ match
     { [ and { $columns-el.children } { $columns-el.children.indexOf } { $columns-el.children.splice } ] (
      ; to lidx !columns-el.children.indexOf $loading-el
      ; condition { propertyIsGreaterThanOrEqual 0 lidx } : !columns-el.children.splice $lidx 1
     ) }
    ]
   ) }
  ]
 )

 ; to view.deepest-entries-index (
  -- Finds the index of the deepest entries column currently rendered
  ; to found ; object { idx 0 }
  ; each $view.columns (
   ; to { col idx } $argv
   ; condition { propertyIs entries col.kind } : ; set $idx found.idx
  )
  $found.idx
 )

 ; to view.sync-proto-btn (
  -- Syncs prototype toggle button visual state
  ; to cls [ ternary $view.show-proto 'lane-scope-proto-btn lane-scope-proto-btn--active' lane-scope-proto-btn ]
  ; set $cls proto-btn.className
  !proto-btn.setAttribute aria-pressed [ ternary $view.show-proto true false ]
 )

 ; to view.set-filter (
  -- Updates the active filter query targeting the deepest entries column
  ; to { next-query } $argv
  ; to text [ match
   { $next-query : ; add '' $next-query }
   { true : '' }
  ]
  ; set $text view.filter-query
  ; to same-input [ propertyIs $filter-input.value text ]
  ; condition { propertyIs false same-input } : ; set $text filter-input.value
  ; to trimmed !text.trim
  [ match
   { [ propertyIs '' trimmed ] : ; set null view.filter-col-idx }
   { true : ; set [ !view.deepest-entries-index ] view.filter-col-idx }
  ]
  !view.render $view.state
 )

 ; to view.clear-filter (
  -- Clears the active scope filter and restores full column entries
  ; set '' view.filter-query
  ; set '' filter-input.value
  ; set null view.filter-col-idx
  !view.render $view.state
 )

 ; to view.toggle-proto (
  -- Toggles showing inherited prototype properties in object/list columns
  ; set [ ternary $view.show-proto false true ] view.show-proto
  !view.sync-proto-btn
  !view.render $view.state
 )

 ; to view.copy-path (
  -- Copies the currently selected $path expression to the clipboard
  ; condition { propertyIsGreaterThan 0 view.selected-path.length } (
   ; to joined !view.selected-path.join '.'
   ; to expr ; add '$' $joined
   [ match
    { $window.navigator.clipboard.writeText : !window.navigator.clipboard.writeText $expr }
   ]
   ; set Copied copy-btn.textContent
   [ match
    { $window.setTimeout (
     [ match
      { $view.copy-timer : !window.clearTimeout $view.copy-timer }
     ]
     ; to next-timer !window.setTimeout (
      ; set Copy copy-btn.textContent
      ; set null view.copy-timer
     ) 1200
     ; set $next-timer view.copy-timer
    ) }
   ]
   $expr
  )
 )

 ; to view.select (
  -- Updates the selected property path and re-renders the multi-column browser
  ; to { next-path } $argv
  ; set $next-path view.selected-path
  [ match
   { { propertyIsGreaterThanOrEqual 0 view.filter-col-idx } (
    ; condition { propertyIsGreaterThan $next-path.length view.filter-col-idx } : ; set null view.filter-col-idx
   ) }
  ]
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
  !crumb-list-el.appendChild $root-btn
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
   !crumb-list-el.appendChild $sep
   !view.crumb-els.push $sep

   !prefix.push $seg
   ; to target-path !prefix.slice 0
   ; to seg-btn !document.createElement button
   ; assign $seg-btn { type button } { className lane-scope-crumb } { textContent $seg }
   !seg-btn.addEventListener click : !view.select $target-path
   !crumb-list-el.appendChild $seg-btn
   !view.crumb-els.push $seg-btn
  )

  ; to has-path [ propertyIsGreaterThan 0 view.selected-path.length ]
  ; set [ ternary $has-path false true ] copy-btn.hidden
  [ match
   { $has-path (
    ; to joined !view.selected-path.join '.'
    ; set [ ; add 'Copy $' $joined ] copy-btn.title
   ) }
   { true : ; set Copy copy-btn.textContent }
  ]
 )

 ; to view.render-entries-col (
  -- Renders a column listing an object's or scope's properties
  ; to { col } $argv
  ; to col-el !document.createElement div
  ; to col-cls [ ternary $col.filtered 'lane-scope-col lane-scope-col--filtered' lane-scope-col ]
  ; set $col-cls col-el.className

  ; to header-el !document.createElement div
  ; set lane-scope-col-header header-el.className
  ; to title-el !document.createElement span
  ; assign $title-el { className lane-scope-col-title } { textContent $col.title } { title $col.title }
  ; to meta-text [ match
   { $col.filtered : ; add $col.matchCount ; add ' / ' $col.unfilteredCount }
   { true : $col.valueSummary }
  ]
  ; to meta-cls [ match
   { $col.filtered : 'lane-scope-col-meta lane-scope-col-meta--filtered' }
   { true : ; add 'lane-scope-col-meta lane-scope-type--' $col.valueType }
  ]
  ; to meta-el !document.createElement span
  ; assign $meta-el { className $meta-cls } { textContent $meta-text } { title $col.valueSummary }
  !header-el.appendChild $title-el
  !header-el.appendChild $meta-el
  !col-el.appendChild $header-el

  -- For will blocks, functions, dates, regexps, or errors, show a compact value preview above properties
  ; to show-banner [ match
   { [ propertyIs will col.valueType ] : true }
   { [ propertyIs function col.valueType ] : true }
   { [ propertyIs date col.valueType ] : true }
   { [ propertyIs regexp col.valueType ] : true }
   { [ propertyIs error col.valueType ] : true }
   { true : false }
  ]
  ; condition { propertyIs true show-banner } (
   ; to banner-el !document.createElement div
   ; assign $banner-el { className lane-scope-col-banner } { textContent $col.valueDetail } { title $col.valueDetail }
   !col-el.appendChild $banner-el
  )

  ; to list-el !document.createElement div
  ; set lane-scope-list list-el.className
  ; to items {}

  [ match
   { [ propertyIs 0 col.entries.length ] (
    ; to empty-text [ ternary $col.filtered 'No matching names' '(no properties)' ]
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-scope-empty } { textContent $empty-text }
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
     ; assign $key-el { className lane-scope-item-key } { textContent $entry.key } { title $entry.key }

     ; to right-el !document.createElement span
     ; set lane-scope-item-right right-el.className
     ; to hint-cls ; add 'lane-scope-item-hint lane-scope-type--' $entry.type
     ; to hint-title [ match
      { $entry.detail : $entry.detail }
      { true : $entry.summary }
     ]
     ; to hint-el !document.createElement span
     ; assign $hint-el { className $hint-cls } { textContent $entry.summary } { title $hint-title }
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
  ; assign $title-el { className lane-scope-col-title } { textContent $col.title } { title $col.title }
  ; to badge-cls ; add 'lane-scope-type-badge lane-scope-type--' $col.valueType
  ; to badge-el !document.createElement span
  ; assign $badge-el { className $badge-cls } { textContent $col.valueType }
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

 ; to view.sync-filter-bar (
  -- Updates filter bar placeholder, clear button visibility, and match counter
  ; to { resolved } $argv
  ; to target-idx $resolved.filterColumnIndex
  ; set $target-idx view.last-filter-col-idx
  ; to target-col [ get resolved.columns $target-idx ]
  ; to target-name [ match
   { $target-col.title : $target-col.title }
   { true : scope }
  ]
  ; set [ ; add 'Filter ' ; add $target-name '…' ] filter-input.placeholder
  ; to trimmed !view.filter-query.trim
  ; to has-query [ match
   { [ propertyIs '' trimmed ] : false }
   { true : true }
  ]
  ; set [ ternary $has-query false true ] filter-clear-btn.hidden
  [ match
   { $has-query (
    ; to count-txt ; add $target-col.matchCount ; add ' / ' $target-col.unfilteredCount
    ; set $count-txt filter-count-el.textContent
    ; set false filter-count-el.hidden
   ) }
   { true (
    ; set '' filter-count-el.textContent
    ; set true filter-count-el.hidden
   ) }
  ]
 )

 ; to view.render (
  -- Resolves and renders all Miller columns for the given final scope state
  ; to { next-state } $argv
  ; set false view.is-loading
  ; set true view.has-rendered
  ; set true loading-el.hidden
  !loading-el.remove
  [ match
   { [ and { $columns-el.children } { $columns-el.children.indexOf } { $columns-el.children.splice } ] (
    ; to lidx !columns-el.children.indexOf $loading-el
    ; condition { propertyIsGreaterThanOrEqual 0 lidx } : !columns-el.children.splice $lidx 1
   ) }
  ]
  [ match
   { $next-state : ; set $next-state view.state }
  ]
  ; to resolve-opts [ object
   { filter $view.filter-query }
   { filterColumnIndex $view.filter-col-idx }
   { includeInherited $view.show-proto }
  ]
  ; to resolved !resolveScopeColumns $view.state $view.selected-path $resolve-opts
  ; set $resolved.path view.selected-path

  !view.render-breadcrumb
  !view.sync-filter-bar $resolved

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

 !filter-input.addEventListener input : !view.set-filter $filter-input.value
 !filter-input.addEventListener keydown (
  ; to { ev } $argv
  [ match
   { [ propertyIs Escape ev.key ] (
    ; to trimmed !view.filter-query.trim
    ; to is-empty [ propertyIs '' trimmed ]
    ; condition { propertyIs false is-empty } (
     [ match
      { $ev.stopPropagation : !ev.stopPropagation }
     ]
     !view.clear-filter
    )
   ) }
   { [ propertyIs Enter ev.key ] (
    [ match
     { $ev.preventDefault : !ev.preventDefault }
    ]
    ; to target-col [ get view.columns $view.last-filter-col-idx ]
    ; condition { propertyIsGreaterThan 0 target-col.items.length } (
     ; to first-key $target-col.items.0.key
     ; to next-path !target-col.data.path.concat { $first-key }
     !view.select $next-path
    )
   ) }
  ]
 )
 !filter-clear-btn.addEventListener click (
  !view.clear-filter
  [ match
   { $filter-input.focus : !filter-input.focus }
  ]
 )
 !proto-btn.addEventListener click $view.toggle-proto
 !copy-btn.addEventListener click $view.copy-path

 $view
)
$scope
