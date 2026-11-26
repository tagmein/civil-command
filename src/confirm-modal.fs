-- file confirm-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a reusable confirmation modal dialog for destructive actions
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
 ; to agree-row !document.createElement label
 ; assign $agree-row { className lane-confirm-agree } { hidden true }
 ; to agree-checkbox !document.createElement input
 ; assign $agree-checkbox { type checkbox } { className lane-confirm-checkbox } { checked false }
 ; to agree-text-el !document.createElement span
 ; assign $agree-text-el { className lane-confirm-agree-text } { textContent '' }
 !agree-row.appendChild $agree-checkbox
 !agree-row.appendChild $agree-text-el
 !body.appendChild $message-el
 !body.appendChild $agree-row

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
  { agree-row $agree-row }
  { agree-checkbox $agree-checkbox }
  { agree-text-el $agree-text-el }
  { close-btn $close-btn }
  { cancel-btn $cancel-btn }
  { confirm-btn $confirm-btn }
  { is-open false }
  { require-agreement false }
  { on-confirm null }
  { on-cancel null }
  { host $host }
  { lane null }
 ]

 ; to modal.sync-agreement (
  -- Updates the destructive confirm button's disabled state from require-agreement and checkbox state
  ; to is-checked [ match
   { [ propertyIs true agree-checkbox.checked ] : true }
   { true : false }
  ]
  ; to is-disabled [ match
   { $modal.require-agreement : [ ternary $is-checked false true ] }
   { true : false }
  ]
  ; set $is-disabled confirm-btn.disabled
  !confirm-btn.setAttribute aria-disabled [ ternary $is-disabled 'true' 'false' ]
  ; set [ ternary $is-checked 'lane-confirm-agree lane-confirm-agree--checked' lane-confirm-agree ] agree-row.className
 )

 ; to modal.close (
  -- Closes the confirmation modal and detaches it from the DOM
  ; condition { propertyIs true modal.is-open } (
   ; to prev-lane $modal.lane
   ; set false modal.is-open
   ; set false modal.require-agreement
   ; set false agree-checkbox.checked
   ; set true agree-row.hidden
   ; set false confirm-btn.disabled
   !confirm-btn.setAttribute aria-disabled 'false'
   ; set null modal.lane
   ; set null modal.on-confirm
   ; set null modal.on-cancel
   !backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $modal }
   ]
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
  -- Confirms the pending destructive action only when open and explicit checkbox agreement (if required) is checked
  !modal.sync-agreement
  ; to can-confirm [ match
   { [ propertyIs false modal.is-open ] : false }
   { $confirm-btn.disabled : false }
   { $modal.require-agreement : [ propertyIs true agree-checkbox.checked ] }
   { true : true }
  ]
  ; condition { propertyIs true can-confirm } (
   ; to cb $modal.on-confirm
   !modal.close
   [ match
    { $cb : !$cb }
   ]
  )
 )

 ; to modal.open (
  -- Opens the confirmation modal with { title message confirm-label require-agreement agreement-label on-confirm on-cancel }
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
  ; to agree-label [ match
   { $opts.agreement-label : $opts.agreement-label }
   { $opts.checkbox-label : $opts.checkbox-label }
   { $opts.require-agreement : 'I understand and agree that this action is permanent and cannot be undone.' }
   { true : '' }
  ]
  ; to need-agree [ match
   { $opts.require-agreement : true }
   { [ propertyIs '' agree-label ] : false }
   { true : true }
  ]
  ; set $title title-el.textContent
  ; set $message message-el.textContent
  ; set $confirm-label confirm-btn.textContent
  ; set $need-agree modal.require-agreement
  ; set false agree-checkbox.checked
  ; set $agree-label agree-text-el.textContent
  ; set [ ternary $need-agree false true ] agree-row.hidden
  !modal.sync-agreement
  ; set [ match { $opts.on-confirm : $opts.on-confirm } { true : null } ] modal.on-confirm
  ; set [ match { $opts.on-cancel : $opts.on-cancel } { true : null } ] modal.on-cancel

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
  ; set true modal.is-open
  [ match
   { [ and { $target-lane } { $lane-control.mount-lane-modal } ] : !lane-control.mount-lane-modal $target-lane $modal }
   { $opts.host.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-config-backdrop lane-confirm-backdrop lane-modal-backdrop--lane' backdrop.className
    !opts.host.appendChild $backdrop
   ) }
   { $target-lane.body.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-config-backdrop lane-confirm-backdrop lane-modal-backdrop--lane' backdrop.className
    !target-lane.body.appendChild $backdrop
   ) }
   { $modal.host.appendChild (
    !backdrop.setAttribute data-lane-modal 'true'
    ; set 'lane-modal-backdrop lane-config-backdrop lane-confirm-backdrop lane-modal-backdrop--lane' backdrop.className
    !modal.host.appendChild $backdrop
   ) }
   { $lane-control.mount-lane-modal : !lane-control.mount-lane-modal null $modal }
   { $document.body.appendChild : !document.body.appendChild $backdrop }
  ]
  [ match
   { $cancel-btn.focus : !cancel-btn.focus }
  ]
  $modal
 )

 !agree-checkbox.addEventListener change : !modal.sync-agreement
 !agree-checkbox.addEventListener input : !modal.sync-agreement
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
