-- file lane-output.fs
; to scope ; object
; to scope.mount (
 -- Mounts a mini browser window ("Lane Output") below a lane that executes transported FieldScript blocks in browser context
 ; to { lane container notebook lane-control } $argv
 ; to view [ object
  { lane $lane }
  { container $container }
  { notebook $notebook }
  { lane-control $lane-control }
  { packets {} }
  { results {} }
  { state ; object }
  { error-els {} }
  { popup-error-els {} }
  { render-id 0 }
  { always-visible false }
  { suppressed false }
  { is-floating false }
  { popup-window null }
  { popup-doc null }
  { popup-viewport-el null }
  { popup-empty-el null }
  { popup-errors-el null }
  { popup-popin-btn null }
 ]

 ; to view.get-title (
  -- Resolves the active lane title or falls back to Lane Output
  ; to raw [ match { $view.lane.title : $view.lane.title } { true : '' } ]
  ; to trimmed [ match { $raw.trim : !raw.trim } { true : '' } ]
  [ match
   { [ propertyIsGreaterThan 0 trimmed.length ] : $trimmed }
   { true : 'Lane Output' }
  ]
 )

 ; to initial-title !view.get-title

 ; to root-el !document.createElement div
 ; set lane-output root-el.className
 !root-el.setAttribute role region
 !root-el.setAttribute aria-label $initial-title
 ; set true root-el.hidden

 ; to bar-el !document.createElement div
 ; set lane-output-bar bar-el.className

 ; to dots-el !document.createElement span
 ; set lane-output-dots dots-el.className
 !dots-el.setAttribute aria-hidden 'true'
 ; to dot-1 !document.createElement span
 ; set 'lane-output-dot lane-output-dot--red' dot-1.className
 ; to dot-2 !document.createElement span
 ; set 'lane-output-dot lane-output-dot--yellow' dot-2.className
 ; to dot-3 !document.createElement span
 ; set 'lane-output-dot lane-output-dot--green' dot-3.className
 !dots-el.appendChild $dot-1
 !dots-el.appendChild $dot-2
 !dots-el.appendChild $dot-3

 ; to address-el !document.createElement div
 ; assign $address-el { className lane-output-address } { textContent $initial-title }

 ; to count-el !document.createElement span
 ; assign $count-el { className lane-output-count } { textContent '' }

 ; to reload-btn !document.createElement button
 ; assign $reload-btn { type button } { className lane-output-reload } { textContent '↻' } { title 'Re-run sent scripts' }
 !reload-btn.setAttribute aria-label 'Re-run sent scripts'

 ; to popout-btn !document.createElement button
 ; assign $popout-btn { type button } { className lane-output-popout } { title 'Pop out output in a new window' }
 !popout-btn.setAttribute aria-label 'Pop out output in a new window'
 ; set '<svg class="lane-icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4"></path><path d="M13.5 2.5L7.5 8.5"></path><path d="M12.5 9.5v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3"></path></svg>' popout-btn.innerHTML

 !bar-el.appendChild $dots-el
 !bar-el.appendChild $address-el
 !bar-el.appendChild $count-el
 !bar-el.appendChild $reload-btn
 !bar-el.appendChild $popout-btn

 ; to floating-el !document.createElement div
 ; assign $floating-el { className lane-output-floating } { hidden true }

 ; to attach-btn !document.createElement button
 ; assign $attach-btn { type button } { className lane-output-attach-btn } { textContent 'Attach output window' } { title 'Attach output window' }
 !attach-btn.setAttribute aria-label 'Attach output window'
 !floating-el.appendChild $attach-btn

 ; to viewport-el !document.createElement div
 ; set lane-output-viewport viewport-el.className

 ; to empty-el !document.createElement div
 ; assign $empty-el { className lane-output-empty } { textContent 'No browser output yet. Use ; send ( ... ) in Source to render output.' } { hidden true }

 ; to errors-el !document.createElement div
 ; set lane-output-errors errors-el.className
 ; set true errors-el.hidden

 !root-el.appendChild $bar-el
 !root-el.appendChild $floating-el
 !root-el.appendChild $viewport-el
 !root-el.appendChild $empty-el
 !root-el.appendChild $errors-el
 !container.appendChild $root-el

 ; assign $view { element $root-el } { bar-el $bar-el } { address-el $address-el } { count-el $count-el } { reload-btn $reload-btn } { popout-btn $popout-btn } { floating-el $floating-el } { attach-btn $attach-btn } { viewport-el $viewport-el } { empty-el $empty-el } { errors-el $errors-el }

 ; to view.has-live-popup (
  -- Checks whether the floating output window is currently open and cleans up if it was closed externally
  [ match
   { $view.popup-window (
    [ match
     { [ propertyIs true view.popup-window.closed ] (
      ; set null view.popup-window
      ; set null view.popup-doc
      ; set null view.popup-viewport-el
      ; set null view.popup-empty-el
      ; set null view.popup-errors-el
      ; set null view.popup-popin-btn
      ; set false view.is-floating
      false
     ) }
     { true (
      ; set true view.is-floating
      true
     ) }
    ]
   ) }
   { true (
    ; set false view.is-floating
    false
   ) }
  ]
 )

 ; to view.sync-title (
  -- Updates the mock browser title bar and floating window title to match the lane title
  ; to next-title !view.get-title
  ; set $next-title address-el.textContent
  !root-el.setAttribute aria-label $next-title
  ; to live-popup !view.has-live-popup
  ; condition { propertyIs true live-popup } (
   [ match
    { $view.popup-doc : ; set $next-title view.popup-doc.title }
   ]
  )
  $next-title
 )

 ; to view.sync-visibility (
  -- Updates output browser visibility based on packet count, floating popup state, and View-tab always-visible mode
  ; to is-floating !view.has-live-popup
  ; to has-packets [ propertyIsGreaterThan 0 view.packets.length ]
  ; to show [ match
   { $is-floating : true }
   { [ propertyIs true view.suppressed ] : false }
   { $has-packets : true }
   { $view.always-visible : true }
   { true : false }
  ]
  ; set [ ternary $show false true ] root-el.hidden
  ; set [ ternary $is-floating false true ] floating-el.hidden
  ; set [ ternary $is-floating true false ] popout-btn.hidden
  ; set [ ternary $is-floating true [ ternary $has-packets false true ] ] viewport-el.hidden
  ; set [ ternary $is-floating true [ ternary $has-packets true false ] ] empty-el.hidden
  [ match
   { $is-floating (
    [ match
     { $view.popup-viewport-el : ; set [ ternary $has-packets false true ] view.popup-viewport-el.hidden }
    ]
    [ match
     { $view.popup-empty-el : ; set [ ternary $has-packets true false ] view.popup-empty-el.hidden }
    ]
   ) }
  ]
  ; set [ ternary $view.always-visible 'lane-output lane-output--view' lane-output ] root-el.className
 )

 ; to view.set-always-visible (
  -- Enables or disables always-visible View mode for the output browser
  ; to { enabled } $argv
  ; set [ ternary $enabled true false ] view.always-visible
  !view.sync-visibility
 )

 ; to view.set-suppressed (
  -- Suppresses or unsuppresses inline Lane Output visibility (e.g. when the Story tab is active)
  ; to { flag } $argv
  ; set [ ternary $flag true false ] view.suppressed
  !view.sync-visibility
 )

 ; to clear-dom-container (
  -- Clears child DOM nodes from a viewport container
  ; to { target-el } $argv
  [ match
   { $target-el (
    [ match
     { $target-el.replaceChildren : !target-el.replaceChildren }
     { true (
      ; while { propertyIsGreaterThan 0 target-el.children.length } (
       ; to child !target-el.children.pop
       [ match
        { $child.remove : !child.remove }
       ]
      )
      ; set '' target-el.textContent
     ) }
    ]
   ) }
  ]
 )

 ; to view.clear-viewport (
  -- Clears rendered DOM nodes from both the internal and floating viewports
  !clear-dom-container $viewport-el
  !clear-dom-container $view.popup-viewport-el
 )

 ; to view.clear-errors (
  -- Clears any previous browser execution errors from internal and floating error panels
  ; while { propertyIsGreaterThan 0 view.error-els.length } (
   ; to old-el !view.error-els.pop
   [ match { $old-el.remove : !old-el.remove } ]
  )
  ; while { propertyIsGreaterThan 0 view.popup-error-els.length } (
   ; to old-pop-el !view.popup-error-els.pop
   [ match { $old-pop-el.remove : !old-pop-el.remove } ]
  )
  ; set true errors-el.hidden
  [ match
   { $view.popup-errors-el : ; set true view.popup-errors-el.hidden }
  ]
 )

 ; to view.render (
  -- Collects transported FieldScript packets, resets the active mini-browser viewport, and runs them in browser context
  ; to { raw-packets } $argv
  ; to packets [ match
   { [ !window.Array.isArray $raw-packets ] : $raw-packets }
   { true : {} }
  ]
  ; set $packets view.packets
  ; to next-render-id ; add $view.render-id 1
  ; set $next-render-id view.render-id
  !view.sync-title
  !view.clear-viewport
  !view.clear-errors
  ; to is-floating !view.has-live-popup
  [ match
   { [ propertyIs 0 packets.length ] (
    ; set {} view.results
    ; to view.state ; object
    ; set '' count-el.textContent
    !view.sync-visibility
    null
   ) }
   { true (
    !view.sync-visibility
    ; to count-unit [ ternary [ propertyIs 1 packets.length ] ' script' ' scripts' ]
    ; to count-label ; add $packets.length $count-unit
    ; set $count-label count-el.textContent
    ; to active-doc [ ternary $is-floating $view.popup-doc $document ]
    ; to active-win [ ternary $is-floating $view.popup-window $window ]
    ; to active-viewport [ ternary $is-floating $view.popup-viewport-el $viewport-el ]
    ; to active-errors [ ternary $is-floating $view.popup-errors-el $errors-el ]
    ; to active-error-list [ ternary $is-floating $view.popup-error-els $view.error-els ]
    ; to sync-popup-preferences (
     -- Syncs scrollbar styling onto any live floating popup document when preferences update
     ; to live-pop !view.has-live-popup
     ; condition { propertyIs true live-pop } (
      ; to sb-raw $view.lane-control.preferences.interface.scrollbarColor
      [ match
       { [ and $sb-raw $view.popup-doc.documentElement.style ] (
        ; to sb-res [ match
         { $resolveScrollbarColor : !resolveScrollbarColor $sb-raw }
         { true : ; object { css [ ; add $sb-raw ' transparent' ] } }
        ]
        ; set $sb-res.css view.popup-doc.documentElement.style.scrollbarColor
       ) }
      ]
     )
    )
    ; to refresh-if-preferences-lane (
     ; condition { and { get view.lane-control.preferences-lane-id } { propertyIs $view.lane.id view.lane-control.preferences-lane-id } } (
      [ match
       { $view.lane-control.refresh-preferences-from-storage : !view.lane-control.refresh-preferences-from-storage }
       { $view.lane-control.sync-preferences-timezones : !view.lane-control.sync-preferences-timezones }
      ]
      !sync-popup-preferences
     )
    )
    ; to output-sync-table (
     ; to { tbl-query records key-col } $argv
     ; to dv $view.notebook.data-view
     [ match
      { $dv (
       ; to res [ match
        { $syncTableRowsInMemory : !syncTableRowsInMemory $dv.tables $tbl-query $records $key-col }
        { true : ; object { ok false } { count 0 } { added 0 } { updated 0 } }
       ]
       [ match
        { $res.ok (
         [ match
          { [ and $view.notebook.state $buildTablesScope ] (
           ; to next-scoped !buildTablesScope $dv.tables
           ; assign $view.notebook.state $next-scoped
          ) }
         ]
         [ match
          { $dv.render-grid : !dv.render-grid }
         ]
         [ match
          { $dv.update-table-tabs-text : !dv.update-table-tabs-text }
         ]
         [ match
          { $dv.save-schema-and-rows : !dv.save-schema-and-rows $res.table }
         ]
         !refresh-if-preferences-lane
         [ match
          { $view.notebook.run-on-table-change : !view.notebook.run-on-table-change [ object { tableId $res.table.id } { tableName $res.table.name } { action sync-table } ] }
         ]
        ) }
       ]
       $res
      ) }
      { true : ; object { ok false } { count 0 } }
     ]
    )
    ; to output-read-table (
     ; to { tbl-query } $argv
     ; to dv $view.notebook.data-view
     ; to q-str [ match { $tbl-query.trim : !tbl-query.trim } { $tbl-query : ; add '' $tbl-query } { true : '' } ]
     ; to q-low !q-str.toLowerCase
     ; to out {}
     [ match
      { [ and $dv [ !window.Array.isArray $dv.tables ] ] (
       ; to found ; object { tbl null }
       ; each $dv.tables (
        ; to { t } $argv
        ; condition { propertyIs null found.tbl } (
         ; to t-nm [ match { $t.name.trim ( ; to tn !t.name.trim , !tn.toLowerCase ) } { true : '' } ]
         ; to hit [ match { [ propertyIs $q-str t.id ] : true } { [ propertyIs $q-low t-nm ] : true } { true : false } ]
         ; condition { propertyIs true hit } : ; set $t found.tbl
        )
       )
       [ match
        { $found.tbl (
         ; to cols [ match { [ !window.Array.isArray $found.tbl.columns ] : $found.tbl.columns } { true : {} } ]
         ; to rows [ match { [ !window.Array.isArray $found.tbl.rows ] : $found.tbl.rows } { true : {} } ]
         ; each $rows (
          ; to { r } $argv
          ; to rec ; object { _rowId $r.id }
          ; each $cols (
           ; to { c } $argv
           ; to cname [ match { $c.name.trim : !c.name.trim } { true : '' } ]
           ; condition { propertyIsGreaterThan 0 cname.length } (
            ; to rv [ get r.values $c.id ]
            ; to rec $cname $rv
           )
          )
          !out.push $rec
         )
        ) }
       ]
      ) }
     ]
     $out
    )
    ; to output-set-self-line (
     ; to { target next-text insert-if-missing } $argv
     [ match
      { $view.notebook.set-line-quiet (
       ; to res !view.notebook.set-line-quiet $target $next-text $insert-if-missing
       [ match
        { $res.ok : !refresh-if-preferences-lane }
       ]
       $res
      ) }
      { true : ; object { ok false } { error 'Notebook unavailable' } }
     ]
    )
    ; to output-get-self-lines (
     ; to out {}
     ; to recs [ match { [ !window.Array.isArray $view.notebook.line-records ] : $view.notebook.line-records } { true : {} } ]
     ; each $recs (
      ; to { rec idx } $argv
      !out.push [ object { id $rec.id } { lineNumber [ ; add $idx 1 ] } { text $rec.text } { updatedAt $rec.updatedAt } ]
     )
     $out
    )
    ; to output-get-self-meta (
     ; to is-pref [ match
      { $view.lane-control.preferences-lane-id : [ propertyIs $view.lane.id view.lane-control.preferences-lane-id ] }
      { true : false }
     ]
     ; to feats [ match
      { $view.lane.features : [ object { httpServer [ propertyIs true view.lane.features.httpServer ] } { runEvery30Minutes [ propertyIs true view.lane.features.runEvery30Minutes ] } ] }
      { true : ; object { httpServer false } { runEvery30Minutes false } }
     ]
     [ object
      { id $view.lane.id }
      { title $view.lane.title }
      { width $view.lane.width }
      { path $view.lane.path }
      { packageId [ match { $view.lane.package-id : $view.lane.package-id } { true : default } ] }
      { features $feats }
      { isPreferencesLane $is-pref }
      { clockTimezone [ match { $view.lane-control.clock-timezone : $view.lane-control.clock-timezone } { true : browser } ] }
      { clockHourFormat [ match { $view.lane-control.clock-hour-format : $view.lane-control.clock-hour-format } { true : '12h' } ] }
      { clockShowSeconds [ ternary [ propertyIs false view.lane-control.clock-show-seconds ] false true ] }
     ]
    )
    ; to output-set-self-features (
     ; to { raw-features } $argv
     [ match
      { $view.lane-control.set-features : !view.lane-control.set-features $view.lane.id $raw-features }
      { true : ; object { httpServer false } { runEvery30Minutes false } }
     ]
    )
    ; to output-open-lane-tab (
     ; to { tab subroute } $argv
     [ match
      { [ and $view.lane.is-minimized $view.lane-control.restore ] : !view.lane-control.restore $view.lane.id }
     ]
     ; to clean-tab [ match { $normalizeLaneTab : !normalizeLaneTab $tab } { $tab : $tab } { true : source } ]
     ; to clean-sub [ match { $subroute.trim : !subroute.trim } { true : '' } ]
     [ match
      { [ and [ propertyIs data clean-tab ] [ propertyIsGreaterThan 0 clean-sub.length ] $view.notebook.data-view.select-table-by-name ] (
       !view.notebook.data-view.select-table-by-name $clean-sub true
      ) }
     ]
     [ match
      { $view.notebook.set-tab : !view.notebook.set-tab $clean-tab }
     ]
     [ match
      { $view.lane-control.scroll-lane-into-view : !view.lane-control.scroll-lane-into-view $view.lane }
     ]
     ; object { ok true } { tab $clean-tab } { subroute $clean-sub }
    )
    ; to output-get-clock-timezone (
     [ match { $view.lane-control.clock-timezone : $view.lane-control.clock-timezone } { true : browser } ]
    )
    ; to output-set-clock-timezone (
     ; to { tz } $argv
     [ match
      { $view.lane-control.set-clock-timezone : !view.lane-control.set-clock-timezone $tz }
      { true : $tz }
     ]
    )
    ; to output-get-clock-hour-format (
     [ match { $view.lane-control.clock-hour-format : $view.lane-control.clock-hour-format } { true : '12h' } ]
    )
    ; to output-set-clock-hour-format (
     ; to { fmt } $argv
     [ match
      { $view.lane-control.set-clock-hour-format : !view.lane-control.set-clock-hour-format $fmt }
      { true : $fmt }
     ]
    )
    ; to output-get-clock-show-seconds (
     [ ternary [ propertyIs false view.lane-control.clock-show-seconds ] false true ]
    )
    ; to output-set-clock-show-seconds (
     ; to { show-sec } $argv
     [ match
      { $view.lane-control.set-clock-show-seconds : !view.lane-control.set-clock-show-seconds $show-sec }
      { true : [ ternary $show-sec true false ] }
     ]
    )
    ; to extra-env [ object
     { syncTable $output-sync-table }
     { readTable $output-read-table }
     { setSelfLine $output-set-self-line }
     { getSelfLines $output-get-self-lines }
     { getSelfMeta $output-get-self-meta }
     { setSelfFeatures $output-set-self-features }
     { openLaneTab $output-open-lane-tab }
     { getClockTimezone $output-get-clock-timezone }
     { setClockTimezone $output-set-clock-timezone }
     { getClockHourFormat $output-get-clock-hour-format }
     { setClockHourFormat $output-set-clock-hour-format }
     { getClockShowSeconds $output-get-clock-show-seconds }
     { setClockShowSeconds $output-set-clock-show-seconds }
    ]
    ; to run-opts [ object
     { document $active-doc }
     { window $active-win }
     { console $console }
     { output $active-viewport }
     { extraEnv $extra-env }
     { isCancelled (
      ; ternary [ propertyIs $next-render-id view.render-id ] false true
     ) }
    ]
    ; to outcome !runTransportedScripts $packets $run-opts
    [ match
     { [ propertyIs $next-render-id view.render-id ] (
      ; set $outcome.results view.results
      ; set $outcome.state view.state
      ; each $outcome.results (
       ; to { res idx } $argv
       [ match
        { $res.error (
         ; to err-el !active-doc.createElement div
         ; set lane-output-error err-el.className
         ; to prefix [ match
          { $res.lineNumber : ; add 'Line ' ; add $res.lineNumber ': ' }
          { true (
           ; to num ; add $idx 1
           ; add 'Script #' ; add $num ': '
          ) }
         ]
         ; to err-text ; add $prefix $res.error
         ; set $err-text err-el.textContent
         !active-errors.appendChild $err-el
         !active-error-list.push $err-el
         ; set false active-errors.hidden
        ) }
       ]
      )
     ) }
    ]
    $outcome
   ) }
  ]
 )

 ; to view.reload (
  -- Re-runs the last collected transported scripts in the active mini-browser viewport
  !view.render $view.packets
 )

 ; to view.on-popup-closed (
  -- Recalls output back to the lane when the floating window is closed
  ; set null view.popup-window
  ; set null view.popup-doc
  ; set null view.popup-viewport-el
  ; set null view.popup-empty-el
  ; set null view.popup-errors-el
  ; set null view.popup-popin-btn
  ; set false view.is-floating
  !view.sync-visibility
  !view.render $view.packets
 )

 ; to view.popin (
  -- Closes the floating output window and recalls the output back into the lane
  ; to old-win $view.popup-window
  ; set null view.popup-window
  ; set null view.popup-doc
  ; set null view.popup-viewport-el
  ; set null view.popup-empty-el
  ; set null view.popup-errors-el
  ; set null view.popup-popin-btn
  ; set false view.is-floating
  [ match
   { $old-win (
    ; to is-closed [ propertyIs true old-win.closed ]
    ; condition { propertyIs false is-closed } (
     [ match
      { $old-win.close : !old-win.close }
     ]
    )
   ) }
  ]
  !view.sync-visibility
  !view.render $view.packets
 )

 ; to view.popout (
  -- Floats the lane output app in a new window with live refresh and a top-right pop-in button
  ; to already-live !view.has-live-popup
  [ match
   { $already-live (
    [ match
     { $view.popup-window.focus : !view.popup-window.focus }
    ]
    $view.popup-window
   ) }
   { true (
    ; to popup-win [ match
     { $window.open : !window.open '' '_blank' 'popup=yes,width=980,height=720' }
     { true : null }
    ]
    [ match
     { $popup-win (
      ; to popup-doc [ match { $popup-win.document : $popup-win.document } { true : $document } ]
      ; to win-title !view.get-title
      ; set $win-title popup-doc.title
      ; to popup-body [ match { $popup-doc.body : $popup-doc.body } { true : !popup-doc.createElement body } ]
      !clear-dom-container $popup-body
      ; to style-el !popup-doc.createElement style
      ; set '
       :root { color-scheme: dark; scrollbar-color: #383838 transparent; }
       html, body { background: #0e0e0e; color: #f4f4f4; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.45; margin: 0; padding: 0; min-height: 100vh; }
       [hidden] { display: none !important; }
       .lane-output-floating-popin { align-items: center; background: #141414d8; border: 1px solid #ffffff2e; border-radius: 5px; box-shadow: 0 2px 8px #00000088; color: #ffffffc8; cursor: pointer; display: inline-flex; height: 26px; justify-content: center; padding: 0; position: fixed; right: 8px; top: 8px; width: 26px; z-index: 2147483647; }
       .lane-output-floating-popin:hover, .lane-output-floating-popin:focus { background: #262626; border-color: #ffffff66; color: #ffffff; }
       .lane-output-viewport { background: #0e0e0e; box-sizing: border-box; color: #f4f4f4; min-height: 100vh; padding: 0.85em 1em; }
       .lane-output-viewport > :first-child { margin-top: 0; }
       .lane-output-viewport > :last-child { margin-bottom: 0; }
       .lane-output-empty { color: #ffffff5c; font-family: "IBM Plex Mono", monospace; font-size: 11px; padding: 0.9em 1em; }
       .lane-output-errors { background: #ff555514; border-top: 1px solid #ff555540; display: flex; flex-direction: column; gap: 0.25em; padding: 0.45em 0.7em; }
       .lane-output-error { color: #ff9c9c; font-family: "IBM Plex Mono", monospace; font-size: 11px; overflow-wrap: anywhere; white-space: pre-wrap; }
      ' style-el.textContent
      ; to style-host [ match { $popup-doc.head : $popup-doc.head } { true : $popup-body } ]
      !style-host.appendChild $style-el

      ; to popin-btn !popup-doc.createElement button
      ; assign $popin-btn { type button } { className lane-output-floating-popin } { title 'Pop in to lane' }
      !popin-btn.setAttribute aria-label 'Pop in to lane'
      ; set '<svg class="lane-icon-svg" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 9.5h-4v-4"></path><path d="M13.5 2.5L6.5 9.5"></path><path d="M12.5 9.5v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3"></path></svg>' popin-btn.innerHTML
      !popin-btn.addEventListener click : !view.popin

      ; to pop-viewport !popup-doc.createElement div
      ; set lane-output-viewport pop-viewport.className

      ; to pop-empty !popup-doc.createElement div
      ; assign $pop-empty { className lane-output-empty } { textContent 'No browser output yet. Use ; send ( ... ) in Source to render output.' } { hidden true }

      ; to pop-errors !popup-doc.createElement div
      ; assign $pop-errors { className lane-output-errors } { hidden true }

      !popup-body.appendChild $popin-btn
      !popup-body.appendChild $pop-viewport
      !popup-body.appendChild $pop-empty
      !popup-body.appendChild $pop-errors

      ; assign $view { popup-window $popup-win } { popup-doc $popup-doc } { popup-viewport-el $pop-viewport } { popup-empty-el $pop-empty } { popup-errors-el $pop-errors } { popup-popin-btn $popin-btn } { is-floating true }

      [ match
       { $popup-win.addEventListener (
        !popup-win.addEventListener beforeunload (
         ; condition { propertyIs $popup-win view.popup-window } : !view.on-popup-closed
        )
       ) }
      ]

      !view.sync-visibility
      !view.render $view.packets
      $popup-win
     ) }
     { true : null }
    ]
   ) }
  ]
 )

 !reload-btn.addEventListener click $view.reload
 !popout-btn.addEventListener click $view.popout
 !attach-btn.addEventListener click $view.popin
 $view
)
$scope
