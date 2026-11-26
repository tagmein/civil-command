-- file lane-package-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a dedicated multi-mode Packages modal: Create Package, Open/Unlock Package, and full-screen Package Page
 ; to { lane-control } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-config-backdrop lane-session-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-config-modal lane-session-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-config-title-wrap title-wrap.className
 ; to heading-el !document.createElement div
 ; assign $heading-el { className lane-modal-title } { textContent Packages }
 ; to subtitle-el !document.createElement div
 ; assign $subtitle-el { className lane-config-id } { textContent '' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading-el
 !title-wrap.appendChild $subtitle-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to error-el !document.createElement div
 ; assign $error-el { className lane-session-error } { textContent '' } { hidden true }

 -- Mode 1: Create Package form
 ; to create-form !document.createElement form
 ; assign $create-form { className lane-config-form } { hidden true }
 ; to create-name-field !document.createElement div
 ; set lane-config-field create-name-field.className
 ; to create-name-label !document.createElement label
 ; assign $create-name-label { className lane-config-label } { textContent 'Package Name' }
 ; to create-name-input !document.createElement input
 ; assign $create-name-input { type text } { className lane-config-input } { placeholder 'e.g. Finance, Research...' } { spellcheck false } { autocomplete off }
 !create-name-field.appendChild $create-name-label
 !create-name-field.appendChild $create-name-input

 ; to create-pass-field !document.createElement div
 ; set lane-config-field create-pass-field.className
 ; to create-pass-label !document.createElement label
 ; assign $create-pass-label { className lane-config-label } { textContent 'Passphrase (optional)' }
 ; to create-pass-input !document.createElement input
 ; assign $create-pass-input { type password } { className lane-config-input } { placeholder 'Leave empty for no passphrase' } { spellcheck false } { autocomplete off }
 !create-pass-field.appendChild $create-pass-label
 !create-pass-field.appendChild $create-pass-input

 ; to create-footer !document.createElement div
 ; set lane-config-footer create-footer.className
 ; to create-cancel-btn !document.createElement button
 ; assign $create-cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to create-submit-btn !document.createElement button
 ; assign $create-submit-btn { type submit } { className 'lane-modal-action lane-config-btn--save' } { textContent 'Create package' }
 !create-footer.appendChild $create-cancel-btn
 !create-footer.appendChild $create-submit-btn

 !create-form.appendChild $create-name-field
 !create-form.appendChild $create-pass-field
 !create-form.appendChild $create-footer

 -- Mode 2: Unlock / Open Package form
 ; to unlock-form !document.createElement form
 ; assign $unlock-form { className lane-config-form } { hidden true }
 ; to unlock-id-field !document.createElement div
 ; set lane-config-field unlock-id-field.className
 ; to unlock-id-label !document.createElement label
 ; assign $unlock-id-label { className lane-config-label } { textContent 'Package ID' }
 ; to unlock-id-input !document.createElement input
 ; assign $unlock-id-input { type text } { className lane-config-input } { placeholder 'pkg-...' } { spellcheck false } { autocomplete off }
 !unlock-id-field.appendChild $unlock-id-label
 !unlock-id-field.appendChild $unlock-id-input

 ; to unlock-pass-field !document.createElement div
 ; set lane-config-field unlock-pass-field.className
 ; to unlock-pass-label !document.createElement label
 ; assign $unlock-pass-label { className lane-config-label } { textContent 'Passphrase (if protected)' }
 ; to unlock-pass-input !document.createElement input
 ; assign $unlock-pass-input { type password } { className lane-config-input } { placeholder 'Enter passphrase...' } { spellcheck false } { autocomplete off }
 !unlock-pass-field.appendChild $unlock-pass-label
 !unlock-pass-field.appendChild $unlock-pass-input

 ; to unlock-footer !document.createElement div
 ; set lane-config-footer unlock-footer.className
 ; to unlock-cancel-btn !document.createElement button
 ; assign $unlock-cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to unlock-submit-btn !document.createElement button
 ; assign $unlock-submit-btn { type submit } { className 'lane-modal-action lane-config-btn--save' } { textContent 'Open package' }
 !unlock-footer.appendChild $unlock-cancel-btn
 !unlock-footer.appendChild $unlock-submit-btn

 !unlock-form.appendChild $unlock-id-field
 !unlock-form.appendChild $unlock-pass-field
 !unlock-form.appendChild $unlock-footer

 -- Mode 3: Full-screen Package Page (lists sessions with package open + lanes in package)
 ; to packages-page !document.createElement div
 ; assign $packages-page { className lane-page-body } { hidden true }

 ; to pkg-pills-bar !document.createElement div
 ; set lane-modal-packages pkg-pills-bar.className

 ; to pkg-detail !document.createElement div
 ; set lane-page-detail pkg-detail.className

 ; to pkg-detail-hdr !document.createElement div
 ; set lane-page-detail-header pkg-detail-hdr.className
 ; to pkg-detail-meta !document.createElement div
 ; set lane-modal-item-info pkg-detail-meta.className
 ; to pkg-detail-name !document.createElement div
 ; assign $pkg-detail-name { className lane-page-detail-title } { textContent '' }
 ; to pkg-detail-id !document.createElement div
 ; assign $pkg-detail-id { className lane-modal-item-id } { textContent '' }
 !pkg-detail-meta.appendChild $pkg-detail-name
 !pkg-detail-meta.appendChild $pkg-detail-id

 ; to pkg-detail-acts !document.createElement div
 ; set lane-modal-item-actions pkg-detail-acts.className
 ; to pkg-set-active-btn !document.createElement button
 ; assign $pkg-set-active-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent 'Set active' }
 ; to pkg-close-btn !document.createElement button
 ; assign $pkg-close-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent 'Remove from session' }
 !pkg-detail-acts.appendChild $pkg-set-active-btn
 !pkg-detail-acts.appendChild $pkg-close-btn
 !pkg-detail-hdr.appendChild $pkg-detail-meta
 !pkg-detail-hdr.appendChild $pkg-detail-acts

 ; to pkg-cols !document.createElement div
 ; set lane-page-columns pkg-cols.className

 ; to pkg-sessions-col !document.createElement div
 ; set lane-page-column pkg-sessions-col.className
 ; to pkg-sessions-hdr !document.createElement div
 ; assign $pkg-sessions-hdr { className lane-config-label } { textContent 'Sessions with this package open' }
 ; to pkg-sessions-draft !document.createElement div
 ; assign $pkg-sessions-draft { className workspace-session-draft } { hidden true }
 ; to pkg-draft-text !document.createElement div
 ; assign $pkg-draft-text { className workspace-session-draft-label } { textContent 'Unsaved version' }
 ; to pkg-draft-btns !document.createElement div
 ; set workspace-session-draft-actions pkg-draft-btns.className
 ; to pkg-draft-save-btn !document.createElement button
 ; assign $pkg-draft-save-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent Save }
 ; to pkg-draft-fork-btn !document.createElement button
 ; assign $pkg-draft-fork-btn { type button } { className workspace-mini-btn } { textContent Fork }
 ; to pkg-draft-abandon-btn !document.createElement button
 ; assign $pkg-draft-abandon-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--danger' } { textContent Abandon }
 !pkg-draft-btns.appendChild $pkg-draft-save-btn
 !pkg-draft-btns.appendChild $pkg-draft-fork-btn
 !pkg-draft-btns.appendChild $pkg-draft-abandon-btn
 !pkg-sessions-draft.appendChild $pkg-draft-text
 !pkg-sessions-draft.appendChild $pkg-draft-btns
 ; to pkg-sessions-list !document.createElement div
 ; set lane-modal-list pkg-sessions-list.className
 !pkg-sessions-col.appendChild $pkg-sessions-hdr
 !pkg-sessions-col.appendChild $pkg-sessions-draft
 !pkg-sessions-col.appendChild $pkg-sessions-list

 ; to pkg-lanes-col !document.createElement div
 ; set lane-page-column pkg-lanes-col.className
 ; to pkg-lanes-hdr !document.createElement div
 ; assign $pkg-lanes-hdr { className lane-config-label } { textContent 'Lanes in this package' }
 ; to pkg-lanes-list !document.createElement div
 ; set lane-modal-list pkg-lanes-list.className
 !pkg-lanes-col.appendChild $pkg-lanes-hdr
 !pkg-lanes-col.appendChild $pkg-lanes-list

 !pkg-cols.appendChild $pkg-sessions-col
 !pkg-cols.appendChild $pkg-lanes-col
 !pkg-detail.appendChild $pkg-detail-hdr
 !pkg-detail.appendChild $pkg-cols
 !packages-page.appendChild $pkg-pills-bar
 !packages-page.appendChild $pkg-detail

 !panel.appendChild $header
 !panel.appendChild $error-el
 !panel.appendChild $create-form
 !panel.appendChild $unlock-form
 !panel.appendChild $packages-page
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { heading-el $heading-el }
  { subtitle-el $subtitle-el }
  { error-el $error-el }
  { close-btn $close-btn }
  { create-form $create-form }
  { create-name-input $create-name-input }
  { create-pass-input $create-pass-input }
  { create-cancel-btn $create-cancel-btn }
  { create-submit-btn $create-submit-btn }
  { unlock-form $unlock-form }
  { unlock-id-input $unlock-id-input }
  { unlock-pass-input $unlock-pass-input }
  { unlock-cancel-btn $unlock-cancel-btn }
  { unlock-submit-btn $unlock-submit-btn }
  { packages-page $packages-page }
  { pkg-pills-bar $pkg-pills-bar }
  { pkg-detail-name $pkg-detail-name }
  { pkg-detail-id $pkg-detail-id }
  { pkg-set-active-btn $pkg-set-active-btn }
  { pkg-close-btn $pkg-close-btn }
  { pkg-sessions-draft $pkg-sessions-draft }
  { pkg-draft-text $pkg-draft-text }
  { pkg-draft-btns $pkg-draft-btns }
  { pkg-draft-save-btn $pkg-draft-save-btn }
  { pkg-draft-fork-btn $pkg-draft-fork-btn }
  { pkg-draft-abandon-btn $pkg-draft-abandon-btn }
  { pkg-sessions-list $pkg-sessions-list }
  { pkg-lanes-list $pkg-lanes-list }
  { selected-pkg-id '' }
  { pkg-pill-els {} }
  { pkg-session-els {} }
  { pkg-session-items {} }
  { pkg-lane-els {} }
  { pkg-lane-items {} }
  { is-open false }
  { mode packages }
  { return-to-packages false }
  { on-created null }
  { on-opened null }
 ]

 ; to set-error (
  ; to { msg } $argv
  ; to clean [ match
   { [ propertyIs null msg ] : '' }
   { [ propertyIs undefined msg ] : '' }
   { true : ; add '' $msg }
  ]
  ; set $clean error-el.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] error-el.hidden
 )

 ; to show-mode (
  ; to { next-mode title sub } $argv
  ; set $next-mode modal.mode
  ; set $title heading-el.textContent
  ; set $sub subtitle-el.textContent
  !set-error ''
  ; to is-wide [ propertyIs packages next-mode ]
  ; set [ ternary $is-wide 'lane-modal-backdrop lane-session-backdrop lane-session-backdrop--wide' 'lane-modal-backdrop lane-config-backdrop lane-session-backdrop' ] backdrop.className
  ; set [ ternary $is-wide 'lane-modal lane-session-modal lane-session-modal--wide' 'lane-modal lane-config-modal lane-session-modal' ] panel.className
  ; set [ ternary [ propertyIs create next-mode ] false true ] create-form.hidden
  ; set [ ternary [ propertyIs unlock next-mode ] false true ] unlock-form.hidden
  ; set [ ternary [ propertyIs packages next-mode ] false true ] packages-page.hidden
  ; condition { propertyIs false modal.is-open } (
   ; set true modal.is-open
   [ match
    { $document.body.appendChild : !document.body.appendChild $backdrop }
   ]
  )
 )

 ; to modal.close (
  -- Closes the package modal
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   ; set false modal.return-to-packages
   ; set null modal.on-created
   ; set null modal.on-opened
   !set-error ''
   !backdrop.remove
  )
 )

 ; to modal.render-packages-page (
  -- Renders the full-screen Package Page: package pills, active package details, sessions with that package open, and lanes in that package
  !lane-control.ensure-session
  ; while { propertyIsGreaterThan 0 modal.pkg-pill-els.length } (
   ; to old !modal.pkg-pill-els.pop
   !old.remove
  )
  ; while { propertyIsGreaterThan 0 modal.pkg-session-els.length } (
   ; to old !modal.pkg-session-els.pop
   !old.remove
  )
  ; while { propertyIsGreaterThan 0 modal.pkg-lane-els.length } (
   ; to old !modal.pkg-lane-els.pop
   !old.remove
  )
  ; set 0 modal.pkg-session-items.length
  ; set 0 modal.pkg-lane-items.length

  ; to pkgs [ match
   { $lane-control.open-packages : $lane-control.open-packages }
   { true : {} }
  ]
  ; to selected-pkg ; object { item null }
  ; each $pkgs (
   ; to { pkg } $argv
   ; condition { propertyIs $modal.selected-pkg-id pkg.id } : ; set $pkg selected-pkg.item
  )
  [ match
   { $selected-pkg.item : null }
   { [ propertyIsGreaterThan 0 pkgs.length ] (
    ; to first-pkg [ get pkgs 0 ]
    ; set $first-pkg selected-pkg.item
    ; set $first-pkg.id modal.selected-pkg-id
   ) }
  ]

  ; each $pkgs (
   ; to { pkg } $argv
   ; to is-sel [ propertyIs $modal.selected-pkg-id pkg.id ]
   ; to is-act [ propertyIs $lane-control.active-package-id pkg.id ]
   ; to pbtn !document.createElement button
   ; to lbl [ ternary $is-act [ ; add '● ' $pkg.name ] $pkg.name ]
   ; assign $pbtn { type button } { className [ ternary $is-sel 'lane-modal-pkg-pill lane-modal-pkg-pill--active' lane-modal-pkg-pill ] } { textContent $lbl } { title $pkg.id }
   !pbtn.addEventListener click (
    ; set $pkg.id modal.selected-pkg-id
    !modal.render-packages-page
   )
   !pkg-pills-bar.appendChild $pbtn
   !modal.pkg-pill-els.push $pbtn
  )

  ; to add-pkg-btn !document.createElement button
  ; assign $add-pkg-btn { type button } { className lane-modal-pkg-action } { textContent '+ Create package' }
  !add-pkg-btn.addEventListener click (
   !modal.open-create-package [ object
    { return-to-packages true }
    { on-created (
     ; to { res } $argv
     ; to next-id [ match { $res.pkg.id : $res.pkg.id } { true : '' } ]
     !modal.open-packages $next-id
    ) }
   ]
  )
  ; to open-pkg-btn !document.createElement button
  ; assign $open-pkg-btn { type button } { className lane-modal-pkg-action } { textContent 'Open by ID' }
  !open-pkg-btn.addEventListener click (
   !modal.open-unlock-package [ object
    { return-to-packages true }
    { on-opened (
     ; to { res } $argv
     ; to next-id [ match { $res.pkg.id : $res.pkg.id } { true : '' } ]
     !modal.open-packages $next-id
    ) }
   ]
  )
  !pkg-pills-bar.appendChild $add-pkg-btn
  !pkg-pills-bar.appendChild $open-pkg-btn
  !modal.pkg-pill-els.push $add-pkg-btn
  !modal.pkg-pill-els.push $open-pkg-btn

  ; to cur-pkg $selected-pkg.item
  ; to pending [ propertyIs true lane-control.session-status-pending ]
  ; to dirty [ and { propertyIs false pending } { propertyIs true lane-control.session-dirty } ]
  ; to blocked [ match { $pending : true } { $dirty : true } { true : false } ]
  ; to pending-lbl [ match
   { [ propertyIs '' lane-control.session-status-label ] : 'Loading…' }
   { $lane-control.session-status-label : $lane-control.session-status-label }
   { true : 'Loading…' }
  ]
  ; set [ ternary $blocked false true ] pkg-sessions-draft.hidden
  ; set [ ternary $pending 'workspace-session-draft workspace-session-draft--pending' workspace-session-draft ] pkg-sessions-draft.className
  ; set [ ternary $pending $pending-lbl 'Unsaved version' ] pkg-draft-text.textContent
  ; set $pending pkg-draft-btns.hidden
  [ match
   { $cur-pkg (
    ; set false pkg-detail.hidden
    ; to title-txt [ match { $cur-pkg.hasPassphrase : ; add $cur-pkg.name ' (locked)' } { true : $cur-pkg.name } ]
    ; set $title-txt pkg-detail-name.textContent
    ; set $cur-pkg.id pkg-detail-id.textContent
    ; to is-act [ propertyIs $lane-control.active-package-id cur-pkg.id ]
    ; set $is-act pkg-set-active-btn.hidden

    ; to sess-res !listPackageSessions $data $cur-pkg.id
    ; to sessions [ match { $sess-res.sessions : $sess-res.sessions } { true : {} } ]
    [ match
     { [ propertyIs 0 sessions.length ] (
      ; to empty-s !document.createElement div
      ; assign $empty-s { className lane-modal-empty } { textContent 'No sessions have this package open.' }
      !pkg-sessions-list.appendChild $empty-s
      !modal.pkg-session-els.push $empty-s
     ) }
     { true (
      ; each $sessions (
       ; to { s } $argv
       ; to row !document.createElement div
       ; set lane-modal-item row.className
       ; to info !document.createElement div
       ; set lane-modal-item-info info.className
       ; to nm !document.createElement div
       ; assign $nm { className lane-modal-item-title } { textContent $s.name }
       ; to s-dir [ match
        { $lane-control.format-data-dir-label : !lane-control.format-data-dir-label $s.dataDir $s.dataDirConfirmed }
        { $s.dataDir : $s.dataDir }
        { [ propertyIs true s.dataDirConfirmed ] : Default }
        { true : 'Default (unconfirmed)' }
       ]
       ; to sub !document.createElement div
       ; to sub-txt ; add $s-dir ; add ' · ' ; add $s.id ; add ' · ' ; add $s.laneCount ' lanes'
       ; assign $sub { className lane-modal-item-id } { textContent $sub-txt }
       !info.appendChild $nm
       !info.appendChild $sub

       ; to acts !document.createElement div
       ; set lane-modal-item-actions acts.className
       ; to is-cur [ propertyIs $lane-control.session-id s.id ]
       [ match
        { $is-cur (
         ; to badge !document.createElement span
         ; assign $badge { className 'lane-modal-badge lane-modal-badge--selected' } { textContent Current }
         !acts.appendChild $badge
        ) }
        { true (
         ; to sw-btn !document.createElement button
         ; assign $sw-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Switch } { disabled $blocked }
         !sw-btn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
         !sw-btn.addEventListener click (
          ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
           !lane-control.switch-session $s.id
           !modal.close
          )
         )
         !acts.appendChild $sw-btn
        ) }
       ]
       !row.appendChild $info
       !row.appendChild $acts
       !pkg-sessions-list.appendChild $row
       !modal.pkg-session-els.push $row
       !modal.pkg-session-items.push ; object { session $s } { el $row } { switch-btn [ match { $is-cur : null } { true : $sw-btn } ] }
      )
     ) }
    ]

    ; to lanes-res !listPackageLanes $data $cur-pkg.id
    ; to pkg-lanes [ match { $lanes-res.lanes : $lanes-res.lanes } { true : {} } ]
    [ match
     { [ propertyIs 0 pkg-lanes.length ] (
      ; to empty-l !document.createElement div
      ; assign $empty-l { className lane-modal-empty } { textContent 'No lanes in this package yet.' }
      !pkg-lanes-list.appendChild $empty-l
      !modal.pkg-lane-els.push $empty-l
     ) }
     { true (
      ; each $pkg-lanes (
       ; to { l } $argv
       ; to row !document.createElement div
       ; set lane-modal-item row.className
       ; to info !document.createElement div
       ; set lane-modal-item-info info.className
       ; to nm !document.createElement div
       ; assign $nm { className lane-modal-item-title } { textContent $l.title }
       ; to sub !document.createElement div
       ; assign $sub { className lane-modal-item-id } { textContent $l.id }
       !info.appendChild $nm
       !info.appendChild $sub

       ; to acts !document.createElement div
       ; set lane-modal-item-actions acts.className
       ; to is-open-lane [ get lane-control.by-id $l.id ]
       [ match
        { $is-open-lane (
         ; to obadge !document.createElement span
         ; assign $obadge { className lane-modal-badge } { textContent Open }
         !acts.appendChild $obadge
        ) }
        { true (
         ; to obtn !document.createElement button
         ; assign $obtn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Open }
         !obtn.addEventListener click (
          [ match
           { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Loading…' }
          ]
          ; try (
           !lane-control.open $l.id
           !lane-control.update-url
          ) : null
          [ match
           { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
          ]
          !modal.close
         )
         !acts.appendChild $obtn
        ) }
       ]
       !row.appendChild $info
       !row.appendChild $acts
       !pkg-lanes-list.appendChild $row
       !modal.pkg-lane-els.push $row
       !modal.pkg-lane-items.push ; object { lane $l } { el $row }
      )
     ) }
    ]
   ) }
   { true : ; set true pkg-detail.hidden }
  ]
 )

 ; to modal.open-create-package (
  -- Opens the Create Package dialog (name + optional passphrase)
  ; to { opts } $argv
  ; set '' create-name-input.value
  ; set '' create-pass-input.value
  ; set [ ternary $opts.return-to-packages true false ] modal.return-to-packages
  ; set [ match { $opts.on-created : $opts.on-created } { true : null } ] modal.on-created
  ; set null modal.on-opened
  !show-mode create 'Create Package' 'Organize lanes into a shareable, optionally passphrase-protected package'
  [ match
   { $create-name-input.focus : !create-name-input.focus }
  ]
  $modal
 )

 ; to modal.open-unlock-package (
  -- Opens the Open / Unlock Package dialog (by package ID + optional passphrase)
  ; to { opts } $argv
  ; to prefill [ match
   { $opts.package-id : $opts.package-id }
   { true : '' }
  ]
  ; set $prefill unlock-id-input.value
  ; set '' unlock-pass-input.value
  ; set [ ternary $opts.return-to-packages true false ] modal.return-to-packages
  ; set [ match { $opts.on-opened : $opts.on-opened } { true : null } ] modal.on-opened
  ; set null modal.on-created
  !show-mode unlock 'Open Package' 'Enter a package ID and passphrase (if required) to open it in this session'
  [ match
   { [ propertyIs '' prefill ] (
    [ match { $unlock-id-input.focus : !unlock-id-input.focus } ]
   ) }
   { true (
    [ match { $unlock-pass-input.focus : !unlock-pass-input.focus } ]
   ) }
  ]
  $modal
 )

 ; to modal.open-packages (
  -- Opens the full-screen Package Page modal, optionally pre-selecting a package ID
  ; to { package-id } $argv
  ; set false modal.return-to-packages
  ; set null modal.on-created
  ; set null modal.on-opened
  [ match
   { $package-id : ; set $package-id modal.selected-pkg-id }
   { $lane-control.active-package-id : ; set $lane-control.active-package-id modal.selected-pkg-id }
   { true : ; set '' modal.selected-pkg-id }
  ]
  !show-mode packages Packages 'Inspect included packages, see which sessions have each package open, and browse package lanes'
  !modal.render-packages-page
  $modal
 )

 !create-form.addEventListener submit (
  ; to { ev } $argv
  [ match { $ev.preventDefault : !ev.preventDefault } ]
  ; to raw-name !create-name-input.value.trim
  [ match
   { [ propertyIs '' raw-name ] (
    !set-error 'Please enter a package name'
    [ match { $create-name-input.focus : !create-name-input.focus } ]
   ) }
   { true (
    ; to res !lane-control.create-package $raw-name $create-pass-input.value
    ; to cb $modal.on-created
    !modal.close
    [ match
     { $cb : !$cb $res }
    ]
   ) }
  ]
 )

 !unlock-form.addEventListener submit (
  ; to { ev } $argv
  [ match { $ev.preventDefault : !ev.preventDefault } ]
  ; to pkg-id !unlock-id-input.value.trim
  [ match
   { [ propertyIs '' pkg-id ] (
    !set-error 'Please enter a package ID'
    [ match { $unlock-id-input.focus : !unlock-id-input.focus } ]
   ) }
   { true (
    ; to res !lane-control.open-package $pkg-id $unlock-pass-input.value
    [ match
     { $res.ok (
      ; to cb $modal.on-opened
      !modal.close
      [ match
       { $cb : !$cb $res }
      ]
     ) }
     { true (
      !set-error $res.error
      [ match
       { $res.needsPassphrase (
        [ match { $unlock-pass-input.focus : !unlock-pass-input.focus } ]
       ) }
       { true (
        [ match { $unlock-id-input.focus : !unlock-id-input.focus } ]
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 !pkg-draft-save-btn.addEventListener click (
  !lane-control.save-session-draft
  !modal.render-packages-page
 )
 !pkg-draft-fork-btn.addEventListener click (
  !lane-control.fork-session
  !modal.render-packages-page
 )
 !pkg-draft-abandon-btn.addEventListener click (
  !lane-control.abandon-session-draft
  !modal.render-packages-page
 )
 !pkg-set-active-btn.addEventListener click (
  ; condition { propertyIsGreaterThan 0 modal.selected-pkg-id.length } (
   !lane-control.set-active-package $modal.selected-pkg-id
   !modal.render-packages-page
  )
 )
 !pkg-close-btn.addEventListener click (
  ; condition { propertyIsGreaterThan 0 modal.selected-pkg-id.length } (
   !lane-control.close-package $modal.selected-pkg-id
   ; set '' modal.selected-pkg-id
   !modal.render-packages-page
  )
 )

 ; to cancel-subform (
  [ match
   { $modal.return-to-packages : !modal.open-packages $modal.selected-pkg-id }
   { true : !modal.close }
  ]
 )
 !close-btn.addEventListener click $modal.close
 !create-cancel-btn.addEventListener click $cancel-subform
 !unlock-cancel-btn.addEventListener click $cancel-subform
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