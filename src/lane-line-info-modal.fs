-- file lane-line-info-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a modal dialog displaying a Source line's ID and modification timestamp
 ; to { host } $argv

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

 !body.appendChild $line-label
 !body.appendChild $line-val
 !body.appendChild $id-label
 !body.appendChild $id-val
 !body.appendChild $mod-label
 !body.appendChild $mod-val
 !body.appendChild $iso-val

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to ok-btn !document.createElement button
 ; assign $ok-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent Close }
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
  { close-btn $close-btn }
  { ok-btn $ok-btn }
  { is-open false }
  { line-number null }
  { line-id '' }
  { updated-at null }
  { formatted-timestamp null }
  { host $host }
 ]

 ; to modal.close (
  -- Closes the line info modal and detaches it from the DOM
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   !backdrop.remove
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
  ; to ts !formatLineTimestamp $raw-ts
  ; set $line-num modal.line-number
  ; set $line-id modal.line-id
  ; set $raw-ts modal.updated-at
  ; set $ts modal.formatted-timestamp
  ; set [ ; add '#' $line-num ] line-val.textContent
  ; set [ match { [ propertyIs '' line-id ] : '(unsaved)' } { true : $line-id } ] id-val.textContent
  ; set $ts.display mod-val.textContent
  ; set $ts.iso iso-val.textContent
  ; set [ ternary $ts.known false true ] iso-val.hidden

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
   { $ok-btn.focus : !ok-btn.focus }
  ]
  $modal
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