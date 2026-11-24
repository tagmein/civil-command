-- file lane-row-picker-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a searchable, async paginated modal picker for linked Data table rows
 ; to { host } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-row-picker-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-row-picker-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-modal-title-wrap title-wrap.className
 ; to heading-el !document.createElement div
 ; assign $heading-el { className lane-modal-title } { textContent 'Select Row' }
 ; to count-el !document.createElement div
 ; assign $count-el { className lane-modal-count } { textContent '' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading-el
 !title-wrap.appendChild $count-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to toolbar !document.createElement div
 ; set lane-row-picker-toolbar toolbar.className
 ; to search-input !document.createElement input
 ; assign $search-input { type text } { className 'lane-modal-search lane-row-picker-search' } { placeholder 'Filter rows...' } { spellcheck false } { autocomplete off }
 ; to clear-btn !document.createElement button
 ; assign $clear-btn { type button } { className 'lane-modal-action lane-row-picker-clear' } { textContent Clear } { title 'Clear selected row' }
 ; set true clear-btn.hidden
 !toolbar.appendChild $search-input
 !toolbar.appendChild $clear-btn

 ; to status-el !document.createElement div
 ; set lane-import-status status-el.className
 ; set true status-el.hidden

 ; to list-el !document.createElement div
 ; set 'lane-modal-list lane-row-picker-list' list-el.className

 ; to footer !document.createElement div
 ; set lane-row-picker-footer footer.className
 ; to more-btn !document.createElement button
 ; assign $more-btn { type button } { className 'lane-modal-action lane-row-picker-more' } { textContent 'Load more' }
 ; set true more-btn.hidden
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 !footer.appendChild $more-btn
 !footer.appendChild $cancel-btn

 !panel.appendChild $header
 !panel.appendChild $toolbar
 !panel.appendChild $status-el
 !panel.appendChild $list-el
 !panel.appendChild $footer
 !backdrop.appendChild $panel

 ; to fallback-page-size [ match
  { $defaultRowPickerPageSize : $defaultRowPickerPageSize }
  { true : 25 }
 ]

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { heading-el $heading-el }
  { count-el $count-el }
  { close-btn $close-btn }
  { search-input $search-input }
  { clear-btn $clear-btn }
  { status-el $status-el }
  { list-el $list-el }
  { more-btn $more-btn }
  { cancel-btn $cancel-btn }
  { host $host }
  { is-open false }
  { loading false }
  { error '' }
  { query '' }
  { page-size $fallback-page-size }
  { target-limit $fallback-page-size }
  { loaded-items {} }
  { next-offset 0 }
  { has-more false }
  { total-count 0 }
  { pages-loaded 0 }
  { selected-value null }
  { has-selected false }
  { fetch-page null }
  { on-select null }
  { load-seq 0 }
  { row-els {} }
  { option-items {} }
 ]

 ; to modal.close (
  -- Closes the row picker modal and resets session callbacks
  ; condition { propertyIs true modal.is-open } (
   ; to seq ; add $modal.load-seq 1
   ; set $seq modal.load-seq
   ; set false modal.is-open
   ; set false modal.loading
   ; set null modal.fetch-page
   ; set null modal.on-select
   !backdrop.remove
  )
 )

 ; to modal.render (
  -- Renders filtered row options, loading/error status, and Load more footer controls
  ; while { propertyIsGreaterThan 0 modal.row-els.length } (
   ; to old-el !modal.row-els.pop
   !old-el.remove
  )
  ; set 0 modal.option-items.length

  ; to matches !filterRowOptions $modal.loaded-items $modal.query
  ; to visible !matches.slice 0 $modal.target-limit
  ; to trimmed-q !modal.query.trim
  ; to has-query [ match
   { [ propertyIs '' trimmed-q ] : false }
   { true : true }
  ]

  ; set [ ternary $modal.has-selected false true ] clear-btn.hidden

  [ match
   { [ propertyIs '' modal.error ] [ match
    { $modal.loading (
     ; to msg [ ternary $has-query 'Searching rows…' 'Loading rows…' ]
     ; set $msg status-el.textContent
     ; set lane-import-status status-el.className
     ; set false status-el.hidden
    ) }
    { true (
     ; set '' status-el.textContent
     ; set true status-el.hidden
    ) }
   ] }
   { true (
    ; set $modal.error status-el.textContent
    ; set 'lane-import-status lane-import-status--error' status-el.className
    ; set false status-el.hidden
   ) }
  ]

  ; to has-hidden-matches [ propertyIsGreaterThan $visible.length matches.length ]
  ; to can-load-more [ match
   { $modal.has-more : true }
   { $has-hidden-matches : true }
   { true : false }
  ]
  ; set [ ternary $can-load-more false true ] more-btn.hidden
  ; set $modal.loading more-btn.disabled
  ; set [ ternary $modal.loading 'Loading…' 'Load more' ] more-btn.textContent

  ; to count-text [ match
   { [ propertyIs true modal.loading ] [ match
    { [ propertyIs 0 modal.pages-loaded ] : 'Loading rows…' }
    { $has-query : ; add $matches.length ; add '+ matching (' ; add $modal.loaded-items.length ; add '/' ; add $modal.total-count ' scanned)' }
    { true : ; add 'Showing ' ; add $visible.length ; add ' of ' ; add $modal.total-count ' rows' }
   ] }
   { $has-query [ match
    { $modal.has-more : ; add $matches.length ; add '+ matching (' ; add $modal.loaded-items.length ; add '/' ; add $modal.total-count ' scanned)' }
    { true : ; add $matches.length ; add ' matching of ' ; add $modal.total-count ' rows' }
   ] }
   { $can-load-more : ; add 'Showing ' ; add $visible.length ; add ' of ' ; add $modal.total-count ' rows' }
   { true (
    ; to unit [ ternary [ propertyIs 1 visible.length ] ' row' ' rows' ]
    ; add $visible.length $unit
   ) }
  ]
  ; set $count-text count-el.textContent

  [ match
   { [ propertyIs 0 visible.length ] (
    ; condition { propertyIs false modal.loading } (
     ; to empty-el !document.createElement div
     ; set lane-modal-empty empty-el.className
     ; to empty-msg [ match
      { [ propertyIs '' modal.error ] [ match
       { [ propertyIs 0 modal.total-count ] : 'No rows available in linked table.' }
       { $has-query : 'No matching rows found.' }
       { true : 'No selectable values in linked column.' }
      ] }
      { true : $modal.error }
     ]
     ; set $empty-msg empty-el.textContent
     !list-el.appendChild $empty-el
     !modal.row-els.push $empty-el
    )
   ) }
   { true (
    ; each $visible (
     ; to { item } $argv
     ; to is-active [ match
      { $modal.has-selected : !dataValuesEqual $item.value $modal.selected-value }
      { true : false }
     ]
     ; to opt-btn !document.createElement button
     ; to cls [ ternary $is-active 'lane-row-picker-option lane-row-picker-option--active' lane-row-picker-option ]
     ; assign $opt-btn { type button } { className $cls }
     !opt-btn.setAttribute aria-selected [ ternary $is-active 'true' 'false' ]

     ; to main-el !document.createElement span
     ; set lane-row-picker-option-main main-el.className
     ; to disp-el !document.createElement span
     ; set lane-row-picker-option-display disp-el.className
     [ match
      { $item.hasSeparateDisplay (
       ; set $item.displayText disp-el.textContent
       !main-el.appendChild $disp-el
       ; to id-el !document.createElement span
       ; assign $id-el { className lane-row-picker-option-id } { textContent $item.valueText }
       !main-el.appendChild $id-el
      ) }
      { true (
       ; set $item.valueText disp-el.textContent
       !main-el.appendChild $disp-el
      ) }
     ]
     !opt-btn.appendChild $main-el

     [ match
      { $is-active (
       ; to badge-el !document.createElement span
       ; assign $badge-el { className lane-row-picker-option-badge } { textContent Selected }
       !opt-btn.appendChild $badge-el
      ) }
     ]

     !opt-btn.addEventListener click (
      ; to cb $modal.on-select
      ; to chosen $item.value
      !modal.close
      [ match
       { $cb : !$cb $chosen }
      ]
     )

     !list-el.appendChild $opt-btn
     !modal.row-els.push $opt-btn
     ; to opt-rec ; object { item $item } { el $opt-btn } { active $is-active }
     !modal.option-items.push $opt-rec
    )
   ) }
  ]
 )

 ; to modal.ensure-loaded (
  -- Fetches pages asynchronously only until target-limit matches are available or source rows are exhausted
  ; to seq $modal.load-seq
  ; to initial-matches !filterRowOptions $modal.loaded-items $modal.query
  ; to needs-fetch [ match
   { [ propertyIs false modal.is-open ] : false }
   { [ propertyIs false modal.has-more ] : false }
   { [ propertyIsGreaterThanOrEqual $modal.target-limit initial-matches.length ] : false }
   { $modal.fetch-page : true }
   { true : false }
  ]

  [ match
   { [ propertyIs true needs-fetch ] (
    ; set true modal.loading
    ; set '' modal.error
    !modal.render
    ; to loop ; object { keep true }
    ; while { propertyIs true loop.keep } (
     ; to cur-matches !filterRowOptions $modal.loaded-items $modal.query
     ; to stop-early [ match
      { [ propertyIs false modal.is-open ] : true }
      { [ propertyIs false modal.has-more ] : true }
      { [ propertyIsGreaterThanOrEqual $modal.target-limit cur-matches.length ] : true }
      { true : false }
     ]
     [ match
      { $stop-early : ; set false loop.keep }
      { true (
       ; to prev-offset $modal.next-offset
       ; to res ; try (
        !modal.fetch-page $prev-offset $modal.page-size
       ) (
        ; to { err } $argv
        ; to err-msg [ match
         { $err.message : $err.message }
         { true : 'Failed to load rows' }
        ]
        ; object { ok false } { error $err-msg }
       )
       ; to still-active [ match
        { [ propertyIs false modal.is-open ] : false }
        { [ propertyIs $seq modal.load-seq ] : true }
        { true : false }
       ]
       [ match
        { [ propertyIs false still-active ] : ; set false loop.keep }
        { [ propertyIs false res.ok ] (
         ; to err-text [ match
          { $res.error : $res.error }
          { true : 'Failed to load rows' }
         ]
         ; set $err-text modal.error
         ; set false modal.has-more
         ; set false loop.keep
        ) }
        { true (
         ; to next-pages ; add $modal.pages-loaded 1
         ; set $next-pages modal.pages-loaded
         ; to page-items [ match
          { [ !window.Array.isArray $res.items ] : $res.items }
          { true : {} }
         ]
         ; each $page-items (
          ; to { it } $argv
          !modal.loaded-items.push $it
         )
         ; to next-off [ match
          { [ propertyIs undefined res.nextOffset ] : ; add $prev-offset $page-items.length }
          { [ propertyIs null res.nextOffset ] : ; add $prev-offset $page-items.length }
          { true : $res.nextOffset }
         ]
         ; set $next-off modal.next-offset
         ; to advanced [ propertyIsGreaterThan $prev-offset next-off ]
         ; to more [ match
          { [ propertyIs false res.hasMore ] : false }
          { [ propertyIs false advanced ] : false }
          { true : true }
         ]
         ; set $more modal.has-more
         [ match
          { [ propertyIs undefined res.total ] : null }
          { [ propertyIs null res.total ] : null }
          { true : ; set $res.total modal.total-count }
         ]
         ; to after-matches !filterRowOptions $modal.loaded-items $modal.query
         ; condition { propertyIs false more } : ; set false loop.keep
         ; condition { propertyIsGreaterThanOrEqual $modal.target-limit after-matches.length } : ; set false loop.keep
        ) }
       ]
      ) }
     ]
    )
    ; condition { propertyIs $seq modal.load-seq } (
     ; set false modal.loading
     !modal.render
    )
   ) }
   { true (
    ; set false modal.loading
    !modal.render
   ) }
  ]
 )

 ; to modal.load-more (
  -- Increases target match limit by one page and fetches additional pages only as needed
  ; condition { propertyIs true modal.is-open } (
   ; condition { propertyIs false modal.loading } (
    ; to next-limit ; add $modal.target-limit $modal.page-size
    ; set $next-limit modal.target-limit
    !modal.ensure-loaded
   )
  )
 )

 ; to modal.open (
  -- Opens the row picker modal and fetches only the initial page of options asynchronously
  ; to { opts } $argv
  ; to seq ; add $modal.load-seq 1
  ; set $seq modal.load-seq
  ; to title [ match
   { $opts.title : $opts.title }
   { true : 'Select Row' }
  ]
  ; to placeholder [ match
   { $opts.placeholder : $opts.placeholder }
   { true : 'Filter rows...' }
  ]
  ; to psize [ match
   { [ propertyIsGreaterThan 0 opts.page-size ] : $opts.page-size }
   { true : $fallback-page-size }
  ]
  ; to cur-val $opts.current-value
  ; to has-cur [ match
   { [ propertyIs undefined cur-val ] : false }
   { [ propertyIs null cur-val ] : false }
   { true : true }
  ]

  ; set $title heading-el.textContent
  ; set $placeholder search-input.placeholder
  ; set $psize modal.page-size
  ; set $psize modal.target-limit
  ; set '' modal.query
  ; set '' search-input.value
  ; set '' modal.error
  ; set {} modal.loaded-items
  ; set 0 modal.next-offset
  ; set true modal.has-more
  ; set 0 modal.total-count
  ; set 0 modal.pages-loaded
  ; set $cur-val modal.selected-value
  ; set $has-cur modal.has-selected
  ; set [ match { $opts.fetch-page : $opts.fetch-page } { true : null } ] modal.fetch-page
  ; set [ match { $opts.on-select : $opts.on-select } { true : null } ] modal.on-select

  ; condition { propertyIs false modal.is-open } (
   ; set true modal.is-open
   ; to mount-parent [ match
    { $document.body : $document.body }
    { $modal.host : $modal.host }
    { true : null }
   ]
   [ match
    { $mount-parent.appendChild : !mount-parent.appendChild $backdrop }
   ]
  )
  [ match
   { $search-input.focus : !search-input.focus }
  ]
  !modal.ensure-loaded
  $modal
 )

 !close-btn.addEventListener click $modal.close
 !cancel-btn.addEventListener click $modal.close
 !clear-btn.addEventListener click (
  ; to cb $modal.on-select
  !modal.close
  [ match
   { $cb : !$cb null }
  ]
 )
 !more-btn.addEventListener click $modal.load-more
 !search-input.addEventListener input (
  ; set $search-input.value modal.query
  ; set $modal.page-size modal.target-limit
  ; to next-seq ; add $modal.load-seq 1
  ; set $next-seq modal.load-seq
  !modal.ensure-loaded
 )
 !list-el.addEventListener scroll (
  ; condition { propertyIs true modal.is-open } (
   ; condition { propertyIs false modal.loading } (
    ; condition { propertyIs true modal.has-more } (
     ; to ch $list-el.clientHeight
     ; to sh $list-el.scrollHeight
     ; to st $list-el.scrollTop
     ; to has-geom [ match
      { [ propertyIsGreaterThan 0 ch ] : [ propertyIsGreaterThan 0 sh ] }
      { true : false }
     ]
     ; condition { propertyIs true has-geom } (
      ; to bottom ; add $st $ch
      ; to threshold ; subtract $sh 24
      ; condition { propertyIsGreaterThanOrEqual $threshold bottom } : !modal.load-more
     )
    )
   )
  )
 )
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
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
