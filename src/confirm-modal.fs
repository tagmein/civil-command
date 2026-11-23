-- file confirm-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a reusable confirmation modal dialog for destructive actions
 ; to { host } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-config-backdrop lane-confirm-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-config-modal lane-confirm-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-el !document.createElement div
 ; assign $title-el { className lane-modal-title } { textContent 'Confirm Action' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Cancel (Esc)' }
 !header.appendChild $title-el
 !header.appendChild $close-btn

 ; to body !document.createElement div
 ; set lane-confirm-body body.className
 ; to message-el !document.createElement p
 ; assign $message-el { className lane-confirm-message } { textContent '' }
 !body.appendChild $message-el

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to confirm-btn !document.createElement button
 ; assign $confirm-btn { type button } { className 'lane-modal-action lane-confirm-btn--danger' } { textContent Delete }
 !footer.appendChild $cancel-btn
 !footer.appendChild $confirm-btn

 !panel.appendChild $header
 !panel.appendChild $body
 !panel.appendChild $footer
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { title-el $title-el }
  { message-el $message-el }
  { close-btn $close-btn }
  { cancel-btn $cancel-btn }
  { confirm-btn $confirm-btn }
  { is-open false }
  { on-confirm null }
  { on-cancel null }
  { host $host }
 ]

 ; to modal.close (
  -- Closes the confirmation modal and detaches it from the DOM
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   ; set null modal.on-confirm
   ; set null modal.on-cancel
   !backdrop.remove
  )
 )

 ; to modal.cancel (
  -- Cancels the pending destructive action, closes the modal, and notifies on-cancel
  ; to cb $modal.on-cancel
  !modal.close
  [ match
   { $cb : !$cb }
  ]
 )

 ; to modal.confirm (
  -- Confirms the pending destructive action, closes the modal, and invokes on-confirm
  ; to cb $modal.on-confirm
  !modal.close
  [ match
   { $cb : !$cb }
  ]
 )

 ; to modal.open (
  -- Opens the confirmation modal with { title message confirm-label on-confirm on-cancel }
  ; to { opts } $argv
  ; to title [ match
   { $opts.title : $opts.title }
   { true : 'Confirm Action' }
  ]
  ; to message [ match
   { $opts.message : $opts.message }
   { true : 'Are you sure you want to proceed?' }
  ]
  ; to confirm-label [ match
   { $opts.confirm-label : $opts.confirm-label }
   { true : Delete }
  ]
  ; set $title title-el.textContent
  ; set $message message-el.textContent
  ; set $confirm-label confirm-btn.textContent
  ; set [ match { $opts.on-confirm : $opts.on-confirm } { true : null } ] modal.on-confirm
  ; set [ match { $opts.on-cancel : $opts.on-cancel } { true : null } ] modal.on-cancel

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
   { $cancel-btn.focus : !cancel-btn.focus }
  ]
  $modal
 )

 !close-btn.addEventListener click $modal.cancel
 !cancel-btn.addEventListener click $modal.cancel
 !confirm-btn.addEventListener click $modal.confirm
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.cancel
 )
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.cancel
   )
  ) }
 ]

 $modal
)
$scope
