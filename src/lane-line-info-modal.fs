-- file lane-line-info-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a modal dialog displaying a Source line's ID and modification timestamp
 ; to { host-or-control maybe-control } $argv
 ; to lane-control [ match
  { $maybe-control : $maybe-control }
  { $host-or-control.by-id : $host-or-control }
  { $host-or-control.mount-lane-modal : $host-or-control }
  { true : null }
 ]
 ; to host [ match
  { $host-or-control.by-id : null }
  { $host-or-control.mount-lane-modal : null }
  { true : $host-or-control }
 ]

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-config-backdrop lane-line-info-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-config-modal lane-line-info-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-el !document.createElement div
 ; assign $title-el { className lane-modal-title } { textContent 'Line Info' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !header.appendChild $title-el
 !header.appendChild $close-btn

 ; to body !document.createElement div
 ; set lane-line-info-grid body.className

 ; to line-label !document.createElement div
 ; assign $line-label { className lane-line-info-label } { textContent Line }
 ; to line-val !document.createElement div
 ; assign $line-val { className lane-line-info-value } { textContent '' }

 ; to id-label !document.createElement div
 ; assign $id-label { className lane-line-info-label } { textContent 'Line ID' }
 ; to id-val !document.createElement div
 ; assign $id-val { className lane-line-info-value } { textContent '' }

 ; to mod-label !document.createElement div
 ; assign $mod-label { className lane-line-info-label } { textContent Modified }
 ; to mod-val !document.createElement div
 ; assign $mod-val { className lane-line-info-value } { textContent Unknown }
 ; to iso-val !document.createElement div
 ; assign $iso-val { className lane-line-info-sub } { textContent '' } { hidden true }

 ; to set-by-label !document.createElement div
 ; assign $set-by-label { className lane-line-info-label } { textContent 'Set By' } { hidden true }
 ; to set-by-val !document.createElement div
 ; assign $set-by-val { className lane-line-info-value } { hidden true }
 ; to set-by-btn !document.createElement button
 ; assign $set-by-btn { type button } { className lane-line-set-by-btn } { textContent '' }
 !set-by-val.appendChild $set-by-btn

 !body.appendChild $line-label
 !body.appendChild $line-val
 !body.appendChild $id-label
 !body.appendChild $id-val
 !body.appendChild $mod-label
 !body.appendChild $mod-val
 !body.appendChild $iso-val
 !body.appendChild $set-by-label
 !body.appendChild $set-by-val

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to copy-agent-btn !document.createElement button
 ; assign $copy-agent-btn { type button } { className 'lane-modal-action lane-config-reset-btn' } { textContent 'Copy Info' } { title 'Copy session, lane & line context for an agent' }
 ; to ok-btn !document.createElement button
 ; assign $ok-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent Close }
 !footer.appendChild $copy-agent-btn
 !footer.appendChild $ok-btn

 !panel.appendChild $header
 !panel.appendChild $body
 !panel.appendChild $footer
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { title-el $title-el }
  { line-val-el $line-val }
  { id-val-el $id-val }
  { mod-val-el $mod-val }
  { iso-val-el $iso-val }
  { set-by-label-el $set-by-label }
  { set-by-val-el $set-by-val }
  { set-by-btn $set-by-btn }
  { copy-agent-btn $copy-agent-btn }
  { copy-info-btn $copy-agent-btn }
  { copy-btn $copy-agent-btn }
  { copy-timer null }
  { close-btn $close-btn }
  { ok-btn $ok-btn }
  { is-open false }
  { line-number null }
  { line-id '' }
  { line-text null }
  { updated-at null }
  { set-by null }
  { set-by-label '' }
  { set-by-title '' }
  { formatted-timestamp null }
  { host $host }
  { lane null }
 ]

 !set-by-btn.addEventListener click (
  ; to sb $modal.set-by
  ; to from-id [ match { $modal.lane.id : $modal.lane.id } { true : '' } ]
  !modal.close
  [ match
   { [ and { $sb.laneId } { $lane-control.navigate-to-lane-line } ] (
    !lane-control.navigate-to-lane-line $sb.laneId $sb.lineId $from-id
   ) }
  ]
 )

 ; to modal.close (
  -- Closes the line info modal and detaches it from the DOM
  ; condition { propertyIs true modal.is-open } (
   ; to prev-lane $modal.lane
   ; set false modal.is-open
   ; set null modal.lane
   !backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $modal }
   ]
  )
 )

 ; to resolve-ts-opts (
  [ match
   { $lane-control.get-clock-display-options : !lane-control.get-clock-display-options }
   { true (
    ; to fb-tz [ match { $getBrowserTimeZone : !getBrowserTimeZone $window.Intl } { true : UTC } ]
    ; to fb-hr [ match { $lane-control.clock-hour-format : $lane-control.clock-hour-format } { true : '12h' } ]
    [ object { timeZone $fb-tz } { hourFormat $fb-hr } { showTimeZone true } { intl $window.Intl } ]
   ) }
  ]
 )

 ; to modal.refresh-timestamp (
  -- Refreshes the displayed Modified timestamp when clock timezone or 12h/24h preference changes while open
  ; condition { propertyIs true modal.is-open } (
   ; to ts-opts !resolve-ts-opts
   ; to ts !formatLineTimestamp $modal.updated-at $ts-opts
   ; set $ts modal.formatted-timestamp
   ; set $ts.display mod-val.textContent
   ; set $ts.iso iso-val.textContent
   ; set [ ternary $ts.known false true ] iso-val.hidden
  )
 )

 ; to modal.open (
  -- Opens the line info modal with { line-number line-id updated-at }
  ; to { opts } $argv
  ; to line-num [ match
   { $opts.line-number : $opts.line-number }
   { true : 1 }
  ]
  ; to line-id [ match
   { $opts.line-id : $opts.line-id }
   { true : '' }
  ]
  ; to raw-ts [ match
   { [ propertyIs undefined opts.updated-at ] : null }
   { true : $opts.updated-at }
  ]
  ; to ts-opts !resolve-ts-opts
  ; to ts !formatLineTimestamp $raw-ts $ts-opts
  ; set $line-num modal.line-number
  ; set $line-id modal.line-id
  ; set $raw-ts modal.updated-at
  ; set $ts modal.formatted-timestamp
  ; set [ ; add '#' $line-num ] line-val.textContent
  ; set [ match { [ propertyIs '' line-id ] : '(unsaved)' } { true : $line-id } ] id-val.textContent
  ; set $ts.display mod-val.textContent
  ; set $ts.iso iso-val.textContent
  ; set [ ternary $ts.known false true ] iso-val.hidden
  ; to sb [ match
   { $opts.set-by.laneId : $opts.set-by }
   { true : null }
  ]
  ; set $sb modal.set-by
  [ match
   { $sb (
    ; to sb-title [ match
     { $lane-control.get-lane-title : !lane-control.get-lane-title $sb.laneId }
     { true : $sb.laneId }
    ]
    ; to sb-line-lbl [ match
     { $opts.set-by-label : $opts.set-by-label }
     { $sb.lineId : $sb.lineId }
     { true : '' }
    ]
    ; to sb-desc [ match
     { [ propertyIs '' sb-line-lbl ] : $sb-title }
     { true : ; add $sb-title ; add ' · ' $sb-line-lbl }
    ]
    ; set $sb-line-lbl modal.set-by-label
    ; set $sb-title modal.set-by-title
    ; set [ ; add $sb-desc ' ↗' ] set-by-btn.textContent
    ; set [ ; add 'Navigate to ' $sb-desc ] set-by-btn.title
    ; set false set-by-label.hidden
    ; set false set-by-val.hidden
   ) }
   { true (
    ; set '' modal.set-by-label
    ; set '' modal.set-by-title
    ; set '' set-by-btn.textContent
    ; set '' set-by-btn.title
    ; set true set-by-label.hidden
    ; set true set-by-val.hidden
   ) }
  ]

  ; condition { propertyIs true modal.is-open } (
   [ match
    { [ and { $modal.lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $modal.lane $modal }
   ]
  )
  ; to target-lane [ match
   { $opts.lane : $opts.lane }
   { [ and { $opts.lane-id } { $lane-control.resolve-lane } ] : !lane-control.resolve-lane $opts.lane-id }
   { $opts.lane-id : [ get lane-control.by-id $opts.lane-id ] }
   { true : null }
  ]
  ; set $target-lane modal.lane
  ; to resolved-text ; object { val null }
  [ match
   { [ propertyIs false [ propertyIs undefined opts.line-text ] ] : ; set $opts.line-text resolved-text.val }
   { [ propertyIs false [ propertyIs undefined opts.lineText ] ] : ; set $opts.lineText resolved-text.val }
   { $target-lane.notebook.line-records (
    ; each $target-lane.notebook.line-records (
     ; to { rec idx } $argv
     ; to rec-num ; add $idx 1
     [ match
      { [ and { [ propertyIs false [ propertyIs '' line-id ] ] } { [ propertyIs $line-id rec.id ] } ] : ; set $rec.text resolved-text.val }
      { [ and { [ propertyIs null resolved-text.val ] } { [ propertyIs $line-num rec-num ] } ] : ; set $rec.text resolved-text.val }
     ]
    )
   ) }
   { $target-lane.notebook.lines (
    ; to line-idx ; subtract $line-num 1
    ; to from-lines [ get target-lane.notebook.lines $line-idx ]
    [ match
     { [ propertyIs false [ propertyIs undefined from-lines ] ] : ; set $from-lines resolved-text.val }
    ]
   ) }
  ]
  ; set $resolved-text.val modal.line-text
  ; set 'Copy Info' copy-agent-btn.textContent
  ; set true modal.is-open
  [ match
   { [ and { $target-lane } { $lane-control.mount-lane-modal } ] : !lane-control.mount-lane-modal $target-lane $modal }
   { $opts.host.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-config-backdrop lane-line-info-backdrop lane-modal-backdrop--lane' backdrop.className
    !opts.host.appendChild $backdrop
   ) }
   { $target-lane.body.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-config-backdrop lane-line-info-backdrop lane-modal-backdrop--lane' backdrop.className
    !target-lane.body.appendChild $backdrop
   ) }
   { $modal.host.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-config-backdrop lane-line-info-backdrop lane-modal-backdrop--lane' backdrop.className
    !modal.host.appendChild $backdrop
   ) }
   { $document.body.appendChild : !document.body.appendChild $backdrop }
  ]
  [ match
   { $ok-btn.focus : !ok-btn.focus }
  ]
  $modal
 )

 !copy-agent-btn.addEventListener click (
  ; to line-context [ object
   { lane $modal.lane }
   { lineNumber $modal.line-number }
   { line-number $modal.line-number }
   { lineId $modal.line-id }
   { line-id $modal.line-id }
   { lineText $modal.line-text }
   { line-text $modal.line-text }
   { lineUpdatedAt $modal.updated-at }
   { updated-at $modal.updated-at }
   { lineSetBy $modal.set-by }
   { set-by $modal.set-by }
   { lineSetByLabel $modal.set-by-label }
   { set-by-label $modal.set-by-label }
   { lineSetByTitle $modal.set-by-title }
   { set-by-title $modal.set-by-title }
  ]
  [ match
   { $lane-control.copy-agent-context : !lane-control.copy-agent-context $modal.lane $line-context }
   { $formatAgentPrompt (
    ; to fallback-txt !formatAgentPrompt [ object
     { laneId [ match { $modal.lane.id : $modal.lane.id } { true : '' } ] }
     { laneTitle [ match { $modal.lane.title : $modal.lane.title } { true : '' } ] }
     { lanePackageId [ match { $modal.lane.package-id : $modal.lane.package-id } { true : '' } ] }
     { lanePath [ match { $modal.lane.path : $modal.lane.path } { $modal.lane.tab : $modal.lane.tab } { true : '' } ] }
     { line $line-context }
    ]
    [ match
     { $window.navigator.clipboard.writeText : !window.navigator.clipboard.writeText $fallback-txt }
    ]
   ) }
  ]
  ; set Copied copy-agent-btn.textContent
  [ match
   { $window.setTimeout (
    [ match
     { $modal.copy-timer : !window.clearTimeout $modal.copy-timer }
    ]
    ; to next-timer !window.setTimeout (
     ; set 'Copy Info' copy-agent-btn.textContent
     ; set null modal.copy-timer
    ) 1200
    ; set $next-timer modal.copy-timer
   ) }
  ]
 )
 !close-btn.addEventListener click $modal.close
 !ok-btn.addEventListener click $modal.close
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