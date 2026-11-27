-- file lane-story.fs
; to scope ; object
; to scope.mount (
 -- Mounts the per-lane Story timeline UI inside the given container
 ; to { lane container lane-control nb } $argv

 ; to safe-str (
  ; to { val } $argv
  [ match
   { [ propertyIs null val ] : '' }
   { [ propertyIs undefined val ] : '' }
   { true : ; add '' $val }
  ]
 )

 ; to has-val (
  ; to { val } $argv
  [ match
   { [ propertyIs null val ] : false }
   { [ propertyIs undefined val ] : false }
   { true : true }
  ]
 )

 ; to is-non-empty (
  ; to { val } $argv
  ; to s !safe-str $val
  [ match
   { [ propertyIs '' s ] : false }
   { true : true }
  ]
 )

 ; to is-string (
  ; to { val } $argv
  ; to s ; add '' $val
  [ propertyIs $val s ]
 )

 ; to clear-el (
  ; to { el } $argv
  [ match
   { $el (
    [ match
     { $el.replaceChildren : !el.replaceChildren }
     { true (
      [ match
       { $el.children (
        ; while { propertyIsGreaterThan 0 el.children.length } (
         ; to prev-len $el.children.length
         ; to idx ; subtract $prev-len 1
         ; to child [ get el.children $idx ]
         [ match
          { $child.remove : !child.remove }
         ]
         ; condition { propertyIs $prev-len el.children.length } : !el.children.pop
        )
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to resolve-browser-tz (
  [ match
   { $getBrowserTimeZone (
    ; to intl [ match
     { $window.Intl : $window.Intl }
     { true : null }
    ]
    !getBrowserTimeZone $intl
   ) }
   { true : UTC }
  ]
 )

 ; to resolve-active-tz (
  ; to opts [ match
   { $lane-control.get-clock-display-options : !lane-control.get-clock-display-options }
   { true : null }
  ]
  [ match
   { $opts.timeZone : $opts.timeZone }
   { true (
    ; to raw-tz [ match
     { $lane-control.clock-timezone : $lane-control.clock-timezone }
     { true : browser }
    ]
    ; to tz-str !safe-str $raw-tz
    ; to clean !tz-str.trim
    [ match
     { [ propertyIs '' clean ] : !resolve-browser-tz }
     { [ propertyIs browser clean ] : !resolve-browser-tz }
     { true : $clean }
    ]
   ) }
  ]
 )

 ; to resolve-hour-format (
  ; to opts [ match
   { $lane-control.get-clock-display-options : !lane-control.get-clock-display-options }
   { true : null }
  ]
  ; to raw-hr [ match
   { $opts.hourFormat : $opts.hourFormat }
   { $lane-control.clock-hour-format : $lane-control.clock-hour-format }
   { true : '12h' }
  ]
  [ match
   { [ propertyIs '24h' raw-hr ] : '24h' }
   { [ propertyIs '24' raw-hr ] : '24h' }
   { true : '12h' }
  ]
 )

 ; to resolve-show-seconds (
  [ match
   { [ propertyIs false lane-control.clock-show-seconds ] : false }
   { [ propertyIs 'false' lane-control.clock-show-seconds ] : false }
   { true : true }
  ]
 )

 ; to format-trigger-label (
  ; to { trig } $argv
  [ match
   { [ propertyIs cron trig ] : Cron }
   { [ propertyIs manual trig ] : Run }
   { [ propertyIs mount trig ] : Mount }
   { [ propertyIs import trig ] : Import }
   { [ propertyIs export trig ] : Export }
   { [ propertyIs table-change trig ] : Table }
   { [ propertyIs agent trig ] : Agent }
   { [ propertyIs preferences trig ] : Prefs }
   { $trig : !safe-str $trig }
   { true : Run }
  ]
 )

 ; to format-date-ymd (
  ; to { ms } $argv
  [ match
   { [ propertyIs null ms ] : '…' }
   { [ propertyIs undefined ms ] : '…' }
   { true (
    ; to dt !window.Reflect.construct $window.Date { $ms }
    ; to iso !dt.toISOString
    !iso.slice 0 10
   ) }
  ]
 )

 ; to parse-date-input (
  ; to { raw is-end } $argv
  ; to raw-str !safe-str $raw
  ; to trimmed !raw-str.trim
  [ match
   { [ propertyIs '' trimmed ] : null }
   { true (
    ; to parts !trimmed.split '-'
    ; to tz !resolve-active-tz
    ; to parsed-ms [ match
     { [ propertyIs 3 parts.length ] (
      ; to y ; multiply 1 $parts.0
      ; to m1 ; multiply 1 $parts.1
      ; to m0 ; subtract $m1 1
      ; to d ; multiply 1 $parts.2
      ; to hh [ ternary $is-end 23 0 ]
      ; to mm [ ternary $is-end 59 0 ]
      ; to ss [ ternary $is-end 59 0 ]
      ; to ms [ ternary $is-end 999 0 ]
      ; to zoned-ms [ match
       { $zonedWallClockToUtcMs : !zonedWallClockToUtcMs [ object { year $y } { month $m1 } { day $d } { hour $hh } { minute $mm } { second $ss } { millisecond $ms } ] $tz $window.Intl }
       { true : null }
      ]
      [ match
       { [ and { [ propertyIs false [ propertyIs null zoned-ms ] ] } { [ propertyIs false [ propertyIs undefined zoned-ms ] ] } { [ propertyIs $zoned-ms zoned-ms ] } ] : $zoned-ms }
       { true (
        ; to dt !window.Reflect.construct $window.Date { $y $m0 $d $hh $mm $ss $ms }
        ; to ts !dt.getTime
        [ match
         { [ propertyIs $ts ts ] : $ts }
         { true : null }
        ]
       ) }
      ]
     ) }
     { true : null }
    ]
    [ match
     { [ propertyIs null parsed-ms ] (
      ; to suffix [ ternary $is-end 'T23:59:59.999' 'T00:00:00.000' ]
      ; to candidate ; add $trimmed $suffix
      ; to ts [ match
       { $window.Date.parse : !window.Date.parse $candidate }
       { true : null }
      ]
      [ match
       { [ propertyIs null ts ] : null }
       { [ propertyIs undefined ts ] : null }
       { [ propertyIs $ts ts ] : $ts }
       { true : null }
      ]
     ) }
     { true : $parsed-ms }
    ]
   ) }
  ]
 )

 ; to view [ object
  { lane $lane }
  { container $container }
  { lane-control $lane-control }
  { nb $nb }
  { entries {} }
  { entry-els {} }
  { bucket-els {} }
  { rendered-nodes {} }
  { needs-refresh true }
  { is-loaded false }
  { is-loading false }
  { is-loading-more false }
  { is-jump-open false }
  { is-jumped false }
  { jump-mode null }
  { jump-label '' }
  { has-more false }
  { next-cursor null }
  { total 0 }
  { now-fn null }
  { last-heading-key null }
  { first-heading-key null }
  { first-heading-el null }
  { active-before-ts null }
  { active-before-id null }
  { start-ts null }
  { end-ts null }
  { query-seq 0 }
  { bucket-seq 0 }
 ]

 ; to get-now-ms (
  [ match
   { $view.now-fn : !view.now-fn }
   { true (
    ; to dt !window.Reflect.construct $window.Date {}
    !dt.getTime
   ) }
  ]
 )

 ; to format-heading (
  ; to { ts now-ms tz } $argv
  [ match
   { $classifyStoryHeading : !classifyStoryHeading $ts [ object { now $now-ms } { timeZone $tz } ] }
   { true (
    ; to dt !window.Reflect.construct $window.Date { $ts }
    ; to iso !dt.toISOString
    ; to day !iso.slice 0 10
    ; object { key $day } { label $day } { kind day }
   ) }
  ]
 )

 ; to format-entry-time (
  ; to { ts kind tz hour-fmt show-sec } $argv
  [ match
   { $formatStoryEntryTime : !formatStoryEntryTime $ts $kind [ object { timeZone $tz } { hourFormat $hour-fmt } { showSeconds $show-sec } ] }
   { true (
    ; to dt !window.Reflect.construct $window.Date { $ts }
    !dt.toISOString
   ) }
  ]
 )

 ; to root-el !document.createElement div
 ; set lane-story root-el.className

 ; to toolbar-el !document.createElement div
 ; set lane-story-toolbar toolbar-el.className

 ; to toolbar-left !document.createElement div
 ; set lane-story-toolbar-left toolbar-left.className
 ; to status-el !document.createElement span
 ; assign $status-el { className lane-story-status } { textContent 'Loading…' }
 ; to latest-btn !document.createElement button
 ; assign $latest-btn { type button } { className lane-story-latest-btn } { textContent '↑ Latest' } { title 'Return to latest runs' } { hidden true }
 !toolbar-left.appendChild $status-el
 !toolbar-left.appendChild $latest-btn

 ; to toolbar-right !document.createElement div
 ; set lane-story-toolbar-right toolbar-right.className
 ; to jump-btn !document.createElement button
 ; assign $jump-btn { type button } { className lane-story-jump-btn } { textContent 'Jump to...' } { title 'Jump to a date bucket or range' }
 !jump-btn.setAttribute aria-expanded 'false'
 ; to refresh-btn !document.createElement button
 ; assign $refresh-btn { type button } { className lane-story-refresh-btn } { textContent '↻' } { title 'Refresh story' }
 !toolbar-right.appendChild $jump-btn
 !toolbar-right.appendChild $refresh-btn

 !toolbar-el.appendChild $toolbar-left
 !toolbar-el.appendChild $toolbar-right

 ; to jump-panel !document.createElement div
 ; assign $jump-panel { className lane-story-jump-panel } { hidden true }

 ; to buckets-el !document.createElement div
 ; set lane-story-buckets buckets-el.className

 ; to range-el !document.createElement div
 ; set lane-story-range range-el.className
 ; to range-from-input !document.createElement input
 ; assign $range-from-input { type date } { className lane-story-date-input }
 !range-from-input.setAttribute aria-label 'From date'
 ; to range-sep !document.createElement span
 ; assign $range-sep { className lane-story-range-sep } { textContent '–' }
 ; to range-to-input !document.createElement input
 ; assign $range-to-input { type date } { className lane-story-date-input }
 !range-to-input.setAttribute aria-label 'To date'
 ; to range-go-btn !document.createElement button
 ; assign $range-go-btn { type button } { className lane-story-range-btn } { textContent Go }
 ; to range-reset-btn !document.createElement button
 ; assign $range-reset-btn { type button } { className lane-story-range-btn } { textContent Reset }

 !range-el.appendChild $range-from-input
 !range-el.appendChild $range-sep
 !range-el.appendChild $range-to-input
 !range-el.appendChild $range-go-btn
 !range-el.appendChild $range-reset-btn

 !jump-panel.appendChild $buckets-el
 !jump-panel.appendChild $range-el

 ; to scroller-el !document.createElement div
 ; set lane-story-scroller scroller-el.className
 ; to entries-el !document.createElement div
 ; set lane-story-list entries-el.className
 ; to loading-el !document.createElement div
 ; assign $loading-el { className cc-loading } { textContent 'Loading runs…' } { hidden false }
 ; to empty-el !document.createElement div
 ; assign $empty-el { className lane-story-empty } { textContent 'No runs recorded yet.' } { hidden true }
 ; to footer-el !document.createElement div
 ; assign $footer-el { className lane-story-footer } { hidden true }
 ; to load-more-btn !document.createElement button
 ; assign $load-more-btn { type button } { className lane-story-load-more } { textContent 'Load older runs' }
 !footer-el.appendChild $load-more-btn

 !scroller-el.appendChild $entries-el
 !scroller-el.appendChild $loading-el
 !scroller-el.appendChild $empty-el
 !scroller-el.appendChild $footer-el

 !root-el.appendChild $toolbar-el
 !root-el.appendChild $jump-panel
 !root-el.appendChild $scroller-el
 !container.appendChild $root-el

 ; assign $view { element $root-el } { toolbar-el $toolbar-el } { status-el $status-el } { latest-btn $latest-btn } { jump-btn $jump-btn } { refresh-btn $refresh-btn } { jump-panel $jump-panel } { buckets-el $buckets-el } { range-from-input $range-from-input } { range-to-input $range-to-input } { range-go-btn $range-go-btn } { range-reset-btn $range-reset-btn } { scroller-el $scroller-el } { entries-el $entries-el } { loading-el $loading-el } { empty-el $empty-el } { footer-el $footer-el } { load-more-btn $load-more-btn }

 ; to sync-status (
  ; to has-total !has-val $view.total
  ; to count-num [ match
   { $has-total : $view.total }
   { true : $view.entries.length }
  ]
  ; to has-entries [ propertyIsGreaterThan 0 view.entries.length ]
  ; to show-loading [ and { [ propertyIs true view.is-loading ] } { [ propertyIs false has-entries ] } ]
  ; to show-empty [ and { [ propertyIs true view.is-loaded ] } { [ propertyIs false view.is-loading ] } { [ propertyIs false has-entries ] } ]
  ; set [ ternary $view.is-jumped false true ] latest-btn.hidden
  ; set [ ternary $view.is-jumped 'No runs in selected range.' 'No runs recorded yet.' ] empty-el.textContent
  ; set [ ternary $show-loading false true ] loading-el.hidden
  ; set [ ternary $show-empty false true ] empty-el.hidden
  ; set [ ternary $view.has-more false true ] footer-el.hidden
  ; set [ ternary $view.is-loading-more 'Loading…' 'Load older runs' ] load-more-btn.textContent
  ; set [ match { $view.is-loading : true } { $view.is-loading-more : true } { true : false } ] load-more-btn.disabled
  ; set [ ternary $view.is-loading true false ] refresh-btn.disabled
  ; set [ ternary $view.is-loading 'lane-story-refresh-btn lane-story-refresh-btn--loading' lane-story-refresh-btn ] refresh-btn.className
  ; to status-txt [ match
   { $view.is-loading (
    [ match
     { $view.is-loaded : 'Refreshing…' }
     { true : 'Loading…' }
    ]
   ) }
   { $view.is-jumped (
    [ match
     { [ propertyIs range view.jump-mode ] : ; add 'Range: ' $view.jump-label }
     { true : ; add 'Jumped: ' ; add $view.jump-label ; add ' (' ; add $count-num ' total)' }
    ]
   ) }
   { [ propertyIs 1 count-num ] : '1 run' }
   { true : ; add $count-num ' runs' }
  ]
  ; set $status-txt status-el.textContent
 )

 ; to make-lane-link (
  ; to { label lane-id } $argv
  ; to btn !document.createElement button
  ; assign $btn { type button } { className lane-story-lane-link } { textContent $label }
  [ match
   { $lane-id (
    !btn.setAttribute title [ ; add 'Locate lane ' $label ]
    !btn.addEventListener click (
     ; to { ev } $argv
     [ match
      { $ev.stopPropagation : !ev.stopPropagation }
     ]
     [ match
      { $lane-control.locate-lane : !lane-control.locate-lane $lane-id }
     ]
    )
   ) }
  ]
  $btn
 )

 ; to render-detail (
  ; to { detail-el entry detail } $argv
  !clear-el $detail-el

  -- 1. Inputs section
  ; to in-sec !document.createElement div
  ; set lane-story-section in-sec.className
  ; to in-title !document.createElement div
  ; assign $in-title { className lane-story-section-title } { textContent Inputs }
  !in-sec.appendChild $in-title
  ; to inputs-list [ match
   { $detail.inputs : $detail.inputs }
   { true : {} }
  ]
  [ match
   { [ propertyIsGreaterThan 0 inputs-list.length ] (
    ; each $inputs-list (
     ; to { inp } $argv
     ; to row-el !document.createElement div
     ; set lane-story-kv-row row-el.className
     ; to inp-name !safe-str $inp.name
     ; to inp-type !safe-str $inp.type
     ; to has-inp-prev !has-val $inp.preview
     ; to inp-prev [ match
      { $has-inp-prev : !safe-str $inp.preview }
      { $inp.secret : '••••••••' }
      { true : '' }
     ]
     ; to key-el !document.createElement span
     ; assign $key-el { className lane-story-kv-key } { textContent [ ; add $inp-name ; add ' (' ; add $inp-type ') = ' ] }
     ; to val-el !document.createElement code
     ; assign $val-el { className lane-story-kv-val } { textContent $inp-prev }
     !row-el.appendChild $key-el
     !row-el.appendChild $val-el
     !in-sec.appendChild $row-el
    )
   ) }
   { true (
    ; to muted !document.createElement div
    ; assign $muted { className lane-story-muted } { textContent 'No inputs' }
    !in-sec.appendChild $muted
   ) }
  ]
  !detail-el.appendChild $in-sec

  -- 2. Imported from lanes section
  ; to imp-sec !document.createElement div
  ; set lane-story-section imp-sec.className
  ; to imp-title !document.createElement div
  ; assign $imp-title { className lane-story-section-title } { textContent 'Imported from lanes' }
  !imp-sec.appendChild $imp-title
  ; to imports-list [ match
   { $detail.imports : $detail.imports }
   { true : {} }
  ]
  [ match
   { [ propertyIsGreaterThan 0 imports-list.length ] (
    ; each $imports-list (
     ; to { imp } $argv
     ; to row-el !document.createElement div
     ; set lane-story-import-row row-el.className
     ; to alias-str [ match
      { $imp.alias : !safe-str $imp.alias }
      { true : '(import)' }
     ]
     ; to alias-el !document.createElement span
     ; assign $alias-el { className lane-story-import-alias } { textContent [ ; add $alias-str ' ← ' ] }
     !row-el.appendChild $alias-el

     ; to title-str [ match
      { $imp.laneTitle : !safe-str $imp.laneTitle }
      { $imp.laneId : !safe-str $imp.laneId }
      { true : '(lane)' }
     ]
     ; to raw-path [ match
      { $imp.path.join : !imp.path.join '.' }
      { true : !safe-str $imp.path }
     ]
     ; to path-label [ match
      { [ propertyIs '' raw-path ] : '(whole lane)' }
      { true : ; add '$' $raw-path }
     ]
     ; to link-btn !make-lane-link [ ; add $title-str ; add ' · ' $path-label ] $imp.laneId
     !row-el.appendChild $link-btn

     ; to imp-has-err [ match
      { $imp.error : true }
      { [ propertyIs false imp.ok ] : true }
      { true : false }
     ]
     [ match
      { $imp-has-err (
       ; to err-el !document.createElement div
       ; to err-txt [ match { $imp.error : !safe-str $imp.error } { true : 'Import error' } ]
       ; assign $err-el { className lane-story-error } { textContent $err-txt }
       !row-el.appendChild $err-el
      ) }
      { true (
       ; to prev-el !document.createElement code
       ; assign $prev-el { className lane-story-kv-val } { textContent !safe-str $imp.preview }
       !row-el.appendChild $prev-el
      ) }
     ]
     !imp-sec.appendChild $row-el
    )
   ) }
   { true (
    ; to muted !document.createElement div
    ; assign $muted { className lane-story-muted } { textContent 'No imports' }
    !imp-sec.appendChild $muted
   ) }
  ]
  !detail-el.appendChild $imp-sec

  -- 3. Exported to lanes section
  ; to exp-sec !document.createElement div
  ; set lane-story-section exp-sec.className
  ; to exp-title !document.createElement div
  ; assign $exp-title { className lane-story-section-title } { textContent 'Exported to lanes' }
  !exp-sec.appendChild $exp-title
  ; to exports-list [ match
   { $detail.exports : $detail.exports }
   { true : {} }
  ]
  [ match
   { [ propertyIsGreaterThan 0 exports-list.length ] (
    ; each $exports-list (
     ; to { exp } $argv
     ; to row-el !document.createElement div
     ; set lane-story-export-row row-el.className
     ; to targets [ match
      { $exp.targets : $exp.targets }
      { true : {} }
     ]
     [ match
      { [ propertyIs table exp.kind ] (
       ; to tbl-name !safe-str $exp.tableName
       ; to has-cnt !has-val $exp.count
       ; to row-cnt [ ternary $has-cnt $exp.count 0 ]
       ; each $targets (
        ; to { tgt } $argv
        ; to t-title [ match
         { $tgt.laneTitle : !safe-str $tgt.laneTitle }
         { $tgt.laneId : !safe-str $tgt.laneId }
         { true : '(lane)' }
        ]
        ; to link-btn !make-lane-link [ ; add $t-title ; add ' · table ' $tbl-name ] $tgt.laneId
        !row-el.appendChild $link-btn
       )
       ; to cnt-el !document.createElement span
       ; assign $cnt-el { className lane-story-badge } { textContent [ ; add $row-cnt ' rows' ] }
       !row-el.appendChild $cnt-el
       [ match
        { $exp.error (
         ; to err-el !document.createElement div
         ; assign $err-el { className lane-story-error } { textContent !safe-str $exp.error }
         !row-el.appendChild $err-el
        ) }
       ]
      ) }
      { true (
       ; each $targets (
        ; to { tgt } $argv
        ; to t-title [ match
         { $tgt.laneTitle : !safe-str $tgt.laneTitle }
         { $tgt.laneId : !safe-str $tgt.laneId }
         { true : '(lane)' }
        ]
        ; to t-line [ match
         { $tgt.lineNumber : ; add ' · L' $tgt.lineNumber }
         { $tgt.lineId : ; add ' · ' $tgt.lineId }
         { true : '' }
        ]
        ; to link-btn !make-lane-link [ ; add $t-title $t-line ] $tgt.laneId
        !row-el.appendChild $link-btn
        ; to chg-txt [ match
         { [ propertyIs true tgt.changed ] : changed }
         { [ propertyIs false tgt.changed ] : unchanged }
         { true : '' }
        ]
        ; to has-chg !is-non-empty $chg-txt
        [ match
         { $has-chg (
          ; to chg-el !document.createElement span
          ; assign $chg-el { className lane-story-badge } { textContent $chg-txt }
          !row-el.appendChild $chg-el
         ) }
        ]
       )
       ; to has-content !has-val $exp.content
       ; to has-preview !has-val $exp.preview
       ; to exp-val-txt [ match
        { $has-content : !safe-str $exp.content }
        { $has-preview : !safe-str $exp.preview }
        { true : '' }
       ]
       ; to has-exp-val !is-non-empty $exp-val-txt
       [ match
        { $has-exp-val (
         ; to val-el !document.createElement code
         ; assign $val-el { className lane-story-kv-val } { textContent $exp-val-txt }
         !row-el.appendChild $val-el
        ) }
       ]
       [ match
        { $exp.error (
         ; to err-el !document.createElement div
         ; assign $err-el { className lane-story-error } { textContent !safe-str $exp.error }
         !row-el.appendChild $err-el
        ) }
       ]
      ) }
     ]
     !exp-sec.appendChild $row-el
    )
   ) }
   { true (
    ; to muted !document.createElement div
    ; assign $muted { className lane-story-muted } { textContent 'No exports' }
    !exp-sec.appendChild $muted
   ) }
  ]
  !detail-el.appendChild $exp-sec

  -- 4. Final Value section
  ; to fv-sec !document.createElement div
  ; set lane-story-section fv-sec.className
  ; to fv-title !document.createElement div
  ; assign $fv-title { className lane-story-section-title } { textContent 'Final Value' }
  !fv-sec.appendChild $fv-title
  ; to fv $detail.finalValue
  ; to has-fv-prev !has-val $fv.preview
  ; to has-entry-fin !has-val $entry.fin.p
  ; to fv-prev [ match
   { $has-fv-prev : !safe-str $fv.preview }
   { $entry.err : !safe-str $entry.err }
   { $has-entry-fin : !safe-str $entry.fin.p }
   { true : undefined }
  ]
  ; to fv-el !document.createElement div
  ; assign $fv-el { className lane-story-final-val } { textContent $fv-prev }
  !fv-sec.appendChild $fv-el
  ; to fv-json !safe-str $fv.json
  ; to has-fv-json !is-non-empty $fv-json
  ; to fv-has-nl [ match
   { $fv-json.includes : !fv-json.includes '\n' }
   { true : false }
  ]
  ; to fv-differs [ match
   { [ propertyIs '' fv-json ] : false }
   { [ propertyIs $fv-prev fv-json ] : false }
   { true : true }
  ]
  ; to show-fv-pre [ match
   { $fv-has-nl : true }
   { $fv-differs : true }
   { $entry.err : true }
   { true : false }
  ]
  [ match
   { $show-fv-pre (
    ; to pre-txt [ match
     { $has-fv-json : $fv-json }
     { true : !safe-str $entry.err }
    ]
    ; to has-pre !is-non-empty $pre-txt
    [ match
     { $has-pre (
      ; to pre-el !document.createElement pre
      ; assign $pre-el { className lane-story-json } { textContent $pre-txt }
      !fv-sec.appendChild $pre-el
     ) }
    ]
   ) }
  ]
  !detail-el.appendChild $fv-sec

  -- 5. Source Run Output section
  ; to out-sec !document.createElement div
  ; set lane-story-section out-sec.className
  ; to out-title !document.createElement div
  ; assign $out-title { className lane-story-section-title } { textContent 'Source Run Output' }
  !out-sec.appendChild $out-title
  ; to lines-list [ match
   { $detail.lines : $detail.lines }
   { true : {} }
  ]
  [ match
   { [ propertyIsGreaterThan 0 lines-list.length ] (
    ; each $lines-list (
     ; to { ln } $argv
     ; to ln-has-err [ match { $ln.error : true } { true : false } ]
     ; to ln-cls [ ternary $ln-has-err 'lane-story-output-line lane-story-output-line--error' lane-story-output-line ]
     ; to ln-el !document.createElement div
     ; set $ln-cls ln-el.className

     ; to ln-num [ match { $ln.lineNumber : $ln.lineNumber } { true : '?' } ]
     ; to num-el !document.createElement span
     ; assign $num-el { className lane-story-line-num } { textContent [ ; add L $ln-num ] }

     ; to src-el !document.createElement code
     ; assign $src-el { className lane-story-line-source } { textContent !safe-str $ln.source }

     ; to res-cls [ ternary $ln-has-err 'lane-story-line-result lane-story-line-result--error' lane-story-line-result ]
     ; to res-txt [ match
      { $ln-has-err : !safe-str $ln.error }
      { true : !safe-str $ln.preview }
     ]
     ; to res-el !document.createElement span
     ; assign $res-el { className $res-cls } { textContent $res-txt }

     !ln-el.appendChild $num-el
     !ln-el.appendChild $src-el
     !ln-el.appendChild $res-el
     !out-sec.appendChild $ln-el
    )
   ) }
   { true (
    ; to muted !document.createElement div
    ; assign $muted { className lane-story-muted } { textContent 'No source lines' }
    !out-sec.appendChild $muted
   ) }
  ]

  ; to sent-list [ match
   { $detail.sent : $detail.sent }
   { true : {} }
  ]
  [ match
   { [ propertyIsGreaterThan 0 sent-list.length ] (
    ; to sent-hdr !document.createElement div
    ; assign $sent-hdr { className lane-story-subsection-title } { textContent [ ; add 'Sent to View (' ; add $sent-list.length ')' ] }
    !out-sec.appendChild $sent-hdr
    ; each $sent-list (
     ; to { pkt } $argv
     ; to has-pkt-prev !has-val $pkt.preview
     ; to has-pkt-json !has-val $pkt.json
     ; to pkt-is-str !is-string $pkt
     ; to pkt-txt [ match
      { $has-pkt-prev : !safe-str $pkt.preview }
      { $has-pkt-json : !safe-str $pkt.json }
      { $pkt-is-str : $pkt }
      { true : !window.JSON.stringify $pkt }
     ]
     ; to pkt-el !document.createElement pre
     ; assign $pkt-el { className lane-story-sent-item } { textContent $pkt-txt }
     !out-sec.appendChild $pkt-el
    )
   ) }
  ]
  !detail-el.appendChild $out-sec
 )

 ; to build-entry-card (
  ; to { entry heading tz hour-fmt show-sec } $argv
  ; to is-ok [ match
   { [ propertyIs false entry.ok ] : false }
   { true : true }
  ]
  ; to card-el !document.createElement div
  ; to card-cls [ ternary $is-ok lane-story-entry 'lane-story-entry lane-story-entry--error' ]
  ; set $card-cls card-el.className
  !card-el.setAttribute data-story-id [ !safe-str $entry.id ]

  ; to header-btn !document.createElement button
  ; assign $header-btn { type button } { className lane-story-entry-header }
  !header-btn.setAttribute aria-expanded 'false'

  ; to caret-el !document.createElement span
  ; assign $caret-el { className lane-story-caret } { textContent '▸' }

  ; to time-str !format-entry-time $entry.ts $heading.kind $tz $hour-fmt $show-sec
  ; to time-el !document.createElement span
  ; assign $time-el { className lane-story-time } { textContent $time-str }

  ; to raw-trig [ match { $entry.trig : !safe-str $entry.trig } { true : manual } ]
  ; to trig-label !format-trigger-label $raw-trig
  ; to trig-cls ; add 'lane-story-trigger lane-story-trigger--' $raw-trig
  ; to trig-el !document.createElement span
  ; assign $trig-el { className $trig-cls } { textContent $trig-label }

  ; to has-ms !has-val $entry.ms
  ; to ms-val [ ternary $has-ms $entry.ms 0 ]
  ; to meta-txt [ match
   { $is-ok : ; add $ms-val 'ms' }
   { true : Error }
  ]
  ; to meta-cls [ ternary $is-ok lane-story-meta 'lane-story-meta lane-story-meta--error' ]
  ; to meta-el !document.createElement span
  ; assign $meta-el { className $meta-cls } { textContent $meta-txt }

  ; to counts-el !document.createElement span
  ; set lane-story-counts counts-el.className
  ; to pill-count ; object { n 0 }
  ; to add-pill (
   ; to { cnt suffix } $argv
   [ match
    { [ propertyIsGreaterThan 0 cnt ] (
     ; to p !document.createElement span
     ; assign $p { className lane-story-count-pill } { textContent [ ; add $cnt $suffix ] }
     !counts-el.appendChild $p
     ; set [ ; add $pill-count.n 1 ] pill-count.n
    ) }
   ]
  )
  !add-pill $entry.inCnt ' in'
  !add-pill $entry.impCnt ' imp'
  !add-pill $entry.expCnt ' exp'
  !add-pill $entry.sentCnt ' sent'
  ; set [ ternary [ propertyIsGreaterThan 0 pill-count.n ] false true ] counts-el.hidden

  ; to has-fin-p !has-val $entry.fin.p
  ; to fin-preview [ match
   { $entry.err : !safe-str $entry.err }
   { $has-fin-p : !safe-str $entry.fin.p }
   { true : '' }
  ]
  ; to final-el !document.createElement code
  ; assign $final-el { className lane-story-final-preview } { textContent [ ; add '→ ' $fin-preview ] }

  !header-btn.appendChild $caret-el
  !header-btn.appendChild $time-el
  !header-btn.appendChild $trig-el
  !header-btn.appendChild $meta-el
  !header-btn.appendChild $counts-el
  !header-btn.appendChild $final-el

  ; to detail-el !document.createElement div
  ; assign $detail-el { className lane-story-detail } { hidden true }

  !card-el.appendChild $header-btn
  !card-el.appendChild $detail-el

  ; to card-state [ object
   { expanded false }
   { detail-loaded false }
   { detail-loading false }
  ]

  !header-btn.addEventListener click (
   ; to next-exp [ ternary $card-state.expanded false true ]
   ; set $next-exp card-state.expanded
   ; set [ ternary $next-exp false true ] detail-el.hidden
   ; set [ ternary $next-exp '▾' '▸' ] caret-el.textContent
   !header-btn.setAttribute aria-expanded [ ternary $next-exp 'true' 'false' ]
   [ match
    { [ and { $next-exp } { [ propertyIs false card-state.detail-loaded ] } { [ propertyIs false card-state.detail-loading ] } ] (
     ; set true card-state.detail-loading
     !clear-el $detail-el
     ; to loading-el !document.createElement div
     ; assign $loading-el { className lane-story-muted } { textContent 'Loading details…' }
     !detail-el.appendChild $loading-el
     ; to loaded-detail ; object { val null }
     ; try (
      ; to res [ match
       { $loadLaneStoryDetail : !loadLaneStoryDetail $data $lane.data $lane.id $entry }
       { $entry.detail : $entry.detail }
       { $entry.inl : $entry.inl }
       { true : null }
      ]
      ; set $res loaded-detail.val
     ) (
      ; to { err } $argv
      [ match
       { $console.error : !console.error 'Failed to load story detail:' $err }
      ]
     )
     ; set false card-state.detail-loading
     [ match
      { $loaded-detail.val (
       ; set true card-state.detail-loaded
       !render-detail $detail-el $entry $loaded-detail.val
      ) }
      { true (
       !clear-el $detail-el
       ; to no-det !document.createElement div
       ; assign $no-det { className lane-story-muted } { textContent 'Details unavailable.' }
       !detail-el.appendChild $no-det
      ) }
     ]
    ) }
   ]
  )

  $card-el
 )

 ; to append-entries (
  ; to { items } $argv
  ; to now-ms !get-now-ms
  ; to tz !resolve-active-tz
  ; to hour-fmt !resolve-hour-format
  ; to show-sec !resolve-show-seconds
  ; each $items (
   ; to { entry } $argv
   ; to heading !format-heading $entry.ts $now-ms $tz
   ; to same-heading [ match
    { [ propertyIs null view.last-heading-key ] : false }
    { [ propertyIs $heading.key view.last-heading-key ] : true }
    { true : false }
   ]
   [ match
    { [ propertyIs false same-heading ] (
     ; to hdr-el !document.createElement div
     ; assign $hdr-el { className lane-story-heading } { textContent $heading.label }
     !hdr-el.setAttribute data-heading-key [ !safe-str $heading.key ]
     !entries-el.appendChild $hdr-el
     !view.rendered-nodes.push $hdr-el
     ; set $heading.key view.last-heading-key
     [ match
      { [ propertyIs null view.first-heading-el ] (
       ; set $hdr-el view.first-heading-el
       ; set $heading.key view.first-heading-key
      ) }
     ]
    ) }
   ]
   ; to card-el !build-entry-card $entry $heading $tz $hour-fmt $show-sec
   !entries-el.appendChild $card-el
   !view.rendered-nodes.push $card-el
   !view.entries.push $entry
   !view.entry-els.push $card-el
  )
 )

 ; to run-query (
  ; to { opts } $argv
  [ match
   { $queryLaneStories : !queryLaneStories $data $lane.data $lane.id $opts }
   { true : ; object { entries {} } { hasMore false } { nextCursor null } { total 0 } }
  ]
 )

 ; to view.reload (
  -- Queries the first page for the active timeline or jump filter, keeping existing cards visible unless clear-existing is requested
  ; to { opts } $argv
  ; to clear-existing [ match
   { $opts.clear-existing : true }
   { [ propertyIs true opts ] : true }
   { true : false }
  ]
  ; to next-seq ; add $view.query-seq 1
  ; set $next-seq view.query-seq
  ; set true view.is-loading
  ; set false view.is-loading-more
  [ match
   { $clear-existing (
    ; set false view.has-more
    ; set null view.next-cursor
    ; set 0 view.entries.length
    ; set 0 view.entry-els.length
    ; set 0 view.rendered-nodes.length
    ; set null view.last-heading-key
    ; set null view.first-heading-key
    ; set null view.first-heading-el
    !clear-el $entries-el
   ) }
  ]
  !sync-status

  ; to page-size [ match
   { $DEFAULT_STORY_PAGE_SIZE : $DEFAULT_STORY_PAGE_SIZE }
   { true : 20 }
  ]
  ; to q-opts [ object
   { limit $page-size }
   { beforeTs $view.active-before-ts }
   { beforeId $view.active-before-id }
   { startTs $view.start-ts }
   { endTs $view.end-ts }
  ]
  ; to res-box ; object { res null }
  ; try (
   ; to r !run-query $q-opts
   ; set $r res-box.res
  ) (
   ; to { err } $argv
   [ match
    { $console.error : !console.error 'Failed to load lane story:' $err }
   ]
  )
  ; condition { propertyIs $next-seq view.query-seq } (
   ; set false view.is-loading
   ; set true view.is-loaded
   ; set false view.needs-refresh
   [ match
    { [ propertyIs false clear-existing ] (
     ; set 0 view.entries.length
     ; set 0 view.entry-els.length
     ; set 0 view.rendered-nodes.length
     ; set null view.last-heading-key
     ; set null view.first-heading-key
     ; set null view.first-heading-el
     !clear-el $entries-el
    ) }
   ]
   ; to res [ match
    { $res-box.res : $res-box.res }
    { true : ; object { entries {} } { hasMore false } { nextCursor null } { total 0 } }
   ]
   ; to items [ match { $res.entries : $res.entries } { true : {} } ]
   ; to has-res-total !has-val $res.total
   ; set [ ternary $has-res-total $res.total $items.length ] view.total
   ; set [ ternary $res.hasMore true false ] view.has-more
   ; set [ match { $res.nextCursor : $res.nextCursor } { true : null } ] view.next-cursor
   !append-entries $items
   !sync-status
  )
  [ match
   { $view.is-jump-open : !view.refresh-buckets }
  ]
  $view
 )

 ; to view.load-more (
  -- Queries and appends the next page of older story entries
  [ match
   { [ and { $view.has-more } { [ propertyIs false view.is-loading ] } { [ propertyIs false view.is-loading-more ] } { $view.next-cursor } ] (
    ; to seq $view.query-seq
    ; set true view.is-loading-more
    !sync-status
    ; to page-size [ match
     { $DEFAULT_STORY_PAGE_SIZE : $DEFAULT_STORY_PAGE_SIZE }
     { true : 20 }
    ]
    ; to q-opts [ object
     { limit $page-size }
     { beforeTs $view.next-cursor.beforeTs }
     { beforeId $view.next-cursor.beforeId }
     { startTs $view.start-ts }
     { endTs $view.end-ts }
    ]
    ; to res-box ; object { res null }
    ; try (
     ; to r !run-query $q-opts
     ; set $r res-box.res
    ) (
     ; to { err } $argv
     [ match
      { $console.error : !console.error 'Failed to load older story entries:' $err }
     ]
    )
    ; condition { propertyIs $seq view.query-seq } (
     ; set false view.is-loading-more
     ; to res $res-box.res
     [ match
      { $res (
       ; to items [ match { $res.entries : $res.entries } { true : {} } ]
       !append-entries $items
       ; set [ ternary $res.hasMore true false ] view.has-more
       ; set [ match { $res.nextCursor : $res.nextCursor } { true : null } ] view.next-cursor
       ; to has-res-total !has-val $res.total
       [ match
        { $has-res-total : ; set $res.total view.total }
       ]
      ) }
     ]
     !sync-status
    )
   ) }
  ]
  $view
 )

 ; to view.on-new-entry (
  -- Updates or marks Story dirty when a new run snapshot is recorded
  ; to { entry } $argv
  ; to is-active [ match
   { $nb : [ propertyIs story nb.active-tab ] }
   { true : true }
  ]
  ; to has-entry-ts !has-val $entry.ts
  [ match
   { [ and { $is-active } { $view.is-loaded } { [ propertyIs false view.is-jumped ] } ] (
    [ match
     { [ and { $entry.id } { $has-entry-ts } { [ propertyIs false view.is-loading ] } ] (
      ; to now-ms !get-now-ms
      ; to tz !resolve-active-tz
      ; to hour-fmt !resolve-hour-format
      ; to show-sec !resolve-show-seconds
      ; to heading !format-heading $entry.ts $now-ms $tz
      ; to card-el !build-entry-card $entry $heading $tz $hour-fmt $show-sec
      [ match
       { [ propertyIs 0 view.entries.length ] (
        ; to hdr-el !document.createElement div
        ; assign $hdr-el { className lane-story-heading } { textContent $heading.label }
        !hdr-el.setAttribute data-heading-key [ !safe-str $heading.key ]
        !entries-el.appendChild $hdr-el
        !entries-el.appendChild $card-el
        !view.rendered-nodes.push $hdr-el
        !view.rendered-nodes.push $card-el
        ; set $hdr-el view.first-heading-el
        ; set $heading.key view.first-heading-key
        ; set $heading.key view.last-heading-key
        !view.entries.push $entry
        !view.entry-els.push $card-el
       ) }
       { [ propertyIs $heading.key view.first-heading-key ] (
        ; to first-card $view.entry-els.0
        [ match
         { $first-card : !entries-el.insertBefore $card-el $first-card }
         { true : !entries-el.appendChild $card-el }
        ]
        !view.rendered-nodes.unshift $card-el
        !view.entries.unshift $entry
        !view.entry-els.unshift $card-el
       ) }
       { true (
        ; to hdr-el !document.createElement div
        ; assign $hdr-el { className lane-story-heading } { textContent $heading.label }
        !hdr-el.setAttribute data-heading-key [ !safe-str $heading.key ]
        ; to prev-hdr $view.first-heading-el
        [ match
         { $prev-hdr (
          !entries-el.insertBefore $hdr-el $prev-hdr
          !entries-el.insertBefore $card-el $prev-hdr
         ) }
         { true (
          !entries-el.appendChild $hdr-el
          !entries-el.appendChild $card-el
         ) }
        ]
        !view.rendered-nodes.unshift $card-el
        !view.rendered-nodes.unshift $hdr-el
        ; set $hdr-el view.first-heading-el
        ; set $heading.key view.first-heading-key
        !view.entries.unshift $entry
        !view.entry-els.unshift $card-el
       ) }
      ]
      ; set [ ; add $view.total 1 ] view.total
      !sync-status
      [ match
       { $view.is-jump-open : !view.refresh-buckets }
      ]
     ) }
     { true : !view.reload }
    ]
   ) }
   { true (
    ; set true view.needs-refresh
    [ match
     { [ and { $view.is-jumped } { $entry.id } ] (
      ; set [ ; add $view.total 1 ] view.total
      !sync-status
      [ match
       { $view.is-jump-open : !view.refresh-buckets }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to view.refresh-buckets (
  -- Queries and renders timeline buckets inside the Jump to... popover
  ; to bseq ; add $view.bucket-seq 1
  ; set $bseq view.bucket-seq
  ; to had-buckets [ propertyIsGreaterThan 0 view.bucket-els.length ]
  [ match
   { [ propertyIs false had-buckets ] (
    !clear-el $buckets-el
    ; to bload !document.createElement div
    ; assign $bload { className 'cc-loading cc-loading--compact' } { textContent 'Loading history…' }
    !buckets-el.appendChild $bload
   ) }
  ]
  ; to now-ms !get-now-ms
  ; to tz !resolve-active-tz
  ; to res-box ; object { res null }
  ; try (
   ; to r [ match
    { $loadLaneStoryBuckets : !loadLaneStoryBuckets $data $lane.data $lane.id [ object { now $now-ms } { timeZone $tz } ] }
    { true : ; object { total 0 } { buckets {} } }
   ]
   ; set $r res-box.res
  ) (
   ; to { err } $argv
   [ match
    { $console.error : !console.error 'Failed to load story buckets:' $err }
   ]
  )
  ; condition { propertyIs $bseq view.bucket-seq } (
   !clear-el $buckets-el
   ; set 0 view.bucket-els.length
   ; to buckets-list [ match
    { $res-box.res.buckets : $res-box.res.buckets }
    { true : {} }
   ]
   [ match
    { [ propertyIs 0 buckets-list.length ] (
     ; to empty-b !document.createElement div
     ; assign $empty-b { className lane-story-buckets-empty } { textContent 'No story history yet.' }
     !buckets-el.appendChild $empty-b
    ) }
    { true (
     ; each $buckets-list (
      ; to { bucket } $argv
      ; to btn !document.createElement button
      ; assign $btn { type button } { className lane-story-bucket-btn }
      ; to lbl-el !document.createElement span
      ; assign $lbl-el { className lane-story-bucket-label } { textContent !safe-str $bucket.label }
      ; to cnt-el !document.createElement span
      ; assign $cnt-el { className lane-story-bucket-count } { textContent !safe-str $bucket.count }
      !btn.appendChild $lbl-el
      !btn.appendChild $cnt-el
      !btn.addEventListener click : !view.jump-to-bucket $bucket
      !buckets-el.appendChild $btn
      !view.bucket-els.push $btn

      ; to subs [ match { $bucket.subBuckets : $bucket.subBuckets } { true : {} } ]
      ; each $subs (
       ; to { sub } $argv
       ; to sbtn !document.createElement button
       ; assign $sbtn { type button } { className 'lane-story-bucket-btn lane-story-bucket-btn--sub' }
       ; to slbl !document.createElement span
       ; assign $slbl { className lane-story-bucket-label } { textContent !safe-str $sub.label }
       ; to scnt !document.createElement span
       ; assign $scnt { className lane-story-bucket-count } { textContent !safe-str $sub.count }
       !sbtn.appendChild $slbl
       !sbtn.appendChild $scnt
       !sbtn.addEventListener click : !view.jump-to-bucket $sub
       !buckets-el.appendChild $sbtn
       !view.bucket-els.push $sbtn
      )
     )
    ) }
   ]
  )
  $view.bucket-els
 )

 ; to view.open-jump-menu (
  -- Opens the Jump to... panel and refreshes available timeline buckets
  ; set true view.is-jump-open
  ; set false jump-panel.hidden
  !jump-btn.setAttribute aria-expanded 'true'
  !view.refresh-buckets
 )

 ; to view.close-jump-menu (
  -- Closes the Jump to... panel
  ; set false view.is-jump-open
  ; set true jump-panel.hidden
  !jump-btn.setAttribute aria-expanded 'false'
 )

 ; to view.toggle-jump-menu (
  -- Toggles the Jump to... panel open or closed
  [ match
   { $view.is-jump-open : !view.close-jump-menu }
   { true : !view.open-jump-menu }
  ]
 )

 ; to view.jump-to-bucket (
  -- Jumps the timeline to the chosen bucket and allows infinite-scrolling older runs below it
  ; to { bucket } $argv
  [ match
   { $bucket (
    ; set true view.is-jumped
    ; set bucket view.jump-mode
    ; set [ match { $bucket.label : !safe-str $bucket.label } { true : '' } ] view.jump-label
    ; to has-end !has-val $bucket.endTs
    ; set [ ternary $has-end [ ; add $bucket.endTs 1 ] null ] view.active-before-ts
    ; set null view.active-before-id
    ; set null view.start-ts
    ; set null view.end-ts
    !view.close-jump-menu
    ; set 0 scroller-el.scrollTop
    !view.reload
   ) }
  ]
  $view
 )

 ; to view.jump-to-range (
  -- Jumps the timeline to an explicit [startTs, endTs] date range
  ; to { start-ms end-ms from-label to-label } $argv
  ; to has-start !has-val $start-ms
  ; to has-end !has-val $end-ms
  [ match
   { [ and { [ propertyIs false has-start ] } { [ propertyIs false has-end ] } ] : !view.reset-jump }
   { true (
    ; to has-f-lbl !is-non-empty $from-label
    ; to has-t-lbl !is-non-empty $to-label
    ; to f-lbl [ match
     { $has-f-lbl : !safe-str $from-label }
     { $has-start : !format-date-ymd $start-ms }
     { true : '…' }
    ]
    ; to t-lbl [ match
     { $has-t-lbl : !safe-str $to-label }
     { $has-end : !format-date-ymd $end-ms }
     { true : '…' }
    ]
    ; set true view.is-jumped
    ; set range view.jump-mode
    ; set [ ; add $f-lbl ; add ' – ' $t-lbl ] view.jump-label
    ; set null view.active-before-ts
    ; set null view.active-before-id
    ; set [ ternary $has-start $start-ms null ] view.start-ts
    ; set [ ternary $has-end $end-ms null ] view.end-ts
    !view.close-jump-menu
    ; set 0 scroller-el.scrollTop
    !view.reload
   ) }
  ]
  $view
 )

 ; to view.reset-jump (
  -- Clears any active bucket or date-range jump and returns to the latest timeline
  ; set false view.is-jumped
  ; set null view.jump-mode
  ; set '' view.jump-label
  ; set null view.active-before-ts
  ; set null view.active-before-id
  ; set null view.start-ts
  ; set null view.end-ts
  ; set '' range-from-input.value
  ; set '' range-to-input.value
  !view.close-jump-menu
  ; set 0 scroller-el.scrollTop
  !view.reload
 )

 ; to view.refresh-clock-displays (
  -- Reloads or marks Story dirty so entry times, date headings, and Jump to... buckets reflect active timezone, 12h/24h, and seconds preferences
  ; to is-active [ match
   { $nb : [ propertyIs story nb.active-tab ] }
   { true : false }
  ]
  [ match
   { [ and { $is-active } { $view.is-loaded } ] : !view.reload }
   { $view.is-loaded (
    ; set true view.needs-refresh
    [ match
     { $view.is-jump-open : !view.refresh-buckets }
    ]
   ) }
  ]
 )

 ; to view.activate (
  -- Loads or refreshes the Story tab when activated
  [ match
   { [ propertyIs false view.is-loaded ] : !view.reload }
   { [ and { $view.needs-refresh } { [ propertyIs false view.is-jumped ] } ] : !view.reload }
  ]
  $view
 )

 !latest-btn.addEventListener click : !view.reset-jump
 !jump-btn.addEventListener click : !view.toggle-jump-menu
 !refresh-btn.addEventListener click : !view.reload
 !range-go-btn.addEventListener click (
  ; to from-str !safe-str $range-from-input.value
  ; to to-str !safe-str $range-to-input.value
  ; to start-ms !parse-date-input $from-str false
  ; to end-ms !parse-date-input $to-str true
  !view.jump-to-range $start-ms $end-ms $from-str $to-str
 )
 !range-reset-btn.addEventListener click : !view.reset-jump
 !load-more-btn.addEventListener click : !view.load-more
 !scroller-el.addEventListener scroll (
  [ match
   { [ and { $view.has-more } { [ propertyIs false view.is-loading ] } ] (
    ; to sh [ match { $scroller-el.scrollHeight : $scroller-el.scrollHeight } { true : 0 } ]
    ; condition { propertyIsGreaterThan 0 sh } (
     ; to st [ match { $scroller-el.scrollTop : $scroller-el.scrollTop } { true : 0 } ]
     ; to ch [ match { $scroller-el.clientHeight : $scroller-el.clientHeight } { true : 0 } ]
     ; to bottom ; add $st $ch
     ; to dist ; subtract $sh $bottom
     ; condition { propertyIsLessThanOrEqual 160 dist } : !view.load-more
    )
   ) }
  ]
 )

 $view
)
$scope
