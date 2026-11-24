-- file lane-config-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a modal dialog for configuring an open lane (currently title editing)
 ; to { lane-control } $argv
 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-config-backdrop' backdrop.className
 ; to panel !document.createElement div
 ; set 'lane-modal lane-config-modal' panel.className
 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-config-title-wrap title-wrap.className
 ; to heading !document.createElement div
 ; assign $heading { className lane-modal-title } { textContent 'Configure Lane' }
 ; to id-el !document.createElement div
 ; set lane-config-id id-el.className
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }

 ; to form !document.createElement form
 ; set lane-config-form form.className
 ; to field-wrap !document.createElement div
 ; set lane-config-field field-wrap.className
 ; to title-label !document.createElement label
 ; assign $title-label { className lane-config-label } { textContent Title }
 ; to title-input !document.createElement input
 ; assign $title-input { type text } { className lane-config-input } { placeholder 'Lane title...' } { spellcheck false } { autocomplete off }

 ; to width-field-wrap !document.createElement div
 ; set lane-config-field width-field-wrap.className
 ; to width-label !document.createElement label
 ; assign $width-label { className lane-config-label } { textContent Width }
 ; to width-input !document.createElement input
 ; assign $width-input { type text } { className lane-config-input } { placeholder 'Auto (px)' } { spellcheck false } { autocomplete off }
 !width-input.setAttribute inputmode numeric

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to save-btn !document.createElement button
 ; assign $save-btn { type submit } { className 'lane-modal-action lane-config-btn--save' } { textContent 'Save changes' }

 !title-wrap.appendChild $heading
 !title-wrap.appendChild $id-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn
 !field-wrap.appendChild $title-label
 !field-wrap.appendChild $title-input
 !width-field-wrap.appendChild $width-label
 !width-field-wrap.appendChild $width-input
 !footer.appendChild $cancel-btn
 !footer.appendChild $save-btn
 !form.appendChild $field-wrap
 !form.appendChild $width-field-wrap
 !form.appendChild $footer
 !panel.appendChild $header
 !panel.appendChild $form
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { form $form }
  { id-el $id-el }
  { title-input $title-input }
  { width-input $width-input }
  { close-btn $close-btn }
  { cancel-btn $cancel-btn }
  { save-btn $save-btn }
  { is-open false }
  { lane null }
 ]

 ; to modal.close (
  -- Closes the lane configuration modal without saving
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   ; set null modal.lane
   !backdrop.remove
  )
 )

 ; to modal.save (
  -- Saves configured lane changes (Title and Width) and closes the modal
  ; to lane $modal.lane
  [ match
   { $lane (
    ; to trimmed !title-input.value.trim
    ; to next-title [ match
     { [ propertyIs '' trimmed ] : $lane.title }
     { true : $trimmed }
    ]
    !lane-control.rename $lane.id $next-title
    ; to raw-width !width-input.value.trim
    ; to next-width [ match
     { [ propertyIs '' raw-width ] : null }
     { true (
      ; to parsed !normalizeLaneWidth $raw-width
      [ match
       { [ propertyIs null parsed ] : $lane.width }
       { true : $parsed }
      ]
     ) }
    ]
    [ match
     { [ propertyIs $lane.width next-width ] : null }
     { true : !lane-control.set-width $lane.id $next-width }
    ]
    !modal.close
   ) }
  ]
 )

 ; to modal.open (
  -- Opens the configuration modal for the given lane
  ; to { lane } $argv
  [ match
   { $lane (
    ; set $lane modal.lane
    ; set $lane.id id-el.textContent
    ; set $lane.title title-input.value
    ; to width-text [ match
     { [ propertyIs null lane.width ] : '' }
     { [ propertyIs undefined lane.width ] : '' }
     { true : ; add '' $lane.width }
    ]
    ; set $width-text width-input.value
    ; condition { propertyIs false modal.is-open } (
     ; set true modal.is-open
     !document.body.appendChild $backdrop
    )
    [ match
     { $title-input.focus : !title-input.focus }
    ]
    [ match
     { $title-input.select : !title-input.select }
    ]
   ) }
  ]
  $modal
 )

 !close-btn.addEventListener click $modal.close
 !cancel-btn.addEventListener click $modal.close
 !form.addEventListener submit (
  ; to { ev } $argv
  [ match
   { $ev.preventDefault : !ev.preventDefault }
  ]
  !modal.save
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
