-- file lane-export-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a modal picker for selecting one or more target lane lines and a FieldScript content expression for Export to Lane
 ; to { lane-control } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-import-backdrop' backdrop.className
 ; to panel !document.createElement div
 ; set 'lane-modal lane-import-modal lane-export-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-modal-title-wrap title-wrap.className
 ; to heading !document.createElement div
 ; assign $heading { className lane-modal-title } { textContent 'Export to Lane' }
 ; to subtitle !document.createElement div
 ; assign $subtitle { className lane-modal-count } { textContent 'Select one or more target lane lines to overwrite when this line runs' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading
 !title-wrap.appendChild $subtitle
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to lanes-section !document.createElement div
 ; set lane-import-section lanes-section.className
 ; to lanes-label !document.createElement div
 ; assign $lanes-label { className lane-config-label } { textContent 'Target Lanes' }
 ; to lanes-el !document.createElement div
 ; set lane-import-lanes lanes-el.className
 !lanes-section.appendChild $lanes-label
 !lanes-section.appendChild $lanes-el

 ; to status-el !document.createElement div
 ; set lane-import-status status-el.className
 ; set true status-el.hidden

 ; to lines-section !document.createElement div
 ; set 'lane-import-section lane-export-lines-section' lines-section.className
 ; to lines-label !document.createElement div
 ; assign $lines-label { className lane-config-label } { textContent 'Target Lane Lines (click to toggle selection)' }
 ; to lines-el !document.createElement div
 ; set lane-export-lines lines-el.className
 !lines-section.appendChild $lines-label
 !lines-section.appendChild $lines-el

 ; to chips-section !document.createElement div
 ; set lane-import-section chips-section.className
 ; to chips-label !document.createElement div
 ; assign $chips-label { className lane-config-label } { textContent 'Selected Targets' }
 ; to chips-el !document.createElement div
 ; set lane-export-chips chips-el.className
 !chips-section.appendChild $chips-label
 !chips-section.appendChild $chips-el

 ; to form !document.createElement form
 ; set lane-import-form form.className
 ; to expr-field !document.createElement div
 ; set lane-import-alias-field expr-field.className
 ; to expr-label !document.createElement label
 ; assign $expr-label { className lane-config-label } { textContent 'Line content expression (FieldScript)' }
 ; to expr-input !document.createElement input
 ; assign $expr-input { type text } { className lane-config-input } { placeholder '; add \'!console log  \' $message' } { spellcheck false } { autocomplete off }
 !expr-field.appendChild $expr-label
 !expr-field.appendChild $expr-input

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to confirm-btn !document.createElement button
 ; assign $confirm-btn { type submit } { className 'lane-modal-action lane-config-btn--save' } { textContent Save }
 !footer.appendChild $cancel-btn
 !footer.appendChild $confirm-btn

 !form.appendChild $expr-field
 !form.appendChild $footer

 !panel.appendChild $header
 !panel.appendChild $lanes-section
 !panel.appendChild $status-el
 !panel.appendChild $lines-section
 !panel.appendChild $chips-section
 !panel.appendChild $form
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { form $form }
  { lanes-el $lanes-el }
  { status-el $status-el }
  { lines-el $lines-el }
  { chips-el $chips-el }
  { expr-input $expr-input }
  { close-btn $close-btn }
  { cancel-btn $cancel-btn }
  { confirm-btn $confirm-btn }
  { is-open false }
  { lane null }
  { current-lane-id '' }
  { selected-lane-id '' }
  { selected-targets {} }
  { line-num-cache ; object }
  { line-els {} }
  { chip-els {} }
  { lane-items {} }
  { lane-els {} }
  { load-seq 0 }
  { open-seq 0 }
  { on-confirm null }
 ]

 ; to target-key (
  ; to { lane-id line-id } $argv
  ; add $lane-id ; add ':' $line-id
 )

 ; to find-target-index (
  ; to { lane-id line-id } $argv
  ; to found ; object { idx -1 }
  ; each $modal.selected-targets (
   ; to { item idx } $argv
   ; condition { propertyIs -1 found.idx } (
    ; condition { propertyIs $lane-id item.laneId } (
     ; condition { propertyIs $line-id item.lineId } : ; set $idx found.idx
    )
   )
  )
  $found.idx
 )

 ; to modal.set-status (
  ; to { message is-error } $argv
  [ match
   { [ propertyIs '' message ] (
    ; set '' status-el.textContent
    ; set true status-el.hidden
   ) }
   { true (
    ; set $message status-el.textContent
    ; to cls [ match
     { $is-error : 'lane-import-status lane-import-status--error' }
     { true : 'lane-import-status cc-loading' }
    ]
    ; set $cls status-el.className
    ; set false status-el.hidden
   ) }
  ]
 )

 ; to modal.update-lane-buttons (
  ; each $modal.lane-items (
   ; to { item } $argv
   ; to active [ propertyIs $item.id modal.selected-lane-id ]
   ; to cls [ ternary $active 'lane-import-lane-btn lane-import-lane-btn--active' lane-import-lane-btn ]
   ; set $cls item.el.className
   !item.el.setAttribute aria-pressed [ ternary $active 'true' 'false' ]
  )
 )

 ; to modal.render-chips (
  -- Renders selected target lane+line chips with individual remove buttons
  ; while { propertyIsGreaterThan 0 modal.chip-els.length } (
   ; to old-el !modal.chip-els.pop
   !old-el.remove
  )
  [ match
   { [ propertyIs 0 modal.selected-targets.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-import-empty } { textContent 'No target lines selected yet' }
    !chips-el.appendChild $empty-el
    !modal.chip-els.push $empty-el
   ) }
   { true (
    ; each $modal.selected-targets (
     ; to { target idx } $argv
     ; to chip !document.createElement span
     ; set lane-export-chip chip.className
     ; to lane-title [ match
      { $lane-control.get-lane-title : !lane-control.get-lane-title $target.laneId }
      { true : $target.laneId }
     ]
     ; to k !target-key $target.laneId $target.lineId
     ; to line-num [ get modal.line-num-cache $k ]
     ; to line-label [ match
      { $line-num : ; add 'L' $line-num }
      { true : $target.lineId }
     ]
     ; to txt-el !document.createElement span
     ; assign $txt-el { className lane-export-chip-label } { textContent [ ; add $lane-title ; add ' · ' $line-label ] }
     ; to rm-btn !document.createElement button
     ; assign $rm-btn { type button } { className lane-export-chip-remove } { textContent '×' } { title 'Remove target' }
     !rm-btn.addEventListener click (
      !modal.selected-targets.splice $idx 1
      !modal.render-chips
      !modal.sync-line-rows
     )
     !chip.appendChild $txt-el
     !chip.appendChild $rm-btn
     !chips-el.appendChild $chip
     !modal.chip-els.push $chip
    )
   ) }
  ]
 )

 ; to modal.sync-line-rows (
  -- Refreshes selected state styling and toggle text on rendered target line rows
  ; each $modal.line-els (
   ; to { item } $argv
   [ match
    { $item.toggle-btn (
     ; to idx !find-target-index $item.lane-id $item.line-id
     ; to is-sel [ propertyIsGreaterThan -1 idx ]
     ; set [ ternary $is-sel 'lane-export-line-row lane-export-line-row--selected' lane-export-line-row ] item.row-el.className
     ; set [ ternary $is-sel '✓ Selected' '+ Add' ] item.toggle-btn.textContent
     !item.toggle-btn.setAttribute aria-pressed [ ternary $is-sel 'true' 'false' ]
    ) }
   ]
  )
 )

 ; to modal.clear-lines (
  ; while { propertyIsGreaterThan 0 modal.line-els.length } (
   ; to old-item !modal.line-els.pop
   [ match
    { $old-item.row-el : !old-item.row-el.remove }
    { $old-item.remove : !old-item.remove }
   ]
  )
 )

 ; to modal.toggle-target (
  ; to { lane-id line-id } $argv
  ; to idx !find-target-index $lane-id $line-id
  [ match
   { [ propertyIsGreaterThan -1 idx ] : !modal.selected-targets.splice $idx 1 }
   { true : !modal.selected-targets.push [ object { laneId $lane-id } { lineId $line-id } ] }
  ]
  !modal.render-chips
  !modal.sync-line-rows
 )

 ; to load-lane-records (
  ; to { lane-id } $argv
  ; to open-lane [ get lane-control.by-id $lane-id ]
  [ match
   { $open-lane.notebook.line-records : $open-lane.notebook.line-records }
   { true (
    ; to target-data !data.namespace $lane-id
    ; to loaded !loadLaneScript $data $target-data $lane-id $window
    [ match
     { $loaded.records : $loaded.records }
     { true : {} }
    ]
   ) }
  ]
 )

 ; to modal.select-lane (
  -- Loads target lane lines and displays selectable rows
  ; to { lane-id } $argv
  ; to seq ; add $modal.load-seq 1
  ; set $seq modal.load-seq
  ; set $lane-id modal.selected-lane-id
  !modal.update-lane-buttons
  !modal.clear-lines
  !modal.set-status 'Loading lane lines…' false
  ; to recs-box ; object { list {} }
  ; try (
   ; to r !load-lane-records $lane-id
   ; set $r recs-box.list
  ) (
   ; to { err } $argv
   ; condition { propertyIs $seq modal.load-seq } : !modal.set-status 'Failed to load lane lines.' true
   null
  )
  ; to records $recs-box.list
  ; condition { propertyIs $seq modal.load-seq } (
   !modal.set-status '' false
   [ match
    { [ propertyIs 0 records.length ] (
     ; to empty-el !document.createElement div
     ; assign $empty-el { className lane-import-empty } { textContent 'No lines in this lane.' }
     !lines-el.appendChild $empty-el
     !modal.line-els.push $empty-el
    ) }
    { true (
     ; each $records (
      ; to { rec idx } $argv
      ; to num ; add $idx 1
      ; to k !target-key $lane-id $rec.id
      ; to modal.line-num-cache $k $num
      ; to row-el !document.createElement div
      ; set lane-export-line-row row-el.className
      ; to num-el !document.createElement span
      ; assign $num-el { className lane-export-line-num } { textContent [ ; add L $num ] }
      ; to text-val [ match
       { [ propertyIs '' rec.text ] : '(empty line)' }
       { [ propertyIs null rec.text ] : '(empty line)' }
       { [ propertyIs undefined rec.text ] : '(empty line)' }
       { true : $rec.text }
      ]
      ; to text-el !document.createElement code
      ; assign $text-el { className lane-export-line-text } { textContent $text-val } { title $text-val }
      ; to toggle-btn !document.createElement button
      ; assign $toggle-btn { type button } { className lane-export-line-toggle }
      !toggle-btn.addEventListener click : !modal.toggle-target $lane-id $rec.id
      !row-el.addEventListener click (
       ; to { ev } $argv
       ; to is-btn [ propertyIs $toggle-btn ev.target ]
       ; condition { propertyIs false is-btn } : !modal.toggle-target $lane-id $rec.id
      )
      !row-el.appendChild $num-el
      !row-el.appendChild $text-el
      !row-el.appendChild $toggle-btn
      !lines-el.appendChild $row-el
      !modal.line-els.push [ object { row-el $row-el } { toggle-btn $toggle-btn } { lane-id $lane-id } { line-id $rec.id } ]
     )
     !modal.sync-line-rows
     !modal.render-chips
    ) }
   ]
  )
 )

 ; to modal.render-lanes (
  -- Renders accessible non-self lanes
  ; while { propertyIsGreaterThan 0 modal.lane-els.length } (
   ; to old-el !modal.lane-els.pop
   !old-el.remove
  )
  ; set 0 modal.lane-items.length
  ; to lanes-load-el !document.createElement div
  ; assign $lanes-load-el { className 'cc-loading cc-loading--compact' } { textContent 'Loading lanes…' }
  !lanes-el.appendChild $lanes-load-el
  !modal.lane-els.push $lanes-load-el
  ; to seen ; object
  ; to candidates {}

  ; each $lane-control.lanes (
   ; to { lane } $argv
   ; to is-self [ propertyIs $lane.id modal.current-lane-id ]
   ; to is-locked [ propertyIs true lane.is-locked ]
   ; condition { and { [ propertyIs false is-self ] } { [ propertyIs false is-locked ] } } (
    ; to seen $lane.id true
    !candidates.push [ object { id $lane.id } { title $lane.title } { is-open true } ]
   )
  )

  ; to known ; try ( !lane-control.list-known ) ( {} )
  ; each $known (
   ; to { entry } $argv
   ; to is-self [ propertyIs $entry.id modal.current-lane-id ]
   ; to already [ get seen $entry.id ]
   ; condition { propertyIs false is-self } (
    [ match
     { $already : null }
     { true (
      ; to seen $entry.id true
      !candidates.push [ object { id $entry.id } { title $entry.title } { is-open false } ]
     ) }
    ]
   )
  )

  ; while { propertyIsGreaterThan 0 modal.lane-els.length } (
   ; to old-el !modal.lane-els.pop
   !old-el.remove
  )

  [ match
   { [ propertyIs 0 candidates.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-import-empty } { textContent 'No other lanes available. Create or open another lane first.' }
    !lanes-el.appendChild $empty-el
    !modal.lane-els.push $empty-el
    !modal.clear-lines
    !modal.set-status '' false
   ) }
   { true (
    ; each $candidates (
     ; to { cand } $argv
     ; to btn !document.createElement button
     ; assign $btn { type button } { className lane-import-lane-btn }
     ; to title-span !document.createElement span
     ; assign $title-span { className lane-import-lane-title } { textContent $cand.title }
     !btn.appendChild $title-span
     [ match
      { $cand.is-open (
       ; to badge !document.createElement span
       ; assign $badge { className lane-import-lane-badge } { textContent Open }
       !btn.appendChild $badge
      ) }
     ]
     !btn.addEventListener click : !modal.select-lane $cand.id
     !lanes-el.appendChild $btn
     !modal.lane-els.push $btn
     !modal.lane-items.push [ object { id $cand.id } { title $cand.title } { el $btn } ]
    )
   ) }
  ]
  $candidates
 )

 ; to modal.close (
  ; condition { propertyIs true modal.is-open } (
   ; to prev-lane $modal.lane
   ; set false modal.is-open
   ; set [ ; add $modal.open-seq 1 ] modal.open-seq
   ; set [ ; add $modal.load-seq 1 ] modal.load-seq
   ; set null modal.lane
   ; set null modal.on-confirm
   !backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $modal }
   ]
  )
 )

 ; to modal.confirm (
  ; to cb $modal.on-confirm
  ; to clean-targets {}
  ; each $modal.selected-targets (
   ; to { t } $argv
   !clean-targets.push [ object { laneId $t.laneId } { lineId $t.lineId } ]
  )
  ; to spec [ object
   { targets $clean-targets }
   { contentExpr $expr-input.value }
  ]
  ; to candidate-line [ match
   { $formatExportLine : !formatExportLine $spec }
   { true : '' }
  ]
  ; to check [ match
   { $validateFieldScriptLine : !validateFieldScriptLine $candidate-line }
   { true : ; object { ok true } { error null } }
  ]
  [ match
   { [ propertyIs false check.ok ] (
    !modal.set-status [ ; add 'Syntax error in expression: ' $check.error ] true
    null
   ) }
   { true (
    !modal.close
    [ match
     { $cb : !$cb $spec }
    ]
   ) }
  ]
 )

 ; to modal.open (
  -- Opens the Export to Lane target picker modal
  ; to { opts } $argv
  ; to cur-id [ match { $opts.current-lane-id : $opts.current-lane-id } { true : '' } ]
  ; to init-expr [ match { $opts.content-expr : $opts.content-expr } { true : '' } ]
  ; set $cur-id modal.current-lane-id
  ; set '' modal.selected-lane-id
  ; set $init-expr expr-input.value
  ; set $opts.on-confirm modal.on-confirm
  ; to oseq ; add $modal.open-seq 1
  ; set $oseq modal.open-seq
  ; set [ ; add $modal.load-seq 1 ] modal.load-seq
  ; set 0 modal.selected-targets.length
  ; to seen-lanes ; object
  ; to unique-target-lanes {}
  !modal.clear-lines
  !modal.set-status 'Loading lanes…' false
  [ match
   { $opts.targets (
    ; each $opts.targets (
     ; to { t } $argv
     [ match
      { $t.laneId (
       [ match
        { $t.lineId (
         !modal.selected-targets.push [ object { laneId $t.laneId } { lineId $t.lineId } ]
         ; to already [ get seen-lanes $t.laneId ]
         [ match
          { $already : null }
          { true (
           ; to seen-lanes $t.laneId true
           !unique-target-lanes.push $t.laneId
          ) }
         ]
        ) }
       ]
      ) }
     ]
    )
   ) }
  ]

  ; condition { propertyIs true modal.is-open } (
   [ match
    { [ and { $modal.lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $modal.lane $modal }
   ]
  )
  ; to target-lane [ match
   { $opts.lane : $opts.lane }
   { [ and { $cur-id } { $lane-control.resolve-lane } ] : !lane-control.resolve-lane $cur-id }
   { $cur-id : [ get lane-control.by-id $cur-id ] }
   { true : null }
  ]
  ; set $target-lane modal.lane
  ; set true modal.is-open
  [ match
   { [ and { $target-lane } { $lane-control.mount-lane-modal } ] : !lane-control.mount-lane-modal $target-lane $modal }
   { $target-lane.body.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-import-backdrop lane-modal-backdrop--lane' backdrop.className
    !target-lane.body.appendChild $backdrop
   ) }
   { $document.body.appendChild : !document.body.appendChild $backdrop }
  ]
  !modal.render-chips

  ; to candidates !modal.render-lanes

  -- Pre-populate line numbers for all already-selected target lanes
  ; condition { and { [ propertyIs true modal.is-open ] } { [ propertyIs $oseq modal.open-seq ] } } (
   ; each $unique-target-lanes (
    ; to { lid } $argv
    ; to recs ; try ( !load-lane-records $lid ) ( {} )
    ; each $recs (
     ; to { rec idx } $argv
     ; to k !target-key $lid $rec.id
     ; to num ; add $idx 1
     ; to modal.line-num-cache $k $num
    )
   )
   ; condition { and { [ propertyIs true modal.is-open ] } { [ propertyIs $oseq modal.open-seq ] } } (
    !modal.render-chips

    [ match
     { [ propertyIsGreaterThan 0 modal.selected-targets.length ] : !modal.select-lane $modal.selected-targets.0.laneId }
     { [ propertyIsGreaterThan 0 candidates.length ] : !modal.select-lane $candidates.0.id }
    ]
   )
  )

  $modal
 )

 !close-btn.addEventListener click $modal.close
 !cancel-btn.addEventListener click $modal.close
 !form.addEventListener submit (
  ; to { ev } $argv
  [ match
   { $ev.preventDefault : !ev.preventDefault }
  ]
  !modal.confirm
 )
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
 )
 !window.addEventListener keydown (
  ; to { ev } $argv
  ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.close
 )

 $modal
)
$scope
