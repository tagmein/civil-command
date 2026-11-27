-- file lane-config-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a modal dialog for configuring an open lane (Title, Width, and remembered Path)
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
 ; to width-row !document.createElement div
 ; set lane-config-input-row width-row.className
 ; to width-input !document.createElement input
 ; assign $width-input { type text } { className lane-config-input } { placeholder 'Auto (px)' } { spellcheck false } { autocomplete off }
 !width-input.setAttribute inputmode numeric
 ; to width-reset-btn !document.createElement button
 ; assign $width-reset-btn { type button } { className 'lane-modal-action lane-config-reset-btn' } { textContent Reset } { title 'Reset to auto width' }

 ; to path-field-wrap !document.createElement div
 ; set lane-config-field path-field-wrap.className
 ; to path-label !document.createElement label
 ; assign $path-label { className lane-config-label } { textContent Path }
 ; to path-row !document.createElement div
 ; set lane-config-input-row path-row.className
 ; to path-input !document.createElement input
 ; assign $path-input { type text } { className lane-config-input } { placeholder 'Default (source)' } { spellcheck false } { autocomplete off }
 ; to path-reset-btn !document.createElement button
 ; assign $path-reset-btn { type button } { className 'lane-modal-action lane-config-reset-btn' } { textContent Reset } { title 'Reset to default view' }

 ; to pkg-field-wrap !document.createElement div
 ; set lane-config-field pkg-field-wrap.className
 ; to pkg-label !document.createElement label
 ; assign $pkg-label { className lane-config-label } { textContent Package }
 ; to pkg-select !document.createElement select
 ; set 'lane-input-type lane-config-input lane-config-select' pkg-select.className

 ; to feat-field-wrap !document.createElement div
 ; set 'lane-config-field lane-config-features' feat-field-wrap.className
 ; to feat-label !document.createElement div
 ; assign $feat-label { className lane-config-label } { textContent Features }
 ; to http-feat-row !document.createElement label
 ; set cc-checkbox-label http-feat-row.className
 ; to http-server-check !document.createElement input
 ; assign $http-server-check { type checkbox }
 !http-server-check.setAttribute data-feature httpServer
 ; to http-feat-txt !document.createElement span
 ; assign $http-feat-txt { textContent 'HTTP Server' }
 !http-feat-row.appendChild $http-server-check
 !http-feat-row.appendChild $http-feat-txt
 ; to http-feat-desc !document.createElement div
 ; assign $http-feat-desc { className lane-config-feature-desc } { textContent 'Enable the Server tab to simulate HTTP requests and deploy this lane as a backend API' }

 ; to cron-feat-row !document.createElement label
 ; set cc-checkbox-label cron-feat-row.className
 ; to cron-30m-check !document.createElement input
 ; assign $cron-30m-check { type checkbox }
 !cron-30m-check.setAttribute data-feature runEvery30Minutes
 ; to cron-feat-txt !document.createElement span
 ; assign $cron-feat-txt { textContent 'Run every 30 minutes' }
 !cron-feat-row.appendChild $cron-30m-check
 !cron-feat-row.appendChild $cron-feat-txt
 ; to cron-feat-desc !document.createElement div
 ; assign $cron-feat-desc { className lane-config-feature-desc } { textContent 'Automatically evaluate this lane on a 30-minute singleton schedule (and update top rail elements when used for Preferences)' }

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to copy-agent-btn !document.createElement button
 ; assign $copy-agent-btn { type button } { className 'lane-modal-action lane-config-reset-btn' } { textContent 'Copy Info' } { title 'Copy session & lane context for an agent' }
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
 !width-row.appendChild $width-input
 !width-row.appendChild $width-reset-btn
 !width-field-wrap.appendChild $width-label
 !width-field-wrap.appendChild $width-row
 !path-row.appendChild $path-input
 !path-row.appendChild $path-reset-btn
 !path-field-wrap.appendChild $path-label
 !path-field-wrap.appendChild $path-row
 !pkg-field-wrap.appendChild $pkg-label
 !pkg-field-wrap.appendChild $pkg-select
 !feat-field-wrap.appendChild $feat-label
 !feat-field-wrap.appendChild $http-feat-row
 !feat-field-wrap.appendChild $http-feat-desc
 !feat-field-wrap.appendChild $cron-feat-row
 !feat-field-wrap.appendChild $cron-feat-desc
 !footer.appendChild $copy-agent-btn
 !footer.appendChild $cancel-btn
 !footer.appendChild $save-btn
 !form.appendChild $field-wrap
 !form.appendChild $width-field-wrap
 !form.appendChild $path-field-wrap
 !form.appendChild $pkg-field-wrap
 !form.appendChild $feat-field-wrap
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
  { width-reset-btn $width-reset-btn }
  { path-input $path-input }
  { path-reset-btn $path-reset-btn }
  { pkg-select $pkg-select }
  { pkg-option-els {} }
  { http-server-check $http-server-check }
  { cron-30m-check $cron-30m-check }
  { copy-agent-btn $copy-agent-btn }
  { copy-timer null }
  { close-btn $close-btn }
  { cancel-btn $cancel-btn }
  { save-btn $save-btn }
  { is-open false }
  { is-saving false }
  { lane null }
 ]

 ; to sync-reset-buttons (
  -- Enables or disables Reset buttons next to Width and Path based on whether each input has a value
  ; to raw-w !width-input.value.trim
  ; to raw-p !path-input.value.trim
  ; set [ propertyIs '' raw-w ] width-reset-btn.disabled
  ; set [ propertyIs '' raw-p ] path-reset-btn.disabled
 )

 ; to modal.close (
  -- Closes the lane configuration modal without saving
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

 ; to modal.save (
  -- Saves configured lane changes (Title, Width, Path, Package, and Features) and closes the modal
  ; to lane $modal.lane
  [ match
   { [ and { $lane } { [ propertyIs false modal.is-saving ] } ] (
    ; set true modal.is-saving
    ; set true save-btn.disabled
    ; set 'lane-modal-action lane-config-btn--save cc-btn-busy' save-btn.className
    ; set 'Saving…' save-btn.textContent
    [ match
     { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Saving…' }
    ]
    ; try (
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
     ; to raw-path !path-input.value.trim
     ; to cur-path [ match
      { [ propertyIs undefined lane.path ] : null }
      { true : $lane.path }
     ]
     ; to next-path [ match
      { [ propertyIs '' raw-path ] : null }
      { true (
       ; to parsed-path !normalizeLanePath $raw-path
       [ match
        { [ propertyIs null parsed-path ] : $cur-path }
        { true : $parsed-path }
       ]
      ) }
     ]
     [ match
      { [ propertyIs $cur-path next-path ] : null }
      { $lane-control.set-path : !lane-control.set-path $lane.id $next-path }
     ]
     ; to cur-pkg [ match
      { $lane.package-id : $lane.package-id }
      { true : default }
     ]
     ; to next-pkg [ match
      { $pkg-select.value : $pkg-select.value }
      { true : $cur-pkg }
     ]
     [ match
      { [ propertyIs $cur-pkg next-pkg ] : null }
      { $lane-control.move-lane-package : !lane-control.move-lane-package $lane.id $next-pkg }
     ]
     ; to cur-http [ match
      { [ propertyIs true lane.features.httpServer ] : true }
      { true : false }
     ]
     ; to next-http [ match
      { [ propertyIs true http-server-check.checked ] : true }
      { true : false }
     ]
     ; to cur-cron [ match
      { [ propertyIs true lane.features.runEvery30Minutes ] : true }
      { true : false }
     ]
     ; to next-cron [ match
      { [ propertyIs true cron-30m-check.checked ] : true }
      { true : false }
     ]
     ; to features-unchanged [ and { propertyIs $cur-http next-http } { propertyIs $cur-cron next-cron } ]
     [ match
      { [ propertyIs true features-unchanged ] : null }
      { $lane-control.set-features : !lane-control.set-features $lane.id [ object { httpServer $next-http } { runEvery30Minutes $next-cron } ] }
     ]
    ) : null
    [ match
     { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
    ]
    ; set false modal.is-saving
    ; set false save-btn.disabled
    ; set 'lane-modal-action lane-config-btn--save' save-btn.className
    ; set 'Save changes' save-btn.textContent
    !modal.close
   ) }
  ]
 )

 ; to modal.open (
  -- Opens the configuration modal for the given lane
  ; to { lane } $argv
  [ match
   { $lane (
    ; condition { propertyIs true modal.is-open } (
     [ match
      { [ and { $modal.lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $modal.lane $modal }
     ]
    )
    ; set $lane modal.lane
    ; set $lane.id id-el.textContent
    ; set $lane.title title-input.value
    ; to width-text [ match
     { [ propertyIs null lane.width ] : '' }
     { [ propertyIs undefined lane.width ] : '' }
     { true : ; add '' $lane.width }
    ]
    ; set $width-text width-input.value
    ; to path-text [ match
     { [ propertyIs null lane.path ] : '' }
     { [ propertyIs undefined lane.path ] : '' }
     { true : ; add '' $lane.path }
    ]
    ; set $path-text path-input.value
    ; while { propertyIsGreaterThan 0 modal.pkg-option-els.length } (
     ; to old-opt !modal.pkg-option-els.pop
     !old-opt.remove
    )
    ; to cur-pkg [ match
     { $lane.package-id : $lane.package-id }
     { true : default }
    ]
    ; to pkgs [ match
     { $lane-control.open-packages : $lane-control.open-packages }
     { true : {} }
    ]
    ; to seen-cur ; object { hit false }
    ; each $pkgs (
     ; to { pkg } $argv
     ; to opt !document.createElement option
     ; assign $opt { value $pkg.id } { textContent $pkg.name }
     !pkg-select.appendChild $opt
     !modal.pkg-option-els.push $opt
     ; condition { propertyIs $cur-pkg pkg.id } : ; set true seen-cur.hit
    )
    [ match
     { [ propertyIs false seen-cur.hit ] (
      ; to fallback-opt !document.createElement option
      ; to fallback-label [ match { [ propertyIs default cur-pkg ] : Default } { true : $cur-pkg } ]
      ; assign $fallback-opt { value $cur-pkg } { textContent $fallback-label }
      !pkg-select.appendChild $fallback-opt
      !modal.pkg-option-els.push $fallback-opt
     ) }
    ]
    ; set $cur-pkg pkg-select.value
    ; to cur-http [ match
     { [ propertyIs true lane.features.httpServer ] : true }
     { true : false }
    ]
    ; set $cur-http http-server-check.checked
    ; to cur-cron [ match
     { [ propertyIs true lane.features.runEvery30Minutes ] : true }
     { true : false }
    ]
    ; set $cur-cron cron-30m-check.checked
    ; set 'Copy Info' copy-agent-btn.textContent
    !sync-reset-buttons
    ; set true modal.is-open
    [ match
     { $lane-control.mount-lane-modal : !lane-control.mount-lane-modal $lane $modal }
     { $lane.body.appendChild (
      !backdrop.setAttribute data-lane-modal 'true'
      ; set 'lane-modal-backdrop lane-config-backdrop lane-modal-backdrop--lane' backdrop.className
      !lane.body.appendChild $backdrop
     ) }
     { $document.body.appendChild : !document.body.appendChild $backdrop }
    ]
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

 !width-input.addEventListener input $sync-reset-buttons
 !path-input.addEventListener input $sync-reset-buttons
 !width-reset-btn.addEventListener click (
  ; set '' width-input.value
  !sync-reset-buttons
  [ match
   { $width-input.focus : !width-input.focus }
  ]
 )
 !path-reset-btn.addEventListener click (
  ; set '' path-input.value
  !sync-reset-buttons
  [ match
   { $path-input.focus : !path-input.focus }
  ]
 )
 !copy-agent-btn.addEventListener click (
  [ match
   { $lane-control.copy-agent-context : !lane-control.copy-agent-context $modal.lane }
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
